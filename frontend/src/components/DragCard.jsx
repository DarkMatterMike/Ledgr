import { useState } from 'react';

function DragCard({ id, children, onMoveUp, onMoveDown, canMoveUp, canMoveDown, editMode }) {
  return (
    <div
      data-card-id={id}
      style={{ position: 'relative', borderRadius: 'var(--r-lg)' }}
      className={editMode ? 'dash-edit-card' : ''}
    >
      {editMode && (
        <div className="dash-reorder-btns">
          <button className="dash-reorder-btn" disabled={!canMoveUp} onClick={onMoveUp} title="Move up">↑</button>
          <button className="dash-reorder-btn" disabled={!canMoveDown} onClick={onMoveDown} title="Move down">↓</button>
        </div>
      )}
      {children}
    </div>
  );
}

function useDashboardColumns(defaultCols, scheduleSaveRef, setDefaultCols) {
  const DEFAULT_COLS = { col1:["spending","balances"], col2:["budget","action"], col3:["goals","upcoming"] };

  // Normalize: accept old flat array or new col object
  function normalize(val) {
    if (!val) return DEFAULT_COLS;
    if (Array.isArray(val)) {
      // Migrate flat array into 3 columns
      const all = val.filter(Boolean);
      const third = Math.ceil(all.length / 3);
      return {
        col1: all.slice(0, third),
        col2: all.slice(third, third * 2),
        col3: all.slice(third * 2),
      };
    }
    if (val.col1 || val.col2 || val.col3) return { col1:val.col1||[], col2:val.col2||[], col3:val.col3||[] };
    return DEFAULT_COLS;
  }

  const [cols, setCols] = useState(() => normalize(defaultCols));
  const needsMigrationRef = useRef(Array.isArray(defaultCols));
  const prevRef = useRef(JSON.stringify(defaultCols));
  const key = JSON.stringify(defaultCols);
  if (key !== prevRef.current) {
    prevRef.current = key;
    const normalized = normalize(defaultCols);
    setCols(normalized);
    // If the incoming value was a flat array, immediately persist the normalized format
    if (Array.isArray(defaultCols)) {
      scheduleSaveRef?.current?.({ dashboardCardOrder: normalized });
    }
  }

  function moveItem(colKey, idx, dir) {
    setCols(prev => {
      const col = [...(prev[colKey]||[])];
      const swap = idx + dir;
      if (swap < 0 || swap >= col.length) return prev;
      [col[idx], col[swap]] = [col[swap], col[idx]];
      const next = { ...prev, [colKey]: col };
      scheduleSaveRef?.current?.({ dashboardCardOrder: next });
      setDefaultCols?.(next);
      return next;
    });
  }

  function moveToCol(id, fromCol, toCol) {
    setCols(prev => {
      const from = (prev[fromCol]||[]).filter(x => x !== id);
      const to = [...(prev[toCol]||[]), id];
      const next = { ...prev, [fromCol]: from, [toCol]: to };
      scheduleSaveRef?.current?.({ dashboardCardOrder: next });
      setDefaultCols?.(next);
      return next;
    });
  }

  return { cols, moveItem, moveToCol };
}

export { DragCard, useDashboardColumns };
export default DragCard;
