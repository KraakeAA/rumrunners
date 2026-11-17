
import { NextResponse } from "next/server";
import { drawKeno } from "@/lib/casino";
import { runWager } from "@/lib/casino-action";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const bet = Number(body?.bet);

  if (!Array.isArray(body?.selected)) {
    return NextResponse.json(
      { error: "Choose your 10 numbers." },
      { status: 400 }
    );
  }

  try {
    const outcome = drawKeno(body.selected);

    return runWager(
      "Keno",
      bet,
      outcome,
      outcome.multiplier
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Invalid selection.",
      },
      { status: 400 }
    );
  }
}
