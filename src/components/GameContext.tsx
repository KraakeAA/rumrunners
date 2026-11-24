"use client";

import { createContext, useContext } from "react";

// What a page needs from the game frame around it.
export type GameContextValue = {
  money: number;
  setMoney: (money: number) => void;
};

export const GameContext = createContext<GameContextValue | null>(null);

export function useGame(): GameContextValue {
  const value = useContext(GameContext);
  if (!value) throw new Error("useGame must be used inside the game frame.");
  return value;
}
