/**
 * constants.js
 * Application-wide constants and navigation config for Lumen.
 * Single source of truth for the app's page routing and layout values.
 */

export const CAT_COLORS = [
  "#00d4ff","#00e676","#ff4d6d","#fbbf24","#a78bfa",
  "#f97316","#06b6d4","#84cc16","#ec4899","#14b8a6",
  "#8b5cf6","#ef4444","#22c55e","#3b82f6","#f59e0b",
];

export const DAYS_OF_WEEK = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// Right column layout constants (used by two-column page layouts)
export const PAGE_RIGHT_COL_W  = 340;
export const PAGE_COL_GAP      = 10;
export const SHARED_LEFT_WIDTH = `calc(100% - ${PAGE_RIGHT_COL_W + PAGE_COL_GAP}px)`;

export const INSTALL_KEY = "ledgr_install_prompt_dismissed";

export function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }
export function getDaysLeft() {
  const now = new Date();
  return daysInMonth(now.getFullYear(), now.getMonth() + 1) - now.getDate();
}

/**
 * LUMEN_NAV — canonical sidebar navigation for the desktop rail.
 * Settings is accessed via the avatar button at the bottom, not this list.
 */
export const LUMEN_NAV = [
  { id: "dashboard",    icon: "◈", label: "Dashboard"    },
  { id: "transactions", icon: "⇅", label: "Transactions" },
  { id: "budgets",      icon: "◉", label: "Budgets"      },
  { id: "accounts",     icon: "▣", label: "Accounts"     },
  { id: "calendar",     icon: "▦", label: "Calendar"     },
  { id: "analytics",    icon: "◎", label: "Analytics"    },
];

// Keep NAV alias for Sidebar.jsx and utils/globals.js compatibility
export const NAV = LUMEN_NAV;

/**
 * LUMEN_BOTTOM_NAV — mobile bottom nav items.
 * __more__ opens the slide-up sheet with Settings, Accounts, and admin items.
 */
export const LUMEN_BOTTOM_NAV = [
  { id: "dashboard",    label: "Home"     },
  { id: "transactions", label: "Txns"     },
  { id: "budgets",      label: "Budgets"  },
  { id: "calendar",     label: "Calendar" },
  { id: "__more__",     label: "More"     },
];
