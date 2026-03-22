// src/components/ambience-engine.tsx
"use client";

import { useEffect, useRef } from "react";
import { getCurrentPeriod, type Period } from "@/lib/radio";

export function AmbienceEngine({ initialPeriod }: { initialPeriod: Period }) {
  const currentRef = useRef<Period>(initialPeriod);

  useEffect(() => {
    // Set initial period immediately (matches SSR)
    document.documentElement.setAttribute("data-period", initialPeriod);

    const interval = setInterval(() => {
      const newPeriod = getCurrentPeriod();
      if (newPeriod !== currentRef.current) {
        currentRef.current = newPeriod;
        document.documentElement.setAttribute("data-period", newPeriod);
      }
    }, 60_000); // check every minute

    return () => clearInterval(interval);
  }, [initialPeriod]);

  return null; // no visual output
}
