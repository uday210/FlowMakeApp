"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Slim top-of-screen progress bar that animates on every route change.
 * Usage: mount once inside the layout (AppShell renders it).
 */
export default function NavigationProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneRef = useRef(false);

  // Called by AppShell nav buttons via the exported helper
  useEffect(() => {
    const handler = () => start();
    window.addEventListener("nav:start", handler);
    return () => window.removeEventListener("nav:start", handler);
  }, []);

  // When pathname changes, navigation is done → complete the bar
  const prevPathname = useRef(pathname);
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      complete();
    }
  }, [pathname]);

  function start() {
    doneRef.current = false;
    setVisible(true);
    setWidth(0);

    // ramp quickly to ~60%, then slow down
    setTimeout(() => setWidth(60), 10);
    timerRef.current = setTimeout(() => {
      if (!doneRef.current) setWidth(80);
    }, 400);
  }

  function complete() {
    if (timerRef.current) clearTimeout(timerRef.current);
    doneRef.current = true;
    setWidth(100);
    setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 300);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 z-[9999] h-[3px] rounded-r-full transition-all"
      style={{
        width: `${width}%`,
        transitionDuration: width === 100 ? "200ms" : "400ms",
        transitionTimingFunction: "ease-out",
        background: "linear-gradient(90deg, #7c3aed, #ec4899, #38bdf8)",
        boxShadow: "0 0 12px #ec4899aa",
      }}
    />
  );
}

/** Call this before router.push() in any nav button to trigger the bar */
export function startNavProgress() {
  window.dispatchEvent(new Event("nav:start"));
}
