"use client";

import * as React from "react";

/** Mirrors the custom cursor-follow effect from the live techstersol.com
 * invoice-verification template (assets/js scripts inlined on that page). */
export function VerifyCursor() {
  React.useEffect(() => {
    const cursor = document.getElementById("tsv-cursor");
    const ring = document.getElementById("tsv-cursor-ring");

    let cX = 0;
    let cY = 0;
    let rX = 0;
    let rY = 0;
    let frame = 0;

    function onMove(e: MouseEvent) {
      cX = e.clientX;
      cY = e.clientY;
    }

    function animate() {
      rX += (cX - rX) * 0.12;
      rY += (cY - rY) * 0.12;

      if (cursor && ring) {
        cursor.style.left = `${cX}px`;
        cursor.style.top = `${cY}px`;
        ring.style.left = `${rX}px`;
        ring.style.top = `${rY}px`;
      }

      frame = requestAnimationFrame(animate);
    }

    document.addEventListener("mousemove", onMove, { passive: true });
    frame = requestAnimationFrame(animate);

    return () => {
      document.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      <div id="tsv-cursor" />
      <div id="tsv-cursor-ring" />
    </>
  );
}
