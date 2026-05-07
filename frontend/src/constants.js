/**
 * constants.js
 * Application-wide constants, navigation config, and utility functions.
 */

export const CAT_COLORS = [
  "#00d4ff","#00e676","#ff4d6d","#fbbf24","#a78bfa",
  "#f97316","#06b6d4","#84cc16","#ec4899","#14b8a6",
  "#8b5cf6","#ef4444","#22c55e","#3b82f6","#f59e0b",
];

export const DAYS_OF_WEEK = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export const PAGE_RIGHT_COL_W = 340;
export const PAGE_COL_GAP     = 10;
export const SHARED_LEFT_WIDTH = `calc(100% - ${PAGE_RIGHT_COL_W + PAGE_COL_GAP}px)`;

export const INSTALL_KEY = "ledgr_install_prompt_dismissed";

const _today = new Date();
export function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }
export function getDaysLeft() {
  const now = new Date();
  return daysInMonth(now.getFullYear(), now.getMonth() + 1) - now.getDate();
}

export const NAV = [
  { id: "dashboard",    label: "Dashboard"   },
  { id: "transactions", label: "Transactions" },
  { id: "budgets",      label: "Budgets"      },
  { id: "calendar",     label: "Calendar"     },
  { id: "analytics",    label: "Analytics"    },
  { id: "accounts",     label: "Accounts"     },
  { id: "settings",     label: "Settings"     },
  { id: "rules",        label: "Rules"        },
  { id: "ai",           label: "Ask AI"       },
  { id: "portfolio",    label: "Portfolio"    },
];

export const BOTTOM_NAV_ITEMS = [
  { id: "dashboard",    label: "Home"      },
  { id: "transactions", label: "Txns"      },
  { id: "budgets",      label: "Budgets"   },
  { id: "calendar",     label: "Calendar"  },
  { id: "ai",           label: "Ask AI"    },
  { id: "analytics",    label: "Analytics" },
  { id: "__more__",     label: "More"      },
];
