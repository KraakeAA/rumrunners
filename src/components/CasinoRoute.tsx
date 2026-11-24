"use client";

import { CasinoSection } from "@/components/Venues";
import { useGame } from "@/components/GameContext";
import type { CasinoGameKey } from "@/lib/venues";

// One casino game as a page of its own, for example /roulette.
export default function CasinoRoute({ game }: { game: CasinoGameKey }) {
  const { money, setMoney } = useGame();
  return <CasinoSection game={game} cash={money} onCash={setMoney} />;
}
