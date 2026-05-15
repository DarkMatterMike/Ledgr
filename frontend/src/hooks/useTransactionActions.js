import { useMemo } from 'react';
import * as api from "../api.js";

// All transaction mutation and categorization logic, extracted from AppInner.
// Returns an object of all action functions.
export function useTransactionActions({
  transactions, setTransactions,
  categories, setCategories,
  rules, setRules,
  aiCatExamples, setAiCatExamples,
  showToast, showUndoToast,
  deletedTransactions, setDeletedTransactions,
  refreshSummary,
  setModal, setRecurringItemModal,
  setEditingId, setEditingName,
  setAutoCatRunning, setCatSuggestions,
  setRecurringItems,
  setRiForm, setEditingRecurringItem,
  setRiSearch, setRiSearchResults, setRiSearchLoading,
  setTxnForm, setTypeRulePrompt,
  scheduleSaveRef,
}) {
  /* -- Transaction CRUD -- */
  function startRename(t) { setEditingId(t.id); setEditingName(t.name||t.merchant); }
  function saveRename(id) {
    const newName = editingName.trim() || "";
    setTransactions(p=>p.map(t=>t.id===id?{...t,name:newName}:t));
    api.updateTransaction(id, { name: newName }).catch(console.error);
    setEditingId(null); showToast("Name updated");
  }
  function updateTxnName(id, name) {
    const n = (name || "").trim();
    if (!n) return;
    setTransactions(p => p.map(t => t.id === id ? { ...t, name: n } : t));
    api.updateTransaction(id, { name: n }).catch(console.error);
    showToast("Name updated");
  }
  function updateTxnType(id,val) {
    const clearCat = ["income","transfer","reimbursement"].includes(val);
    setTransactions(p=>{
      const next = p.map(t=>{
        if (t.id!==id) return t;
        const autoReviewed = val==="income"||val==="transfer"||val==="reimbursement";
        return {...t, type:val, reviewed: autoReviewed ? true : t.reviewed, categoryId: clearCat ? null : t.categoryId, userCategorized: clearCat ? false : t.userCategorized};
      });
      // Save immediately when clearing category — don't rely on debounce
      if (clearCat) {
        api.updateTransaction(id, { type: val, reviewed: ["income","transfer","reimbursement"].includes(val), categoryId: null, userCategorized: false }).catch(console.error);
      } else {
        api.updateTransaction(id, { type: val, reviewed: ["income","transfer","reimbursement"].includes(val) }).catch(console.error);
      }
      return next;
    });
    // Offer to create a type rule for the merchant
    const txn = transactions.find(t => t.id === id);
    const merchant = (txn?.merchant || txn?.name || "").trim();
    if (merchant && ["transfer","income","reimbursement"].includes(val)) {
      // Check if a type rule already exists for this merchant
      const alreadyHasRule = rules.some(r =>
        r.pattern.toLowerCase() === merchant.toLowerCase() && r.typeOverride === val
      );
      if (!alreadyHasRule) {
        setTypeRulePrompt({ merchant, type: val });
      }
    }
  }
  function updateTxnCat(id, val) {
    setTransactions(p => {
      // userCategorized:true locks this txn from being re-categorized by rules or sync
      const next = p.map(t => t.id === id ? { ...t, categoryId: val || null, reviewed: val ? true : t.reviewed, userCategorized: !!val } : t);
      // Save immediately — don't rely on debounce, a sync could arrive within 800ms
      // When removing a category (val is falsy), also reset reviewed so the transaction
      // returns to the review queue rather than staying silently "reviewed" with no category.
      api.updateTransaction(id, { categoryId: val || null, reviewed: val ? true : false, userCategorized: !!val }).catch(console.error);
      return next;
    });
    if (val) {
      const txn = transactions.find(t => t.id === id);
      if (txn) {
        promptSaveRule(txn, val);
        // Record as a manual rule — overwrites any AI rule for same merchant
        const merchant = (txn.merchant || txn.name || "").trim();
        if (merchant) {
          setAiCatExamples(prev => {
            const filtered = prev.filter(e => !(e.merchant === merchant && e.categoryId === val));
            const next = [...filtered, { merchant, categoryId: val }].slice(-200);
            scheduleSaveRef.current?.({ aiCatExamples: next });
            return next;
          });
          // Upsert into rules: if AI rule exists for this pattern, upgrade it to manual
          setRules(prev => {
            const pattern = merchant.toLowerCase();
            const existingIdx = prev.findIndex(r =>
              r.pattern.toLowerCase() === pattern && r.categoryId === val
            );
            if (existingIdx >= 0) {
              // Upgrade AI rule to manual
              const next = [...prev];
              next[existingIdx] = { ...next[existingIdx], source: "manual" };
              return next;
            }
            // Check if there's an AI rule for this merchant with a different category — replace it
            const aiIdx = prev.findIndex(r =>
              r.pattern.toLowerCase() === pattern && r.source === "ai"
            );
            if (aiIdx >= 0) {
              const next = [...prev];
              next[aiIdx] = { ...next[aiIdx], categoryId: val, source: "manual" };
              return next;
            }
            return prev; // promptSaveRule handles creating new manual rules
          });
        }
      }
    }
    refreshSummary();
  }
  async function runAutoCategorize(txnsToCheck) {
    const uncategorized = (txnsToCheck || transactions).filter(t =>
      !t.categoryId && (t.type === "expense" || t.type === "refund" || !t.type) && t.amount < 0
    );
    if (!uncategorized.length) { showToast("No uncategorized transactions to process"); return 0; }

    // -- No categories yet ← suggest a full set -------------------
    if (!categories.length) {
      setAutoCatRunning(true);
      try {
        const payload = uncategorized.slice(0, 100).map(t => ({
          id: t.id,
          merchant: (t.merchant || t.name || "").trim(),
          amount: t.amount,
        }));
        const { suggestions } = await api.suggestCategories(payload);
        if (!suggestions?.length) { showToast("Couldn't generate suggestions — try again"); return 0; }
        setCatSuggestions(suggestions.map(s => ({ ...s, limit: s.suggestedLimit || 0 })));
      } catch (e) {
        if (!e.message?.includes("no_api_key")) showToast("Auto-categorize failed: " + e.message);
        return 0;
      } finally {
        setAutoCatRunning(false);
      }
      return 0;
    }

    // -- Categories exist ← assign to existing only, never overwrite -
    const examples = rules
      .filter(r => r.enabled && r.categoryId)
      .map(r => ({ merchant: r.pattern, categoryId: r.categoryId }));

    setAutoCatRunning(true);
    try {
      const payload = uncategorized.slice(0, 80).map(t => ({
        id: t.id,
        merchant: (t.merchant || t.name || "").trim(),
        amount: t.amount,
      }));
      const { assignments } = await api.autoCategorize(payload, categories, examples);
      const count = Object.keys(assignments).length;
      if (count === 0) { showToast("Nothing new to categorize"); return 0; }

      const manualPatterns = new Set(
        rules.filter(r => r.source !== "ai").map(r => r.pattern.toLowerCase())
      );
      const newRules = [];
      const seenMerchants = new Set();

      for (const [txnId, catId] of Object.entries(assignments)) {
        const txn = uncategorized.find(t => t.id === txnId);
        if (!txn) continue;
        const merchant = (txn.merchant || txn.name || "").trim();
        const pattern  = merchant.toLowerCase();
        if (!merchant || seenMerchants.has(pattern)) continue;
        seenMerchants.add(pattern);
        if (manualPatterns.has(pattern)) continue;
        const existingAiRule = rules.find(r => r.source === "ai" && r.pattern.toLowerCase() === pattern);
        if (!existingAiRule) {
          newRules.push({
            id:         "ai" + Date.now() + Math.random().toString(36).slice(2),
            pattern:    merchant,
            matchType:  "contains",
            categoryId: catId,
            enabled:    true,
            source:     "ai",
            createdAt:  Date.now(),
          });
        }
      }

      // Only assign to currently uncategorized — never overwrite
      const updatedTxnIds = [];
      setTransactions(prev => prev.map(t => {
        if (assignments[t.id] && !t.categoryId) {
          updatedTxnIds.push(t.id);
          return { ...t, categoryId: assignments[t.id], reviewed: true };
        }
        return t;
      }));
      Object.entries(assignments).forEach(([txnId, catId]) => {
        if (updatedTxnIds.includes(txnId))
          api.updateTransaction(txnId, { categoryId: catId, reviewed: true, userCategorized: false }).catch(console.error);
      });

      if (newRules.length > 0) {
        setRules(prev => [...prev, ...newRules]);
        newRules.forEach(r => api.createRule(r).catch(console.error));
      }

      return count;
    } catch (e) {
      if (!e.message?.includes("no_api_key")) console.warn("Auto-categorize failed:", e.message);
      return 0;
    } finally {
      setAutoCatRunning(false);
    }
  }

  async function confirmCatSuggestions(confirmed) {
    setCatSuggestions(null);
    if (!confirmed?.length) return;

    const newCats = confirmed.map(s => ({
      id:              "cat" + Date.now() + Math.random().toString(36).slice(2),
      name:            s.name,
      color:           s.color || "var(--warn)",
      limit:           parseFloat(s.limit) || 0,
      completedMonths: [],
    }));
    setCategories(prev => [...prev, ...newCats]);

    const catByName = Object.fromEntries(newCats.map(c => [c.name, c.id]));
    const assignments = {};
    const newRules = [];
    const seenMerchants = new Set();

    confirmed.forEach(s => {
      const catId = catByName[s.name];
      if (!catId) return;
      (s.transactions || []).forEach(txnId => { assignments[txnId] = catId; });
      (s.transactions || []).forEach(txnId => {
        const txn = transactions.find(t => t.id === txnId);
        if (!txn) return;
        const merchant = (txn.merchant || txn.name || "").trim();
        const pattern  = merchant.toLowerCase();
        if (!merchant || seenMerchants.has(pattern)) return;
        seenMerchants.add(pattern);
        newRules.push({
          id:         "ai" + Date.now() + Math.random().toString(36).slice(2),
          pattern:    merchant,
          matchType:  "contains",
          categoryId: catId,
          enabled:    true,
          source:     "ai",
          createdAt:  Date.now(),
        });
      });
    });

    setTransactions(prev => prev.map(t =>
      assignments[t.id] && !t.categoryId
        ? { ...t, categoryId: assignments[t.id], reviewed: true }
        : t
    ));
    Object.entries(assignments).forEach(([txnId, catId]) => {
      api.updateTransaction(txnId, { categoryId: catId, reviewed: true, userCategorized: false }).catch(console.error);
    });
    setRules(prev => [...prev, ...newRules]);
    newRules.forEach(r => api.createRule(r).catch(console.error));

    showToast(`✦ Created ${newCats.length} categories, assigned ${Object.keys(assignments).length} transactions`);
  }

  function updateTxnAcct(id,val) {
    setTransactions(p=>p.map(t=>t.id===id?{...t,accountId:val||null}:t));
    api.updateTransaction(id, { accountId: val || null }).catch(console.error);
  }
  const _debouncedSaveNotes = useMemo(() => debounce((id, val) => api.updateTransaction(id, { notes: val }).catch(console.error), 800), []);
  function updateTxnNotes(id,val) {
    setTransactions(p=>p.map(t=>t.id===id?{...t,notes:val}:t));
    _debouncedSaveNotes(id, val);
  }
  function deleteTxn(id) {
    const txn = transactions.find(t=>t.id===id);
    if (!txn) return;
    // Move to trash immediately
    const trashed = { ...txn, deletedAt: new Date().toISOString() };
    setTransactions(p=>p.filter(t=>t.id!==id));
    setDeletedTransactions(p => {
      const next = [trashed, ...p];
      scheduleSaveRef.current?.({ deletedTransactions: next });
      return next;
    });
    showUndoToast("Moved to trash", () => {
      // Undo — restore from trash
      setTransactions(p=>[txn,...p]);
      setDeletedTransactions(p => {
        const next = p.filter(t=>t.id!==id);
        scheduleSaveRef.current?.({ deletedTransactions: next });
        return next;
      });
    });
    // Actually delete on backend after undo window (4.2s)
    setTimeout(() => api.deleteTransaction(id).catch(console.error), 4200);
  }
  // ── Recurring Item CRUD ───────────────────────────────────────────
  function saveRecurringItem(item) {
    const next = editingRecurringItem
      ? recurringItems.map(r => r.id === item.id ? item : r)
      : [...recurringItems, item];
    setRecurringItems(next);
    scheduleSaveRef.current?.({ recurringItems: next });
  }
  function deleteRecurringItem(id) {
    const item = recurringItems.find(r => r.id === id);
    // Persist unlink to backend for every transaction that was linked to this item,
    // so they survive a page reload and appear correctly in the transactions list.
    if (item?.linkedTxnIds?.length) {
      item.linkedTxnIds.forEach(txnId => {
        api.updateTransaction(txnId, { recurringItemId: null }).catch(console.error);
      });
    }
    setTransactions(prev => prev.map(t => t.recurringItemId === id ? { ...t, recurringItemId: null } : t));
    const next = recurringItems.filter(r => r.id !== id);
    setRecurringItems(next);
    scheduleSaveRef.current?.({ recurringItems: next });
    showToast("Recurring item removed");
  }
  function linkTxnToRecurringItem(txnId, itemId) {
    const item = recurringItems.find(r => r.id === itemId);
    if (!item) return;
    const txn = transactions.find(t => t.id === txnId);
    const linkedIds = [...new Set([...(item.linkedTxnIds||[]), txnId])];

    // Auto-populate amount range from linked transactions if not manually set
    let amountUpdate = {};
    if (txn && item.amountMin == null && item.amountMax == null) {
      const amt = Math.abs(txn.amount);
      amountUpdate = { amountMin: amt, amountMax: amt };
    } else if (txn) {
      // Widen the range if this txn is outside it
      const amt = Math.abs(txn.amount);
      const newMin = item.amountMin != null ? Math.min(item.amountMin, amt) : amt;
      const newMax = item.amountMax != null ? Math.max(item.amountMax, amt) : amt;
      if (newMin !== item.amountMin || newMax !== item.amountMax) {
        amountUpdate = { amountMin: newMin, amountMax: newMax };
      }
    }

    const next = recurringItems.map(r => r.id === itemId ? { ...r, linkedTxnIds: linkedIds, ...amountUpdate } : r);
    setRecurringItems(next);
    scheduleSaveRef.current?.({ recurringItems: next });

    // Also update riForm so the modal reflects the new amounts immediately
    if (Object.keys(amountUpdate).length > 0) {
      setRiForm(p => ({
        ...p,
        amountMin: amountUpdate.amountMin != null ? String(amountUpdate.amountMin) : p.amountMin,
        amountMax: amountUpdate.amountMax != null ? String(amountUpdate.amountMax) : p.amountMax,
      }));
      setEditingRecurringItem(prev => prev ? { ...prev, linkedTxnIds: linkedIds, ...amountUpdate } : prev);
    } else {
      setEditingRecurringItem(prev => prev ? { ...prev, linkedTxnIds: linkedIds } : prev);
    }

    setTransactions(prev => prev.map(t => t.id === txnId ? { ...t, recurringItemId: itemId } : t));
    api.updateTransaction(txnId, { recurringItemId: itemId }).catch(console.error);
  }
  // Auto-link a transaction to a recurring item based on name + amount + date proximity
  function autoLinkTransaction(txn, recurringItemsList) {
    if (!txn || txn.recurringItemId) return; // already linked
    const txnAmt = Math.abs(txn.amount);
    const txnDate = txn.date ? parseInt(txn.date.split("-")[2]) : null;
    const txnName = (txn.name || txn.merchant || "").toLowerCase();

    let bestMatch = null;
    let bestScore = 0;

    recurringItemsList.forEach(item => {
      // Skip income items for expense txns and vice versa
      if (item.type === "income" && txn.amount < 0) return;
      if (item.type !== "income" && txn.amount > 0) return;

      const itemName = (item.name || "").toLowerCase();

      // Name similarity — check if either contains the other or share significant words
      const itemWords = itemName.split(/\s+/).filter(w => w.length > 2);
      const nameMatch = txnName.includes(itemName) || itemName.includes(txnName) ||
        itemWords.some(w => txnName.includes(w));
      if (!nameMatch) return;

      let score = 1;

      // Amount proximity — within 20% of amountMin
      if (item.amountMin != null && item.amountMin > 0) {
        const diff = Math.abs(txnAmt - item.amountMin) / item.amountMin;
        if (diff > 0.3) return; // too different
        score += diff < 0.05 ? 3 : diff < 0.15 ? 2 : 1;
      }

      // Date proximity — within 5 days of recurringDay
      if (item.recurringDay && txnDate) {
        const dayDiff = Math.abs(txnDate - parseInt(item.recurringDay));
        if (dayDiff <= 2) score += 3;
        else if (dayDiff <= 5) score += 1;
      }

      if (score > bestScore) { bestScore = score; bestMatch = item; }
    });

    if (bestMatch && bestScore >= 2) {
      linkTxnToRecurringItem(txn.id, bestMatch.id);
    }
  }

  function unlinkTxnFromRecurringItem(txnId, itemId) {
    const next = recurringItems.map(r => r.id === itemId
      ? { ...r, linkedTxnIds: (r.linkedTxnIds||[]).filter(id => id !== txnId) }
      : r);
    setRecurringItems(next);
    scheduleSaveRef.current?.({ recurringItems: next });
    setTransactions(prev => prev.map(t => t.id === txnId ? { ...t, recurringItemId: null } : t));
    api.updateTransaction(txnId, { recurringItemId: null }).catch(console.error);
  }
  function openNewRecurringItem() {
    setEditingRecurringItem(null);
    setRiForm({ name:"", amountMin:"", amountMax:"", recurringDay:"", recurringFreq:"monthly", recurringStart:"", categoryId:"", accountId:"", type:"expense" });
    setRiSearch(""); setRiSearchResults([]);
    setRecurringItemModal(true);
  }
  function openEditRecurringItem(item) {
    setEditingRecurringItem(item);
    // Compute average from linked transactions if no amount set yet
    const linkedAmts = (item.linkedTxnIds||[])
      .map(id => transactions.find(t => t.id === id))
      .filter(Boolean)
      .map(t => Math.abs(t.amount));
    const avg = linkedAmts.length > 0
      ? (linkedAmts.reduce((a,b) => a+b, 0) / linkedAmts.length).toFixed(2)
      : null;
    const prefilledAmount = item.amountMin != null ? String(item.amountMin) : (avg || "");
    setRiForm({ name:item.name||"", amountMin:prefilledAmount, amountMax:prefilledAmount, recurringDay:item.recurringDay||"", recurringFreq:item.recurringFreq||"monthly", recurringStart:item.recurringStart||"", categoryId:item.categoryId||"", accountId:item.accountId||"", type:item.type||"expense" });
    setRiSearch(""); setRiSearchResults([]);
    setRecurringItemModal(true);

    // Fetch any linked transactions not yet in local state
    const linkedIds = item.linkedTxnIds||[];
    const missingIds = linkedIds.filter(id => !transactions.find(t => t.id === id));
    if (missingIds.length > 0) {
      // Load a large batch and pick out the ones we need by ID
      api.loadTransactions({ limit: 1000, offset: 0 })
        .then(r => {
          const found = (r.transactions||[]).filter(t => missingIds.includes(t.id));
          if (found.length > 0) {
            setTransactions(prev => {
              const existingIds = new Set(prev.map(t => t.id));
              return [...prev, ...found.filter(t => !existingIds.has(t.id))];
            });
          }
        })
        .catch(console.error);
    }
  }
  async function searchTxnsForRI() {
    if (!riSearch.trim()) return;
    setRiSearchLoading(true);
    try {
      const searchLower = riSearch.trim().toLowerCase();

      // Fetch all matching transactions directly from the server — no pagination limit
      // This ensures results are complete regardless of how many txns are loaded locally
      const pages = await Promise.all([
        api.loadTransactions({ limit: 500, offset: 0,   search: riSearch.trim() }),
        api.loadTransactions({ limit: 500, offset: 500, search: riSearch.trim() }),
      ]);
      const serverTxns = pages.flatMap(p => p.transactions || []);

      // Also check local state to catch any unsaved/in-memory transactions
      const localOnly = transactions.filter(t => {
        if (serverTxns.find(s => s.id === t.id)) return false; // already in server results
        const m = (t.merchant||"").toLowerCase();
        const n = (t.name||"").toLowerCase();
        return m.includes(searchLower) || n.includes(searchLower);
      });

      const merged = [...serverTxns, ...localOnly]
        .sort((a,b) => (b.date||"").localeCompare(a.date||""));

      setRiSearchResults(merged.slice(0, 100));
    } catch(e) { showToast("Search failed: " + e.message); }
    setRiSearchLoading(false);
  }
  function saveRecurringItemForm() {
    if (!riForm.name.trim()) return;
    const item = {
      id: editingRecurringItem ? editingRecurringItem.id : "ri"+Date.now(),
      name: riForm.name.trim(),
      amountMin: riForm.amountMin !== "" ? parseFloat(riForm.amountMin) : null,
      amountMax: riForm.amountMax !== "" ? parseFloat(riForm.amountMax) : null,
      recurringDay: parseInt(riForm.recurringDay)||null,
      recurringFreq: riForm.recurringFreq||"monthly",
      recurringStart: riForm.recurringStart||null,
      categoryId: riForm.categoryId||null,
      accountId: riForm.accountId||null,
      type: riForm.type||"expense",
      linkedTxnIds: editingRecurringItem ? ((recurringItems.find(r=>r.id===editingRecurringItem.id)||editingRecurringItem).linkedTxnIds||[]) : [],
    };
    saveRecurringItem(item);
    setRecurringItemModal(false);
    setEditingRecurringItem(null);
    showToast(editingRecurringItem ? "Updated" : "Recurring item added");
  }

  function toggleRecurring(id) {
    setTransactions(p=>p.map(t=>{
      if(t.id!==id) return t;
      const on=!t.recurring;
      const autoDay=t.date?parseInt(t.date.split("-")[2]):null;
      const updated = {...t, recurring:on, recurringDay:on?(t.recurringDay||autoDay):null,
        recurringFreq: on?(t.recurringFreq||"monthly"):null,
        recurringStart: on?(t.recurringStart||t.date||null):null};
      api.updateTransaction(id, { recurring: updated.recurring, recurringDay: updated.recurringDay, recurringFreq: updated.recurringFreq, recurringStart: updated.recurringStart }).catch(console.error);
      return updated;
    }));
  }
  function updateRecurringDay(id,day) {
    const val = parseInt(day) || null;
    setTransactions(p=>p.map(t=>t.id===id?{...t,recurringDay:val}:t));
    api.updateTransaction(id, { recurringDay: val }).catch(console.error);
  }
  function openAddTxn() {
    setTxnForm({merchant:"",amount:"",date:today.toISOString().slice(0,10),categoryId:"",accountId:"",sign:"-1"});
    setModal("addTxn");
  }
  function saveManualTxn() {
    if(!txnForm.merchant.trim()||!txnForm.amount) return;
    const newTxn = {id:"m"+Date.now(),date:txnForm.date,merchant:txnForm.merchant.trim(),name:"",
      amount:parseFloat(txnForm.amount)*parseInt(txnForm.sign),categoryId:txnForm.categoryId||null,
      accountId:txnForm.accountId||null,recurring:false,recurringDay:null,
      type:txnForm.sign==="-1"?"expense":"income"};
    setTransactions(p=>[newTxn,...p]);
    api.createTransaction(newTxn).catch(console.error);
    setModal(null); showToast("Transaction added");
  }


  return {
    startRename,
    saveRename,
    updateTxnName,
    updateTxnType,
    updateTxnCat,
    updateTxnAcct,
    updateTxnNotes,
    deleteTxn,
    saveRecurringItem,
    deleteRecurringItem,
    linkTxnToRecurringItem,
    autoLinkTransaction,
    unlinkTxnFromRecurringItem,
    openNewRecurringItem,
    openEditRecurringItem,
    saveRecurringItemForm,
    toggleRecurring,
    updateRecurringDay,
    openAddTxn,
    saveManualTxn,
    runAutoCategorize,
    confirmCatSuggestions,
    searchTxnsForRI,
  };
}
