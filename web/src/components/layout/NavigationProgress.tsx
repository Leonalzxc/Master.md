'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function NavigationProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const prevPath = useRef(pathname);

  useEffect(() => {
    if (pathname === prevPath.current) return;
    prevPath.current = pathname;

    // Show bar and animate to 90%
    setVisible(true);
    setWidth(0);

    // Start progressing
    let w = 0;
    function step() {
      w = w < 30 ? w + 8 : w < 60 ? w + 4 : w < 85 ? w + 1.5 : w + 0.3;
      if (w > 90) w = 90;
      setWidth(w);
      if (w < 90) rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);

    // Complete after a brief delay (page has loaded)
    timerRef.current = setTimeout(() => {
      setWidth(100);
      setTimeout(() => setVisible(false), 250);
    }, 350);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: 3,
        width: `${width}%`,
        background: 'linear-gradient(90deg, var(--accent), #38bdf8)',
        zIndex: 9999,
        transition: width === 100 ? 'width 200ms ease, opacity 250ms 200ms' : 'width 80ms linear',
        opacity: width === 100 ? 0 : 1,
        borderRadius: '0 2px 2px 0',
        boxShadow: '0 0 8px var(--accent-glow)',
      }}
    />
  );
}
