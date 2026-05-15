import { useCallback, useEffect } from 'react';
import * as api from "../api.js";

// Plaid sync and transaction normalization, extracted from AppInner.
export function usePlaidSync({
  accounts, setAccounts,
  transactions, setTransactions,
  plaidItems, setPlaidItems,
  setStaleItemIds, rules,
  showToast, syncing, setSyncing,
  setNewTxnNotifs, setNewTxnIds,
  initialized,
  applyRulesRef,
  catMap, customAccountNames, runAutoCategorize, cap,
}) {
  /* -- Plaid -- */
  const doSync = useCallback(async (itemId) => {
    if (syncing) return; // prevent concurrent syncs causing duplicate accounts
    setSyncing(true);
    try {
      const {added, modified, removed, newTxns = []} = await api.syncTransactions(itemId);
      // Only notify for transactions that were genuinely inserted this cycle —
      // newTxns comes from the server and excludes re-fetched history on cursor resets.
      if (newTxns.length > 0) {
        const notifs = newTxns.slice(0, 5).map(t => ({
          id: `txn-${t.id || Date.now()}`,
          type: "newtxn",
          merchant: t.merchant || "Transaction",
          amount: t.amount,
          date: t.date,
        }));
        setNewTxnNotifs(prev => {
          const existingIds = new Set(prev.map(n => n.id));
          return [...notifs.filter(n => !existingIds.has(n.id)), ...prev].slice(0, 20);
        });
        setNotifOpen(true);
      }
      setTransactions(prev => {
        // Normalise merchant name for fingerprinting.
        // Must stay byte-for-byte identical to computeFingerprint() in db.js.
        function normMerchant(t) {
          return (t.merchant || t.merchant_name || t.name || "")
            .toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
        }
        function fp(t) {
          const date = t.authorized_date || t.date || "";
          return `${date}__${t.amount}__${normMerchant(t)}`;
        }

        let next=[...prev];
        const removeIds=new Set(removed.map(r=>r.transaction_id));
        next=next.filter(t=>!removeIds.has(t.id));
        const modMap=Object.fromEntries(modified.map(t=>[t.transaction_id,t]));
        next=next.map(t=>{
          if (!modMap[t.id]) return t;
          const updated = plaidTxnToLocal(modMap[t.id],catMap);
          const merged = {
            ...t,
            // Only update the fields Plaid owns — never touch user fields
            date:       updated.date       || t.date,
            authorized_date: updated.authorized_date || t.authorized_date || null,
            amount:     updated.amount,
            pending:    updated.pending,
            // Merchant: only update if user hasn't renamed
            merchant:   t.name ? t.merchant : (updated.merchant || t.merchant),
            // User fields: never touch
            categoryId:     t.categoryId,
            userCategorized: t.userCategorized || false,
            name:       t.name  || "",
            notes:      t.notes || "",
            reviewed:   t.reviewed || false,
          };
          // Only apply rules if user hasn't manually categorized this txn
          return (applyRulesRef?.current || (t=>t[0]))([merged], rules, { onlyUncategorized: true })[0];
        });
        const existingIds=new Set(next.map(t=>t.id));
        const fingerprints=new Set(next.map(t=>fp(t)));
        const rawNew=added
          .filter(t=>!existingIds.has(t.transaction_id))
          .map(t=>plaidTxnToLocal(t,catMap))
          .filter(t=>{
            const f=fp(t);
            if(fingerprints.has(f)) return false;
            fingerprints.add(f);
            return true;
          });
        const finalNew = applyRulesRef?.current ? applyRulesRef.current(rawNew, rules, { onlyUncategorized: true }) : rawNew;
        if (finalNew.length > 0) {
          setNewTxnIds(new Set(finalNew.map(t => t.id)));
          setTimeout(() => setNewTxnIds(new Set()), 1200);
        }
        return [...finalNew, ...next];
      });
      const {accounts:plaidAccts} = await api.getAccounts();
      // Fetch fresh items from server — don't trust stale React state
      const freshItemsRes = await api.getPlaidItems();
      const freshItems = freshItemsRes?.items || [];
      const freshItemIds = new Set(freshItems.map(i => i.item_id));
      // Update plaidItems state so UI stays in sync
      if (freshItems.length > 0) setPlaidItems(freshItems);

      // Detect stale items — connected items that returned no accounts
      if (plaidAccts.length === 0 && plaidItems.length > 0) {
        setStaleItemIds(new Set(plaidItems.map(i => i.item_id)));
      } else if (itemId) {
        const itemAccts = plaidAccts.filter(a => a.item_id === itemId);
        setStaleItemIds(prev => {
          const next = new Set(prev);
          if (itemAccts.length === 0) next.add(itemId);
          else next.delete(itemId);
          return next;
        });
      }
      setAccounts(prev => {
        const manual = prev.filter(a => !a.plaidId);
        const byPlaidId = Object.fromEntries(prev.filter(a => a.plaidId).map(a => [a.plaidId, a]));
        // Use FRESH item IDs from server — never stale React state
        const activeItemIds = new Set([
          ...freshItemIds,
          ...plaidAccts.map(pa => pa.item_id),
        ]);
        // Build merged Plaid accounts - deduplicated by plaid account_id
        const seenPlaidIds = new Set();
        const plaidUpdated = plaidAccts
          .filter(pa => { const dup = seenPlaidIds.has(pa.account_id); seenPlaidIds.add(pa.account_id); return !dup; })
          .map(pa => ({
            ...(byPlaidId[pa.account_id] || { id: "a" + pa.account_id }),
            plaidId: pa.account_id,
            plaidItemId: pa.item_id,
            name: customAccountNames['a'+pa.account_id] || byPlaidId[pa.account_id]?.name || pa.name,
            balance: pa.balance,
            available: pa.available,
            type: cap(pa.subtype || pa.type),
            institution: pa.institution,
            mask: pa.mask,
          }));
        // Keep existing Plaid accounts from OTHER active items not returned by this sync
        const returnedPlaidIds = new Set(plaidAccts.map(pa => pa.account_id));
        const existingOtherPlaid = prev.filter(a =>
          a.plaidId && !returnedPlaidIds.has(a.plaidId) && activeItemIds.has(a.plaidItemId)
        );
        const updated = [...manual, ...existingOtherPlaid, ...plaidUpdated];
        // Clean up genuine orphans — items no longer in server's plaid_items table
        const orphans = prev.filter(a =>
          a.plaidId && a.plaidItemId && !activeItemIds.has(a.plaidItemId)
        );
        if (orphans.length > 0) {
          const itemIds = [...new Set(orphans.map(a => a.plaidItemId).filter(Boolean))];
          itemIds.forEach(id => api.deleteAccountsByItem(id).catch(() => {}));
        }
        return updated;
      });
      setTransactions(prev=>{
        const map={};
        plaidAccts.forEach(pa=>{map[pa.account_id]="a"+pa.account_id;});
        return prev.map(t=>t.plaidAccountId?{...t,accountId:map[t.plaidAccountId]||t.accountId}:t);
      });
      if (added.length > 0) {
        showToast(`Synced: +${added.length} new transaction${added.length !== 1 ? "s" : ""}`);
      } else if (modified.length > 0 || removed.length > 0) {
        showToast(`Sync complete — ${modified.length} updated, ${removed.length} removed`);
      } else {
        showToast("Sync complete — you're up to date ✓");
      }
      // Invalidate the full analytics transaction set — it will reload fresh next time analytics opens
      if (added.length > 0 || removed.length > 0) {
        setAllTransactions(null);
        resetAnalyticsLoad();
      }
      // Auto-categorize new uncategorized transactions if user has AI key
      if (added.length > 0) {
        const count = await runAutoCategorize();
        if (count > 0) showToast(`✦ Auto-categorized ${count} transaction${count === 1 ? "" : "s"}`);
      }
    } catch(e) { showToast("Sync error: "+e.message); }
    finally {
      setSyncing(false);
      const now = Date.now();
      lastSyncedAt.current = now;
      try { localStorage.setItem("ledgr_last_sync", String(now)); } catch {}
    }
  }, [catMap, rules]);

  const handlePlaidSuccess = useCallback(async (publicToken, institutionName) => {
    try {
      const {item_id} = await api.exchangePublicToken(publicToken, institutionName);
      setPlaidItems(p=>[...p.filter(i=>i.item_id!==item_id),{item_id,institution:institutionName}]);
      showToast(`${institutionName} connected! Syncing…`);
      await doSync(item_id);
    } catch(e) { showToast("Connection failed: "+e.message); }
  }, [doSync]);

  // Auto-sync on boot if last sync was >4 hours ago
  useEffect(() => {
    if (!initialized.current) return;
    if (plaidItems.length === 0) return;
    if (Date.now() - lastSyncedAt.current > 24 * 60 * 60 * 1000) {
      doSync();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized.current]);

  // Auto-sync on tab/window focus if last sync was >30 minutes ago
  useEffect(() => {
    function handleFocus() {
      if (!initialized.current) return;
      if (plaidItems.length === 0) return;
      if (Date.now() - lastSyncedAt.current > 30 * 60 * 1000) {
        doSync();
      }
    }
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [doSync]);
  function plaidTxnToLocal(t,cm) {
    // Do NOT use Plaid's category string — it's too vague and causes false matches.
    // Rules (manual + AI) are the single source of truth for categorization.
    void cm;
    return {id:t.transaction_id,plaidAccountId:t.account_id,plaidItemId:t.item_id,accountId:"a"+t.account_id,
      date:t.date||t.authorized_date,authorized_date:t.authorized_date||null,
      merchant:t.merchant_name||t.name,name:"",
      amount:t.amount,categoryId:null,pending:t.pending,recurring:false,recurringDay:null,
      type:t.amount<0?"expense":"income"};
  }
  async function disconnectItem(itemId) {
    // Server-first: confirm all deletes before touching local state.
    try {
      try { await api.deleteItem(itemId); } catch(e) {
        if (!e.message?.includes("404") && !e.message?.includes("not found")) throw e;
      }
      await Promise.all([
        api.deleteAllTransactions(itemId),
        api.deleteAccountsByItem(itemId),
      ]);
      const cleanPlaidItems = plaidItems.filter(i => i.item_id !== itemId);
      await api.saveData({ plaidItems: cleanPlaidItems });
      setAccounts(prev => prev.filter(a => a.plaidItemId !== itemId));
      setTransactions(prev => prev.filter(t => t.plaidItemId !== itemId));
      setPlaidItems(cleanPlaidItems);
      setStaleItemIds(prev => { const n = new Set(prev); n.delete(itemId); return n; });
      showToast("Bank disconnected");
    } catch(e) { showToast("Disconnect failed — please try again: " + e.message); }
  }


  return {
    normMerchant, fp, handleFocus, plaidTxnToLocal,
    disconnectItem, doSync, handlePlaidSuccess,
  };
}
