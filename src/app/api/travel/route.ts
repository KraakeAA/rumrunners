
import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const CITIES = [
  "London",
  "Birmingham",
  "Manchester",
  "Liverpool",
  "Glasgow",
];

const TRAVEL_COOLDOWN_MS = 60 * 60 * 1000;

async function getPlayer() {
  const userId = await getSessionUserId();

  if (!userId) return null;

  return prisma.player.findUnique({
    where: { userId },
    select: {
      id: true,
      currentCity: true,
      travelDestination: true,
      travelStartedAt: true,
      travelArrivesAt: true,
    },
  });
}

// Converts any journey started under the old system into
// an instant arrival while preserving its original cooldown end.
async function resolveOldTravel(
  player: NonNullable<Awaited<ReturnType<typeof getPlayer>>>
) {
  if (!player.travelDestination) return;

  await prisma.player.updateMany({
    where: {
      id: player.id,
      travelDestination: player.travelDestination,
    },
    data: {
      currentCity: player.travelDestination,
      travelDestination: null,
    },
  });
}

function getCooldown(travelArrivesAt: Date | null) {
  if (!travelArrivesAt) {
    return {
      canTravel: true,
      cooldownUntil: null,
      cooldownRemainingMs: 0,
    };
  }

  const remaining = Math.max(
    0,
    travelArrivesAt.getTime() - Date.now()
  );

  return {
    canTravel: remaining === 0,
    cooldownUntil: travelArrivesAt,
    cooldownRemainingMs: remaining,
  };
}

export async function GET() {
  try {
    let player = await getPlayer();

    if (!player) {
      return NextResponse.json(
        { error: "You must be logged in to use the Railway." },
        { status: 401 }
      );
    }

    await resolveOldTravel(player);

    player = await getPlayer();

    if (!player) {
      return NextResponse.json(
        { error: "Player not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      cities: CITIES,
      currentCity: player.currentCity,
      ...getCooldown(player.travelArrivesAt),
    });
  } catch (error) {
    console.error("Railway GET error:", error);

    return NextResponse.json(
      { error: "Unable to load Railway information." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    let player = await getPlayer();

    if (!player) {
      return NextResponse.json(
        { error: "You must be logged in to travel." },
        { status: 401 }
      );
    }

    await resolveOldTravel(player);

    player = await getPlayer();

    if (!player) {
      return NextResponse.json(
        { error: "Player not found." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const destination = body.destination;

    if (body.action !== "travel") {
      return NextResponse.json(
        { error: "Invalid Railway action." },
        { status: 400 }
      );
    }

    if (
      typeof destination !== "string" ||
      !CITIES.includes(destination)
    ) {
      return NextResponse.json(
        { error: "Please select a valid destination." },
        { status: 400 }
      );
    }

    if (destination === player.currentCity) {
      return NextResponse.json(
        { error: "You are already in that city." },
        { status: 400 }
      );
    }

    const now = new Date();

    if (
      player.travelArrivesAt &&
      player.travelArrivesAt.getTime() > now.getTime()
    ) {
      const remaining = player.travelArrivesAt.getTime() - now.getTime();

      return NextResponse.json(
        {
          error: "You must wait before travelling again.",
          cooldownRemainingMs: remaining,
          cooldownUntil: player.travelArrivesAt,
        },
        { status: 400 }
      );
    }

    const cooldownUntil = new Date(
      now.getTime() + TRAVEL_COOLDOWN_MS
    );

    const result = await prisma.player.updateMany({
      where: {
        id: player.id,
        currentCity: player.currentCity,
        OR: [
          { travelArrivesAt: null },
          { travelArrivesAt: { lte: now } },
        ],
      },
      data: {
        currentCity: destination,
        travelDestination: null,
        travelStartedAt: now,
        travelArrivesAt: cooldownUntil,
      },
    });

    if (result.count !== 1) {
      return NextResponse.json(
        {
          error: "Your travel status has changed. Please try again.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `You have arrived in ${destination}. You can travel again in one hour.`,
      currentCity: destination,
      ...getCooldown(cooldownUntil),
    });
  } catch (error) {
    console.error("Railway POST error:", error);

    return NextResponse.json(
      { error: "Something went wrong with your travel." },
      { status: 500 }
    );
  }
}
