import { useState, useEffect } from 'react';

function useIsMobile() {
  const check = () => (
    navigator.maxTouchPoints > 1 ||
    ('ontouchstart' in window) ||
    window.matchMedia("(pointer: coarse)").matches ||
    window.innerWidth < 768
  );
  const [mobile, setMobile] = useState(check);
  useEffect(() => {
    const fn = () => setMobile(check());
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
}

export default useIsMobile;
