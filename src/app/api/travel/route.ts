import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import type { Car } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  CITY_STORIES,
  DRIVE_HEAT,
  MAX_HEAT,
  carModel,
  currentHeat,
  effectiveMinutes,
} from "@/lib/era";

const CITIES = [
  "London",
  "Birmingham",
  "Manchester",
  "Liverpool",
  "Glasgow",
];


async function getPlayer() {
  const userId = await getSessionUserId();

  if (!userId) return null;

  return prisma.player.findUnique({
    where: { userId },
    select: {
      id: true,
      jailUntil: true,
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
      stories: CITY_STORIES,
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

    if (player.jailUntil && player.jailUntil.getTime() > now.getTime()) {
      return NextResponse.json(
        { error: "You can't take a train from a prison cell." },
        { status: 403 }
      );
    }

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

    // Optional car. Without one the journey is by rail.
    const carId =
      typeof body.carId === "string" && body.carId ? body.carId : null;
    let car: ReturnType<typeof carModel> = undefined;
    let ownedCar: Car | null = null;

    if (carId) {
      ownedCar = await prisma.car.findFirst({
        where: { id: carId, ownerId: player.id },
      });
      car = ownedCar ? carModel(ownedCar.model) : undefined;

      if (!ownedCar || !car) {
        return NextResponse.json(
          { error: "You do not own that car." },
          { status: 400 }
        );
      }

      if (ownedCar.city !== player.currentCity) {
        return NextResponse.json(
          { error: `That car is parked in ${ownedCar.city}.` },
          { status: 400 }
        );
      }
    }

    const minutes = effectiveMinutes(car, ownedCar?.damage ?? 0);
    const cooldownUntil = new Date(now.getTime() + minutes * 60 * 1000);

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

    // The car goes where you go, and driving it draws attention.
    if (ownedCar) {
      const heat = Math.min(
        MAX_HEAT,
        currentHeat(ownedCar.heat, ownedCar.heatAt, now.getTime()) + DRIVE_HEAT
      );
      await prisma.car.update({
        where: { id: ownedCar.id },
        data: { city: destination, heat, heatAt: now },
      });
    }

    const story = CITY_STORIES[destination];

    return NextResponse.json({
      success: true,
      message: `You can travel again in ${minutes} minutes.`,
      canCarryBooze: Boolean(car),
      welcome: story?.welcome ?? `Welcome to ${destination}`,
      history: story?.history ?? "",
      vehicle: car ? car.name : "the railway",
      minutes,
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
