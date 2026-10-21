"use client";
import { useEffect, useState } from "react";

/** Measure elapsed time monotonically, using the server's deadline rather than the phone's wall clock. */
export function useRaidCountdown(closesAt?: number | null, serverNow?: number) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!closesAt || serverNow === undefined) { setSeconds(0); return; }
    const started = performance.now(), remaining = closesAt - serverNow;
    const update = () => setSeconds(Math.max(0, Math.ceil((remaining - (performance.now() - started)) / 1000)));
    update(); const timer = setInterval(update, 100);
    return () => clearInterval(timer);
  }, [closesAt, serverNow]);
  return seconds;
}
