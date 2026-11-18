import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

const categories = ["OFFICIAL", "CLASSIFIEDS", "OFF_TOPIC"];

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

    const topics = await prisma.forumTopic.findMany({
      where: { category },
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

    const topic = await prisma.forumTopic.create({
      data: {
        category,
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
