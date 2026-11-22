import { staffLevel } from "@/lib/staff";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

const categories = ["OFFICIAL", "CLASSIFIEDS", "OFF_TOPIC", "SUGGESTIONS", "CREW"];

// The crew forum is stored as "CREW:<crew id>", so each crew only ever sees its own board.
async function crewCategory(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { player: { select: { crewId: true } } }
  });
  const crewId = user?.player?.crewId;
  return crewId ? `CREW:${crewId}` : null;
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Sign in first." },
        { status: 401 }
      );
    }

    const category =
      request.nextUrl.searchParams.get("category") || "OFFICIAL";

    if (!categories.includes(category)) {
      return NextResponse.json(
        { error: "Invalid forum section." },
        { status: 400 }
      );
    }

    let where = category;
    if (category === "CREW") {
      const mine = await crewCategory(userId);
      if (!mine) {
        return NextResponse.json({ error: "Join a crew to use the crew forum." }, { status: 403 });
      }
      where = mine;
    }

    const topics = await prisma.forumTopic.findMany({
      where: { category: where },
      orderBy: [
        { pinned: "desc" },
        { updatedAt: "desc" }
      ],
      include: {
        author: {
          select: { username: true }
        },
        posts: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            author: {
              select: { username: true }
            }
          }
        },
        _count: {
          select: { posts: true }
        }
      }
    });

    return NextResponse.json({ topics });

  } catch (error) {
    console.error("Forum loading error:", error);

    return NextResponse.json(
      { error: "Unable to load forum topics." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Sign in first." },
        { status: 401 }
      );
    }

    const data = await request.json().catch(() => null);

    if (!data) {
      return NextResponse.json(
        { error: "Invalid request." },
        { status: 400 }
      );
    }

    const { category, title, body } = data;

    if (
      !categories.includes(category) ||
      typeof title !== "string" ||
      typeof body !== "string" ||
      title.trim().length < 3 ||
      title.trim().length > 100 ||
      body.trim().length < 3 ||
      body.trim().length > 5000
    ) {
      return NextResponse.json(
        {
          error: "Titles must be 3–100 characters and messages must be 3–5,000 characters."
        },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { player: true }
    });

    if (!user || !user.player) {
      return NextResponse.json(
        { error: "Player not found." },
        { status: 404 }
      );
    }

    // Only staff start topics on the Official board.
    if (category === "OFFICIAL" && staffLevel(user) < 1) {
      return NextResponse.json({ error: "Only staff can start topics on the Official board." }, { status: 403 });
    }

    // Stop floods: at most 5 new topics in 10 minutes.
    const recentTopics = await prisma.forumTopic.count({
      where: { authorId: user.player.id, createdAt: { gt: new Date(Date.now() - 10 * 60_000) } }
    });
    if (recentTopics >= 5) {
      return NextResponse.json({ error: "Slow down. You can start 5 topics every 10 minutes." }, { status: 429 });
    }

    let stored: string = category;
    if (category === "CREW") {
      const mine = await crewCategory(userId);
      if (!mine) {
        return NextResponse.json({ error: "Join a crew to use the crew forum." }, { status: 403 });
      }
      stored = mine;
    }

    const topic = await prisma.forumTopic.create({
      data: {
        category: stored,
        title: title.trim(),
        body: body.trim(),
        authorId: user.player.id
      },
      include: {
        author: {
          select: { username: true }
        },
        posts: true,
        _count: {
          select: { posts: true }
        }
      }
    });

    return NextResponse.json(
      { topic },
      { status: 201 }
    );

  } catch (error) {
    console.error("Forum topic creation error:", error);

    return NextResponse.json(
      { error: "Unable to create topic." },
      { status: 500 }
    );
  }
}
