
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

const TRAVEL_DURATION_MS = 60 * 60 * 1000;
const INSTANT_TRAVEL_COST = 10;

async function getPlayer() {
  const userId = await getSessionUserId();

  if (!userId) {
    return null;
  }

  return prisma.player.findUnique({
    where: { userId },
    select: {
      id: true,
      username: true,
      currentCity: true,
      travelDestination: true,
      travelStartedAt: true,
      travelArrivesAt: true,
      gold: true,
    },
  });
}

async function completeExpiredJourney(
  player: NonNullable<Awaited<ReturnType<typeof getPlayer>>>
) {
  if (
    !player.travelDestination ||
    !player.travelArrivesAt ||
    player.travelArrivesAt.getTime() > Date.now()
  ) {
    return;
  }

  await prisma.player.updateMany({
    where: {
      id: player.id,
      travelDestination: player.travelDestination,
      travelArrivesAt: player.travelArrivesAt,
      travelArrivesAt: { lte: new Date() },
    },
    data: {
      currentCity: player.travelDestination,
      travelDestination: null,
      travelStartedAt: null,
      travelArrivesAt: null,
    },
  });
}

export async function GET() {
  try {
    const player = await getPlayer();

    if (!player) {
      return NextResponse.json(
        { error: "You must be logged in to use the Railway." },
        { status: 401 }
      );
    }

    await completeExpiredJourney(player);

    const updatedPlayer = await getPlayer();

    if (!updatedPlayer) {
      return NextResponse.json(
        { error: "Player not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      cities: CITIES,
      currentCity: updatedPlayer.currentCity,
      travelDestination: updatedPlayer.travelDestination,
      travelStartedAt: updatedPlayer.travelStartedAt,
      travelArrivesAt: updatedPlayer.travelArrivesAt,
      gold: updatedPlayer.gold,
      isTravelling:
        !!updatedPlayer.travelDestination &&
        !!updatedPlayer.travelArrivesAt &&
        updatedPlayer.travelArrivesAt.getTime() > Date.now(),
      instantTravelCost: INSTANT_TRAVEL_COST,
      travelDurationMinutes: 60,
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
    const player = await getPlayer();

    if (!player) {
      return NextResponse.json(
        { error: "You must be logged in to travel." },
        { status: 401 }
      );
    }

    await completeExpiredJourney(player);

    const updatedPlayer = await getPlayer();

    if (!updatedPlayer) {
      return NextResponse.json(
        { error: "Player not found." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const action = body.action;

    if (action === "travel") {
      const destination = body.destination;

      if (
        typeof destination !== "string" ||
        !CITIES.includes(destination)
      ) {
        return NextResponse.json(
          { error: "Please select a valid destination." },
          { status: 400 }
        );
      }

      if (updatedPlayer.travelArrivesAt) {
        return NextResponse.json(
          { error: "You are already travelling." },
          { status: 400 }
        );
      }

      if (destination === updatedPlayer.currentCity) {
        return NextResponse.json(
          { error: "You are already in that city." },
          { status: 400 }
        );
      }

      const startedAt = new Date();
      const arrivesAt = new Date(
        startedAt.getTime() + TRAVEL_DURATION_MS
      );

      const result = await prisma.player.updateMany({
        where: {
          id: updatedPlayer.id,
          OR: [
            { travelArrivesAt: null },
            { travelArrivesAt: { lte: startedAt } },
          ],
        },
        data: {
          travelDestination: destination,
          travelStartedAt: startedAt,
          travelArrivesAt: arrivesAt,
        },
      });

      if (result.count !== 1) {
        return NextResponse.json(
          { error: "Your travel status has changed. Please try again." },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Your journey to ${destination} has begun.`,
        travelDestination: destination,
        travelStartedAt: startedAt,
        travelArrivesAt: arrivesAt,
      });
    }

    if (action === "skip") {
      if (
        !updatedPlayer.travelDestination ||
        !updatedPlayer.travelArrivesAt ||
        updatedPlayer.travelArrivesAt.getTime() <= Date.now()
      ) {
        return NextResponse.json(
          { error: "You do not have an active journey to complete." },
          { status: 400 }
        );
      }

      if (updatedPlayer.gold < INSTANT_TRAVEL_COST) {
        return NextResponse.json(
          { error: "You need 10 Gold to complete your journey instantly." },
          { status: 400 }
        );
      }

      const result = await prisma.player.updateMany({
        where: {
          id: updatedPlayer.id,
          gold: { gte: INSTANT_TRAVEL_COST },
          travelDestination: updatedPlayer.travelDestination,
          travelArrivesAt: updatedPlayer.travelArrivesAt,
          travelArrivesAt: { gt: new Date() },
        },
        data: {
          gold: { decrement: INSTANT_TRAVEL_COST },
          currentCity: updatedPlayer.travelDestination,
          travelDestination: null,
          travelStartedAt: null,
          travelArrivesAt: null,
        },
      });

      if (result.count !== 1) {
        return NextResponse.json(
          { error: "Your journey could not be completed. Please try again." },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `You have arrived in ${updatedPlayer.travelDestination}. 10 Gold has been deducted.`,
        currentCity: updatedPlayer.travelDestination,
        gold: updatedPlayer.gold - INSTANT_TRAVEL_COST,
      });
    }

    return NextResponse.json(
      { error: "Invalid Railway action." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Railway POST error:", error);

    return NextResponse.json(
      { error: "Something went wrong with your journey." },
      { status: 500 }
    );
  }
}
