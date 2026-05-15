import { useState, useEffect, useRef } from 'react';

function useCountUp(value, duration = 650) {
  const [display, setDisplay] = useState(value);
  const prev    = useRef(value);
  const rafRef  = useRef(null);

  useEffect(() => {
    const from = prev.current;
    const to   = value;
    prev.current = value;
    if (from === to) return;
    const startTime = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return display;
}

export default useCountUp;
