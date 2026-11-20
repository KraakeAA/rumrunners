import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { staffLevel } from "@/lib/staff";

type Context = {
  params: Promise<{ topicId: string }>;
};

export async function POST(
  request: NextRequest,
  context: Context
) {
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json(
      { error: "Sign in first." },
      { status: 401 }
    );
  }

  try {
    const { topicId } = await context.params;
    const data = await request.json().catch(() => null);
    const body = data?.body;

    if (
      typeof body !== "string" ||
      body.trim().length < 1 ||
      body.trim().length > 5000
    ) {
      return NextResponse.json(
        { error: "Your reply must be between 1 and 5,000 characters." },
        { status: 400 }
      );
    }

    const [user, topic] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: { player: true }
      }),
      prisma.forumTopic.findUnique({
        where: { id: topicId }
      })
    ]);

    if (!user?.player) {
      return NextResponse.json(
        { error: "Player not found." },
        { status: 404 }
      );
    }

    if (!topic) {
      return NextResponse.json(
        { error: "Topic not found." },
        { status: 404 }
      );
    }

    if (topic.locked) {
      return NextResponse.json(
        { error: "This discussion is locked." },
        { status: 403 }
      );
    }

    const post = await prisma.forumPost.create({
      data: {
        topicId,
        authorId: user.player.id,
        body: body.trim()
      },
      include: {
        author: {
          select: { username: true }
        }
      }
    });

    await prisma.forumTopic.update({
      where: { id: topicId },
      data: { updatedAt: new Date() }
    });

    return NextResponse.json(
      { post },
      { status: 201 }
    );

  } catch (error) {
    console.error("Forum reply error:", error);

    return NextResponse.json(
      { error: "Unable to post your reply." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: Context
) {
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json(
      { error: "Sign in first." },
      { status: 401 }
    );
  }

  try {
    const { topicId } = await context.params;
    const data = await request.json().catch(() => null);

    const [user, existing] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { isAdmin: true, staffRole: true, player: { select: { id: true } } }
      }),
      prisma.forumTopic.findUnique({ where: { id: topicId }, select: { authorId: true } })
    ]);

    if (!user || !existing) {
      return NextResponse.json({ error: "Topic not found." }, { status: 404 });
    }

    // Staff (helpers, moderators, admins) can pin and lock anything.
    // Everyone else can only lock or unlock a topic they started.
    const isStaff = staffLevel(user) >= 1;
    const isAuthor = user.player?.id === existing.authorId;

    if (!isStaff && !isAuthor) {
      return NextResponse.json(
        { error: "You cannot change this topic." },
        { status: 403 }
      );
    }

    if (!isStaff && data && typeof data.pinned === "boolean") {
      return NextResponse.json(
        { error: "Only staff can pin topics." },
        { status: 403 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Invalid request." },
        { status: 400 }
      );
    }

    const updates: {
      pinned?: boolean;
      locked?: boolean;
    } = {};

    if (typeof data.pinned === "boolean") {
      updates.pinned = data.pinned;
    }

    if (typeof data.locked === "boolean") {
      updates.locked = data.locked;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid moderation changes supplied." },
        { status: 400 }
      );
    }

    const topic = await prisma.forumTopic.update({
      where: { id: topicId },
      data: updates
    });

    return NextResponse.json({ topic });

  } catch (error) {
    console.error("Forum moderation error:", error);

    return NextResponse.json(
      { error: "Unable to update topic." },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: Context
) {
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json(
      { error: "Sign in first." },
      { status: 401 }
    );
  }

  try {
    const { topicId } = await context.params;

    const [user, topic] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: { player: true }
      }),
      prisma.forumTopic.findUnique({
        where: { id: topicId }
      })
    ]);

    if (!user?.player || !topic) {
      return NextResponse.json(
        { error: "Topic not found." },
        { status: 404 }
      );
    }

    if (
      !user.isAdmin &&
      topic.authorId !== user.player.id
    ) {
      return NextResponse.json(
        { error: "You cannot delete this topic." },
        { status: 403 }
      );
    }

    await prisma.forumTopic.delete({
      where: { id: topicId }
    });

    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error("Forum deletion error:", error);

    return NextResponse.json(
      { error: "Unable to delete topic." },
      { status: 400 }
    );
  }
}
