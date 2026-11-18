import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { loadVenueData } from "@/lib/venues-server";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  try {
    const player = await prisma.player.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!player) {
      return NextResponse.json({ error: "Player not found." }, { status: 404 });
    }

    const data = await loadVenueData(player.id);
    if (!data) {
      return NextResponse.json({ error: "Player not found." }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("Venue load failed:", error);
    return NextResponse.json(
      { error: "Venues are unavailable right now." },
      { status: 500 }
    );
  }
}
