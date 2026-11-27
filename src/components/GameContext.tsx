"use client";

import { createContext, useContext } from "react";

// What a page needs from the game frame around it.
export type GameContextValue = {
  money: number;
  setMoney: (money: number) => void;
  gold: number;
  setGold: (gold: number) => void;
  bank: number;
  setBank: (bank: number) => void;
  bullets: number;
  setBullets: (bullets: number) => void;
  energy: number;
  setEnergy: (energy: number) => void;
  rankLevel: number;
  setExperience: (experience: number) => void;
  noteRank: (rank: string, rankLevel: number) => void;
  staminaLevel: number;
  onTrainingLevels: (levels: { strength: number; stamina: number; agility: number }) => void;
  currentCity: string;
  setCurrentCity: (city: string) => void;
  isAdmin: boolean;
  jailLeft: number;
  theftLeft: (level: number) => number;
  refresh: () => void;
  showBreakout: () => void;
  playerId: string;
  staffLevel: number;
  latestMailId: string;
  mailChanged: () => void;
  letterTo: string;
  letterQuote: { from: string; at: string; body: string } | null;
  openLetter: (name: string, quote?: { from: string; at: string; body: string }) => void;
  go: (page: string) => void;
  busy: boolean;
  notice: string;
  commitCrime: (crimeId: string) => void;
  crimeLeft: (crimeId: string) => number;
};

export const GameContext = createContext<GameContextValue | null>(null);

export function useGame(): GameContextValue {
  const value = useContext(GameContext);
  if (!value) throw new Error("useGame must be used inside the game frame.");
  return value;
}
