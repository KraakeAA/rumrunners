import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

// Call at the top of any action. A dead player can do nothing except start a new life.
// Returns a response to send back if the player is dead, or null if they may carry on.
export async function denyIfDead(): Promise<NextResponse | null> {
  const userId = await getSessionUserId();
  if (!userId) return null; // the route's own sign-in check handles this
  const player = await prisma.player.findUnique({ where: { userId }, select: { health: true } });
  if (player && player.health <= 0) {
    return NextResponse.json({ error: "You are dead. Start a new life first." }, { status: 403 });
  }
  return null;
}
