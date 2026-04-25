// demoData.js — Realistic fake data for the Ledgr demo mode
// Loaded when ?demo=true is in the URL. No API calls are made.

const today = new Date();
const fmt = (y,m,d) => `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
const thisYear = today.getFullYear();
const thisMon  = today.getMonth() + 1;
const lastMon  = thisMon === 1 ? 12 : thisMon - 1;
const lastMonY = thisMon === 1 ? thisYear - 1 : thisYear;

export const DEMO_CATEGORIES = [
  { id:"cat_food",      name:"Groceries",       color:"#00d4ff", icon:"🛒", monthlyLimit:600  },
  { id:"cat_dining",    name:"Dining Out",      color:"#ff6b35", icon:"🍽️", monthlyLimit:400  },
  { id:"cat_transport", name:"Transport",       color:"#ffab40", icon:"🚗", monthlyLimit:300  },
  { id:"cat_subs",      name:"Subscriptions",   color:"#7c4dff", icon:"📱", monthlyLimit:100  },
  { id:"cat_health",    name:"Health",          color:"#00e676", icon:"💊", monthlyLimit:200  },
  { id:"cat_shopping",  name:"Shopping",        color:"#ff4081", icon:"🛍️", monthlyLimit:500  },
  { id:"cat_income",    name:"Income",          color:"#00e676", icon:"💰", monthlyLimit:null },
  { id:"cat_utilities", name:"Utilities",       color:"#90a4ae", icon:"💡", monthlyLimit:250  },
  { id:"cat_rent",      name:"Rent",            color:"#ef5350", icon:"🏠", monthlyLimit:2000 },
  { id:"cat_savings",   name:"Savings",         color:"#26c6da", icon:"🏦", monthlyLimit:null },
];

export const DEMO_ACCOUNTS = [
  { id:"acct_chk",  name:"Chase Checking",     type:"checking",  balance:4821.33, institution:"Chase",       plaidItemId:"item_chase", mask:"4821" },
  { id:"acct_sav",  name:"Chase Savings",      type:"savings",   balance:12450.00,institution:"Chase",       plaidItemId:"item_chase", mask:"2290" },
  { id:"acct_cc",   name:"Chase Sapphire",     type:"credit",    balance:-1243.87,institution:"Chase",       plaidItemId:"item_chase", mask:"9823" },
  { id:"acct_cap",  name:"Capital One Quicksilver", type:"credit",balance:-342.19, institution:"Capital One", plaidItemId:"item_cap1",  mask:"5519" },
];

const tx = (id, date, name, merchant, amount, catId, acctId, recurring=false) => ({
  id, date, name, merchant, amount, categoryId:catId, accountId:acctId,
  type: amount > 0 ? "income" : "expense",
  pending: false, reviewed: true, recurring,
  userCategorized: true, source:"demo",
  fingerprint: `${date}__${amount}__${name.toLowerCase().replace(/[^a-z0-9]/g," ").trim()}`,
});

// Generate 4 months of realistic transactions
const makeTxns = () => {
  const txns = [];
  let counter = 1;
  const id = () => `demo_txn_${counter++}`;

  const months = [];
  for (let i = 3; i >= 0; i--) {
    let m = thisMon - i; let y = thisYear;
    if (m <= 0) { m += 12; y -= 1; }
    months.push({ y, m });
  }

  months.forEach(({ y, m }, mi) => {
    // Income — 1st and 15th
    txns.push(tx(id(), fmt(y,m,1),  "Direct Deposit", "Employer Payroll", 3200, "cat_income", "acct_chk"));
    txns.push(tx(id(), fmt(y,m,15), "Direct Deposit", "Employer Payroll", 3200, "cat_income", "acct_chk"));

    // Rent — 1st
    txns.push(tx(id(), fmt(y,m,1),  "Online Payment - Rent", "Landlord", -1850, "cat_rent", "acct_chk", true));

    // Subscriptions — recurring
    txns.push(tx(id(), fmt(y,m,3),  "Netflix",          "Netflix",     -17.99,  "cat_subs", "acct_cc", true));
    txns.push(tx(id(), fmt(y,m,5),  "Spotify",          "Spotify",     -11.99,  "cat_subs", "acct_cc", true));
    txns.push(tx(id(), fmt(y,m,8),  "Amazon Prime",     "Amazon",      -15.99,  "cat_subs", "acct_cc", true));
    txns.push(tx(id(), fmt(y,m,12), "ChatGPT Plus",     "OpenAI",      -20.00,  "cat_subs", "acct_cc", true));

    // Utilities
    txns.push(tx(id(), fmt(y,m,7),  "Electric Bill",    "Con Edison",  -94 - Math.round(Math.random()*20), "cat_utilities", "acct_chk", true));
    txns.push(tx(id(), fmt(y,m,10), "Internet - Xfinity","Xfinity",    -79.99,  "cat_utilities", "acct_chk", true));

    // Groceries — weekly
    [4,10,16,22,28].forEach((d, i) => {
      if (mi < 3 || d <= today.getDate()) {
        const amt = -(80 + Math.round(Math.random()*60));
        const stores = ["Whole Foods Market","Trader Joe\'s","Kroger","Safeway","Costco"];
        txns.push(tx(id(), fmt(y,m,d), stores[i % stores.length], stores[i % stores.length], amt, "cat_food", "acct_cc"));
      }
    });

    // Dining
    const dining = [
      ["Chipotle","Chipotle",-14.75],["Starbucks","Starbucks",-6.85],
      ["DoorDash","DoorDash",-38.20],["Local Kitchen","Local Kitchen",-52.40],
      ["Sweetgreen","Sweetgreen",-16.25],["Uber Eats","Uber Eats",-41.10],
    ];
    dining.forEach(([n,m,a], i) => {
      const d = 3 + i * 4;
      if (mi < 3 || d <= today.getDate())
        txns.push(tx(id(), fmt(y,m,Math.min(d,28)), n, m, a + Math.round(Math.random()*5 - 2), "cat_dining", "acct_cc"));
    });

    // Transport
    [2,9,17,24].forEach(d => {
      if (mi < 3 || d <= today.getDate()) {
        const amt = -(12 + Math.round(Math.random()*25));
        txns.push(tx(id(), fmt(y,m,d), "Uber", "Uber", amt, "cat_transport", "acct_cc"));
      }
    });
    if (mi < 3 || 20 <= today.getDate())
      txns.push(tx(id(), fmt(y,m,20), "Shell Gas Station", "Shell", -58.40, "cat_transport", "acct_cc"));

    // Shopping (variable)
    const shop = [["Amazon","Amazon",-67.43],["Target","Target",-112.88],["Apple Store","Apple",-29.99]];
    shop.forEach(([n,m,a], i) => {
      const d = 6 + i * 8;
      if (mi < 3 || d <= today.getDate())
        txns.push(tx(id(), fmt(y,m,Math.min(d,28)), n, m, a, "cat_shopping", "acct_cc"));
    });

    // Health
    if (mi < 3 || 14 <= today.getDate())
      txns.push(tx(id(), fmt(y,m,14), "Planet Fitness", "Planet Fitness", -25, "cat_health", "acct_cc", true));
    if ((mi === 1 || mi === 3) && (mi < 3 || 18 <= today.getDate()))
      txns.push(tx(id(), fmt(y,m,18), "CVS Pharmacy", "CVS", -34.72, "cat_health", "acct_cc"));

    // Savings transfer
    if (mi < 3 || 16 <= today.getDate())
      txns.push(tx(id(), fmt(y,m,16), "Transfer to Savings", "Chase", -500, "cat_savings", "acct_chk", true));
  });

  return txns.sort((a,b) => b.date.localeCompare(a.date));
};

export const DEMO_TRANSACTIONS = makeTxns();

export const DEMO_RULES = [
  { id:"rule_netflix",  pattern:"netflix",    matchType:"contains", categoryId:"cat_subs",      enabled:true, source:"manual" },
  { id:"rule_spotify",  pattern:"spotify",    matchType:"contains", categoryId:"cat_subs",      enabled:true, source:"manual" },
  { id:"rule_uber",     pattern:"uber",       matchType:"contains", categoryId:"cat_transport",  enabled:true, source:"manual" },
  { id:"rule_amazon",   pattern:"amazon",     matchType:"contains", categoryId:"cat_shopping",  enabled:true, source:"manual" },
  { id:"rule_wholefd",  pattern:"whole foods",matchType:"contains", categoryId:"cat_food",       enabled:true, source:"manual" },
];

export const DEMO_GOALS = [
  { id:"goal_1", title:"Emergency Fund",  targetAmount:10000, savedAmount:4200,  deadline:"2025-12-31", periodAmount:500,  period:"month", startDate:"2025-01-01", assignedTxnIds:[] },
  { id:"goal_2", title:"Europe Trip",     targetAmount:3500,  savedAmount:800,   deadline:"2026-06-01", periodAmount:250,  period:"month", startDate:"2025-09-01", assignedTxnIds:[] },
  { id:"goal_3", title:"New MacBook",     targetAmount:2500,  savedAmount:2500,  deadline:"2025-03-01", periodAmount:500,  period:"month", startDate:"2024-10-01", assignedTxnIds:[] },
];

export const DEMO_USER_PROFILE = {
  name: "Demo User",
  email: "demo@ledgr.app",
  manualAssets: [{ id:"a1", name:"401(k)", value:28400 }, { id:"a2", name:"Car", value:15000 }],
  manualLiabilities: [{ id:"l1", name:"Student Loan", value:18200 }],
};