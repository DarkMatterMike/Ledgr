/**
 * utils/globals.js
 * Shared constants and utility functions used across the app.
 * NAV is re-exported from constants.js for a single source of truth.
 */
import { LUMEN_NAV } from '../constants.js';

export const today        = new Date();
export const pad          = n => String(n).padStart(2,"0");
export const fmt          = n => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);
export const cap          = s => s ? s.charAt(0).toUpperCase()+s.slice(1) : "";
export const currentMonth = `${today.getFullYear()}-${pad(today.getMonth()+1)}`;

// Re-export from constants — the canonical Lumen navigation definition
export const NAV = LUMEN_NAV;

export function daysInMonth(y,m) { return new Date(y,m,0).getDate(); }
export function daysLeft()        { return daysInMonth(today.getFullYear(), today.getMonth()+1) - today.getDate(); }
