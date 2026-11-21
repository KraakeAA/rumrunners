import { denyIfDead } from "@/lib/alive";
import { NextResponse } from "next/server";
import { spinRoulette, spinRouletteTable, type RouletteStake } from "@/lib/casino";
import { runWager } from "@/lib/casino-action";

export async function POST(req: Request) {
  const __dead = await denyIfDead();
  if (__dead) return __dead;

  const body = await req.json().catch(() => null);

  try {
    // The table: several chips on different spots, one spin settles them all.
    if (Array.isArray(body?.bets)) {
      const stakes: RouletteStake[] = body.bets.map((b: { type?: unknown; number?: unknown; amount?: unknown }) => ({
        type: String(b?.type ?? ""),
        number: b?.number === undefined || b?.number === null ? undefined : Number(b.number),
        amount: Number(b?.amount)
      }));
      const spin = spinRouletteTable(stakes);
      // runWager pays floor(stake x multiplier); the small offset guards against rounding.
      const multiplier = (spin.totalPayout + 0.001) / spin.totalBet;
      const { totalBet, totalPayout, ...outcome } = spin;
      void totalPayout;
      return runWager("Roulette", totalBet, { ...outcome, win: spin.totalPayout > 0 }, multiplier);
    }

    // Older single-bet form.
    const bet = Number(body?.bet);
    const outcome = spinRoulette(
      String(body?.type ?? ""),
      body?.number === undefined || body?.number === null ? undefined : Number(body.number)
    );
    return runWager("Roulette", bet, outcome, outcome.multiplier);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid bet." },
      { status: 400 }
    );
  }
}
