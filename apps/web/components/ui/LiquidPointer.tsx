"use client";

import { useEffect } from "react";

/**
 * Feeds the pointer position into --lg-x/--lg-y on <html>, which every
 * .liquid-glass panel's specular highlight reads (globals.css). One
 * listener for the whole app instead of one per panel; writes are batched
 * to one per animation frame.
 *
 * Skipped entirely on touch/coarse pointers (nothing to track, and the
 * vars stay parked off-screen so no highlight shows) and under reduced
 * motion.
 */
export function LiquidPointer() {
  useEffect(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!finePointer.matches || reducedMotion.matches) return;

    const root = document.documentElement;
    let frame = 0;
    let x = 0;
    let y = 0;

    function apply() {
      frame = 0;
      root.style.setProperty("--lg-x", `${x}px`);
      root.style.setProperty("--lg-y", `${y}px`);
    }

    function onMove(e: PointerEvent) {
      x = e.clientX;
      y = e.clientY;
      if (!frame) frame = requestAnimationFrame(apply);
    }

    function onLeave() {
      root.style.removeProperty("--lg-x");
      root.style.removeProperty("--lg-y");
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
      onLeave();
    };
  }, []);

  return null;
}
