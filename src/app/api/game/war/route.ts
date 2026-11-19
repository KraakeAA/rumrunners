import { denyIfDead } from "@/lib/alive";
import { playWar } from "@/lib/casino";
import { runWager } from "@/lib/casino-action";

export async function POST(req: Request) {
  const __dead = await denyIfDead();
  if (__dead) return __dead;

  const body = await req.json().catch(() => null);
  const outcome = playWar();
  return runWager("War", Number(body?.bet), outcome, outcome.multiplier);
}
