"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Ready = Record<string, number>;

// Keeps energy and per-job cooldowns in step with the server. Energy ticks up
// on screen between server checks, so the bar moves smoothly.
type Snap = { energy: number; max: number; lastPointAt: number; regenMs: number };

export function useActionStatus(initial: { energy: number; maxEnergy: number }) {
  const [snap, setSnap] = useState<Snap>(() => ({
    energy: initial.energy,
    max: initial.maxEnergy,
    lastPointAt: Date.now(),
    regenMs: 4000
  }));
  const [crimeReady, setCrimeReady] = useState<Ready>({});
  const [theftReady, setTheftReady] = useState<Ready>({});
  const [jailEnds, setJailEnds] = useState(0);
  const [unreadMail, setUnreadMail] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const refreshing = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const response = await fetch("/api/game/crime", { cache: "no-store" });
      if (!response.ok) return;
      const d = await response.json();
      const at = Date.now();
      const regenMs = Number(d.regenMs) > 0 ? Number(d.regenMs) : 4000;
      setSnap({
        energy: d.energy,
        max: d.maxEnergy,
        regenMs,
        lastPointAt: d.nextEnergyIn > 0 ? at + d.nextEnergyIn * 1000 - regenMs : at
      });
      const toReady = (o: Record<string, number>) =>
        Object.fromEntries(
          Object.entries(o ?? {}).map(([k, secs]) => [k, at + secs * 1000])
        );
      setCrimeReady(toReady(d.crimes));
      setTheftReady(toReady(d.thefts));
      setJailEnds(d.jail > 0 ? at + d.jail * 1000 : 0);
      setUnreadMail(Number(d.unreadMail) || 0);
    } catch {
      /* keep what we have */
    } finally {
      refreshing.current = false;
    }
  }, []);

  useEffect(() => {
    refresh();
    // Re-check with the server now and then so the screen never drifts.
    const t = window.setInterval(refresh, 60000);
    return () => window.clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const gained =
    snap.energy >= snap.max
      ? 0
      : Math.max(0, Math.floor((now - snap.lastPointAt) / snap.regenMs));
  const energy = Math.min(snap.max, snap.energy + gained);
  const nextEnergyIn =
    energy >= snap.max
      ? 0
      : Math.max(
          1,
          Math.ceil((snap.lastPointAt + (gained + 1) * snap.regenMs - now) / 1000)
        );

  // Used right after a job: set the new total but keep the running clock.
  const setEnergy = useCallback((value: number) => {
    setSnap((s) => {
      const t = Date.now();
      const g =
        s.energy >= s.max ? 0 : Math.max(0, Math.floor((t - s.lastPointAt) / s.regenMs));
      const phase = s.energy >= s.max ? t : s.lastPointAt + g * s.regenMs;
      return { ...s, energy: value, lastPointAt: phase };
    });
  }, []);

  const left = (ready: Ready, key: string | number) =>
    Math.max(0, Math.ceil(((ready[String(key)] ?? 0) - now) / 1000));

  return {
    energy,
    maxEnergy: snap.max,
    nextEnergyIn,
    unreadMail,
    crimeLeft: (id: string) => left(crimeReady, id),
    theftLeft: (level: number) => left(theftReady, level),
    jailLeft: Math.max(0, Math.ceil((jailEnds - now) / 1000)),
    setEnergy,
    refresh
  };
}

export const clock = (secs: number) =>
  `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
