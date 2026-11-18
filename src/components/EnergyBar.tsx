"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Ready = Record<string, number>;

// Keeps energy and per-job cooldowns in step with the server.
export function useActionStatus(initial: { energy: number; maxEnergy: number }) {
  const [energy, setEnergy] = useState(initial.energy);
  const [maxEnergy, setMaxEnergy] = useState(initial.maxEnergy);
  const [nextEnergyAt, setNextEnergyAt] = useState<number | null>(null);
  const [crimeReady, setCrimeReady] = useState<Ready>({});
  const [theftReady, setTheftReady] = useState<Ready>({});
  const [jailEnds, setJailEnds] = useState(0);
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
      setEnergy(d.energy);
      setMaxEnergy(d.maxEnergy);
      setNextEnergyAt(d.nextEnergyIn > 0 ? at + d.nextEnergyIn * 1000 : null);
      const toReady = (o: Record<string, number>) =>
        Object.fromEntries(
          Object.entries(o ?? {}).map(([k, secs]) => [k, at + secs * 1000])
        );
      setCrimeReady(toReady(d.crimes));
      setTheftReady(toReady(d.thefts));
      setJailEnds(d.jail > 0 ? at + d.jail * 1000 : 0);
    } catch {
      /* keep what we have */
    } finally {
      refreshing.current = false;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // When the next point of energy is due, ask the server what we have now.
  useEffect(() => {
    if (nextEnergyAt !== null && now >= nextEnergyAt) {
      setNextEnergyAt(null);
      refresh();
    }
  }, [now, nextEnergyAt, refresh]);

  const left = (ready: Ready, key: string | number) =>
    Math.max(0, Math.ceil(((ready[String(key)] ?? 0) - now) / 1000));

  return {
    energy,
    maxEnergy,
    nextEnergyIn: nextEnergyAt ? Math.max(0, Math.ceil((nextEnergyAt - now) / 1000)) : 0,
    crimeLeft: (id: string) => left(crimeReady, id),
    theftLeft: (level: number) => left(theftReady, level),
    jailLeft: Math.max(0, Math.ceil((jailEnds - now) / 1000)),
    setEnergy,
    refresh
  };
}

export const clock = (secs: number) =>
  `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
