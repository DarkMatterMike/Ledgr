// Shared constants and utility functions used across the app

export const today        = new Date();
export const pad          = n => String(n).padStart(2,"0");
export const fmt          = n => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);
export const cap          = s => s ? s.charAt(0).toUpperCase()+s.slice(1) : "";
export const currentMonth = `${today.getFullYear()}-${pad(today.getMonth()+1)}`;
export const NAV = [
  { id:"dashboard",    icon:"◈", label:"Dashboard"    },
  { id:"transactions", icon:"⇅", label:"Transactions" },
  { id:"budgets",      icon:"◉", label:"Budgets"      },
  { id:"accounts",     icon:"▣", label:"Accounts"     },
  { id:"rules",        icon:"◎", label:"Rules"        },
  { id:"calendar",     icon:"▦", label:"Calendar"     },
  { id:"ai",           icon:"✦", label:"Ask AI"       },
  { id:"analytics",   icon:"◎", label:"Analytics"    },
];
export function daysInMonth(y,m) { return new Date(y,m,0).getDate(); }
export function daysLeft()        { return daysInMonth(today.getFullYear(), today.getMonth()+1) - today.getDate(); }
