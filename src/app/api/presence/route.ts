
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function POST() {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Not signed in." },
        { status: 401 }
      );
    }

    const player = await prisma.player.findUnique({
      where: { userId },
      select: { id: true }
    });

    if (!player) {
      return NextResponse.json(
        { error: "Player not found." },
        { status: 404 }
      );
    }

    await prisma.player.update({
      where: { id: player.id },
      data: { updatedAt: new Date() }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Presence update error:", error);

    return NextResponse.json(
      { error: "Unable to update presence." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Not signed in." },
        { status: 401 }
      );
    }

    const cutoff = new Date(Date.now() - 2 * 60 * 1000);

    const players = await prisma.player.findMany({
      where: {
        updatedAt: { gte: cutoff }
      },
      select: {
        username: true,
        rank: true,
        rankLevel: true,
        updatedAt: true
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    return NextResponse.json({
      players,
      count: players.length
    });
  } catch (error) {
    console.error("Online players error:", error);

    return NextResponse.json(
      { error: "Unable to load online players." },
      { status: 500 }
    );
  }
}
