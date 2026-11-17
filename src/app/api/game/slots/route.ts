
import { NextResponse } from "next/server";
import { spinSlots } from "@/lib/casino";
import { runWager } from "@/lib/casino-action";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const bet = Number(body?.bet);

  if (!Number.isSafeInteger(bet) || bet < 1) {
    return NextResponse.json(
      { error: "Enter a valid stake." },
      { status: 400 }
    );
  }

  const outcome = spinSlots();

  return runWager(
    "Slots",
    bet,
    outcome,
    outcome.multiplier
  );
}
