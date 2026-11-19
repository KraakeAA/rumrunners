import { denyIfDead } from "@/lib/alive";
import { NextResponse } from "next/server";
import { spinRoulette } from "@/lib/casino";
import { runWager } from "@/lib/casino-action";

export async function POST(req: Request) {
  const __dead = await denyIfDead();
  if (__dead) return __dead;

  const body = await req.json().catch(() => null);
  const bet = Number(body?.bet);

  try {
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
