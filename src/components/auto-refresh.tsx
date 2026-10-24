"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-fetches server data periodically while a live state (e.g. a charging session) is in progress. */
export function AutoRefresh({ every = 5000 }: { every?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, every);
    return () => clearInterval(id);
  }, [router, every]);
  return null;
}
