/**
 * context/AppContext.js
 *
 * Central application context — eliminates prop drilling between
 * AppInner and the extracted page components.
 *
 * Organized into namespaces so pages only destructure what they need:
 *
 *   data     — raw application data (transactions, accounts, etc.)
 *   derived  — computed values (catMap, spentByCat, filteredTxns, etc.)
 *   ui       — UI state (view, modal, isMobile, selectedMonth, theme)
 *   user     — current user profile and access level
 *   actions  — state mutation functions and navigation
 *   utils    — pure helpers (fmt, needsReview, monthLabel)
 *
 * Usage in any page component:
 *   import { useAppContext } from '../context/AppContext';
 *   const { data, actions, ui } = useAppContext();
 */

import { createContext, useContext } from 'react';

export const AppContext = createContext(null);

/**
 * Custom hook for consuming the app context.
 * Throws a descriptive error if called outside AppProvider.
 */
export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error(
      'useAppContext must be called within an AppContext.Provider. ' +
      'Wrap your component tree in AppInner.'
    );
  }
  return ctx;
}
