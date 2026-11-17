
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

type Context = {
  params: Promise<{ topicId: string }>;
};

export async function GET(
  _request: Request,
  context: Context
) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Sign in first." },
        { status: 401 }
      );
    }

    const { topicId } = await context.params;

    const topic = await prisma.forumTopic.findUnique({
      where: { id: topicId },
      include: {
        author: {
          select: { username: true }
        },
        posts: {
          orderBy: { createdAt: "asc" },
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

    if (!topic) {
      return NextResponse.json(
        { error: "Topic not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ topic });

  } catch (error) {
    console.error("Forum thread loading error:", error);

    return NextResponse.json(
      { error: "Unable to load this discussion." },
      { status: 500 }
    );
  }
}
