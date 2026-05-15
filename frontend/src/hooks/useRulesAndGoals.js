import { useEffect } from 'react';
import * as api from "../api.js";

export function useRulesAndGoals({
  rules, setRules,
  transactions, setTransactions,
  categories, accounts,
  showToast,
  selectedTxns, setSelectedTxns,
  filteredTxns,
  goals, setGoals,
  budgetKebabId, setBudgetKebabId,
  setRulePrompt, setTypeRulePrompt,
  scheduleSaveRef,
}) {
  /* -- Rules -- */
  function applyRules(txns, rs, opts = {}) {
    if (!rs?.length) return txns;
    const { onlyUncategorized = false } = opts;
    const manualRules  = rs.filter(r => r.source !== "ai");
    const aiRules      = rs.filter(r => r.source === "ai");
    const orderedRules = [...manualRules, ...aiRules];
    return txns.map(t => {
      if (t.userCategorized) return t; // never touch manually-categorized txns
      if (onlyUncategorized && t.categoryId) return t;
      const mer = (t.merchant || t.name || "").toLowerCase().trim();
      for (const r of orderedRules) {
        if (!r.enabled) continue;
        const pat = r.pattern.toLowerCase().trim();
        if (!pat) continue;
        const match = r.matchType === "exact"  ? mer === pat
                    : r.matchType === "starts" ? mer.startsWith(pat)
                    : mer.includes(pat);
        if (match) {
          const updates = {};
          if (r.categoryId)   updates.categoryId = r.categoryId;
          if (r.typeOverride) { updates.type = r.typeOverride; updates.reviewed = true; }
          if (Object.keys(updates).length) return { ...t, ...updates };
        }
      }
      return t;
    });
  }
  function toggleSelectTxn(id) {
    setSelectedTxns(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function selectAllVisible() { setSelectedTxns(new Set(filteredTxns.map(t => t.id))); }
  function clearSelection()   { setSelectedTxns(new Set()); }
  function bulkSetCategory(catId) {
    const ids = [...selectedTxns];
    setTransactions(p => p.map(t => selectedTxns.has(t.id) ? {...t, categoryId:catId||null, reviewed: catId ? true : t.reviewed, userCategorized: !!catId} : t));
    api.bulkUpdateTransactions(ids, { categoryId: catId || null, reviewed: !!catId, userCategorized: !!catId }).catch(console.error);
    showToast(`Updated ${selectedTxns.size} transaction${selectedTxns.size!==1?"s":""}`);
    clearSelection();
    refreshSummary();
  }
  function bulkSetType(type) {
    const ids = [...selectedTxns];
    const autoReviewed = ["income","transfer","reimbursement"].includes(type);
    setTransactions(p => p.map(t => selectedTxns.has(t.id) ? {...t, type, reviewed: autoReviewed ? true : t.reviewed} : t));
    api.bulkUpdateTransactions(ids, { type, ...(autoReviewed ? { reviewed: true } : {}) }).catch(console.error);
    showToast(`Updated ${selectedTxns.size} transaction${selectedTxns.size!==1?"s":""}`);
    clearSelection();
    refreshSummary();
  }
  function bulkSetAccount(accountId) {
    const ids = [...selectedTxns];
    const val = accountId || null;
    setTransactions(p => p.map(t => selectedTxns.has(t.id) ? {...t, accountId: val} : t));
    api.bulkUpdateTransactions(ids, { accountId: val }).catch(console.error);
    showToast(`Updated ${selectedTxns.size} transaction${selectedTxns.size!==1?"s":""}`);
    clearSelection();
  }
  function bulkMarkReviewed(reviewed) {
    const ids = [...selectedTxns];
    setTransactions(p => p.map(t => selectedTxns.has(t.id) ? {...t, reviewed} : t));
    api.bulkUpdateTransactions(ids, { reviewed }).catch(console.error);
    showToast(`Marked ${selectedTxns.size} transaction${selectedTxns.size!==1?"s":""} ${reviewed?"reviewed":"unreviewed"}`);
    clearSelection();
  }
  function bulkDelete() {
    const removed = transactions.filter(t => selectedTxns.has(t.id));
    const removedIds = removed.map(t => t.id);
    setTransactions(p => p.filter(t => !selectedTxns.has(t.id)));
    api.bulkDeleteTransactions(removedIds).catch(console.error);
    showUndoToast(`Deleted ${removed.length} transaction${removed.length!==1?"s":""}`, () => {
      setTransactions(p => [...p, ...removed]);
      Promise.all(removed.map(t => api.createTransaction(t))).catch(console.error);
    });
    clearSelection();
  }
  function promptSaveRule(txn, categoryId) {
    const mer=(txn.merchant||txn.name||"").toLowerCase().trim();
    if (!rules.some(r=>r.pattern.toLowerCase().trim()===mer)&&mer&&categoryId)
      setRulePrompt({txnId:txn.id,merchant:txn.merchant||txn.name,categoryId});
  }
  function confirmSaveRule() {
    if (!rulePrompt) return;
    const rule = { id:"r"+Date.now(), pattern:rulePrompt.merchant, matchType:"contains", categoryId:rulePrompt.categoryId, enabled:true, createdAt:Date.now() };
    setRules(p => [...p, rule]);
    api.createRule(rule).catch(console.error);
    setRulePrompt(null); showToast("Rule saved");
  }
  function confirmTypeRule() {
    if (!typeRulePrompt) return;
    const { merchant, type } = typeRulePrompt;
    const pattern = merchant.toLowerCase();
    const newRule = { id:"r"+Date.now(), pattern:merchant, matchType:"contains", typeOverride:type, categoryId:null, enabled:true, createdAt:Date.now() };
    setRules(p => {
      const filtered = p.filter(r => !(r.pattern.toLowerCase() === pattern && r.typeOverride));
      // Delete any replaced rule from the server
      filtered.length < p.length && p.filter(r => r.pattern.toLowerCase() === pattern && r.typeOverride)
        .forEach(r => api.deleteRule(r.id).catch(console.error));
      return [...filtered, newRule];
    });
    api.createRule(newRule).catch(console.error);
    setTypeRulePrompt(null);
    showToast(`Rule saved — "${merchant}" will always be ${type}`);
  }
  function saveRule(rule) {
    const isNew = !rules.find(r => r.id === rule.id);
    setRules(p => [...p.filter(r => r.id !== rule.id), rule]);
    if (isNew) api.createRule(rule).catch(console.error);
    else       api.updateRule(rule.id, rule).catch(console.error);
    showToast("Rule saved");
  }
  function deleteRule(id)  {
    const rule = rules.find(r => r.id === id);
    setRules(p => p.filter(r => r.id !== id));
    api.deleteRule(id).catch(console.error);
    showUndoToast("Rule deleted", () => {
      setRules(p => [...p, rule]);
      api.createRule(rule).catch(console.error);
    });
  }
  function toggleRule(id)  {
    setRules(p => p.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, enabled: !r.enabled };
      api.updateRule(id, { enabled: updated.enabled }).catch(console.error);
      return updated;
    }));
  }


  /* -- Goals -- */
  function saveGoal(goal) {
    const isNew = !goals.find(g => g.id === goal.id);
    const next = isNew
      ? [...goals, { ...goal, id: "g" + Date.now(), createdAt: Date.now(), savedAmount: 0, assignedTxnIds: [] }]
      : goals.map(g => g.id === goal.id ? { ...g, ...goal } : g);
    setGoals(next);
    scheduleSaveRef.current?.({ goals: next });
    showToast(isNew ? "Goal created" : "Goal updated");
  }
  function deleteGoal(id) {
    const next = goals.filter(g => g.id !== id);
    setGoals(next);
    scheduleSaveRef.current?.({ goals: next });
    showToast("Goal deleted");
  }
  function assignTxnToGoal(txnId, goalId) {
    const next = goals.map(g => {
      const assigned = new Set(g.assignedTxnIds || []);
      if (g.id === goalId) {
        assigned.add(txnId);
        const totalSaved = transactions
          .filter(t => assigned.has(t.id))
          .reduce((s, t) => s + Math.abs(t.amount), 0);
        return { ...g, assignedTxnIds: [...assigned], savedAmount: totalSaved };
      }
      // Remove from any other goal
      if (assigned.has(txnId)) {
        assigned.delete(txnId);
        const totalSaved = transactions
          .filter(t => assigned.has(t.id))
          .reduce((s, t) => s + Math.abs(t.amount), 0);
        return { ...g, assignedTxnIds: [...assigned], savedAmount: totalSaved };
      }
      return g;
    });
    setGoals(next);
    scheduleSaveRef.current?.({ goals: next });
    showToast("Transaction assigned to goal");
  }

  useEffect(() => {
    if (!initialized.current || !rules.length) return;
    setTransactions(prev => {
      const next = applyRules(prev, rules, { onlyUncategorized: true });
      const prevMap = Object.fromEntries(prev.map(t => [t.id, t]));
      const changed = next.filter(t => prevMap[t.id] && t.categoryId !== prevMap[t.id].categoryId);
      if (changed.length > 0) {
        // Group by categoryId for efficient bulk updates
        const byCat = {};
        changed.forEach(t => {
          const k = t.categoryId || "__null__";
          if (!byCat[k]) byCat[k] = { ids: [], categoryId: t.categoryId };
          byCat[k].ids.push(t.id);
        });
        Promise.all(Object.values(byCat).map(({ ids, categoryId }) =>
          api.bulkUpdateTransactions(ids, { categoryId, userCategorized: false })
        )).catch(console.error);
      }
      return next;
    });
  }, [rules]);

  useEffect(() => {
    if (!budgetKebabId) return;
    const close = () => setBudgetKebabId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [budgetKebabId]);


  return {
    applyRules, toggleSelectTxn, selectAllVisible, clearSelection,
    bulkSetCategory, bulkSetType, bulkSetAccount, bulkMarkReviewed, bulkDelete,
    promptSaveRule, confirmSaveRule, confirmTypeRule, saveRule, deleteRule, toggleRule,
    saveGoal, deleteGoal, assignTxnToGoal,
  };
}
