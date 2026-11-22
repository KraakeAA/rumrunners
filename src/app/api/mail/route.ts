import { denyIfDead } from "@/lib/alive";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET() {
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const me = await prisma.player.findUnique({ where: { userId }, select: { id: true } });

  if (!me) {
    return NextResponse.json({ error: "Player not found." }, { status: 404 });
  }

  const rows = await prisma.message.findMany({
    where: { toId: me.id },
    orderBy: { createdAt: "desc" },
    take: 50
  });

  return NextResponse.json({
    messages: rows.map((m) => ({
      id: m.id,
      from: m.fromName,
      subject: m.subject,
      body: m.body,
      ocId: m.ocId,
      read: m.readAt !== null,
      createdAt: m.createdAt.toISOString()
    }))
  });
}

export async function POST(req: Request) {
  const __dead = await denyIfDead();
  if (__dead) return __dead;

  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const me = await prisma.player.findUnique({
    where: { userId },
    select: { id: true, username: true }
  });

  if (!me) {
    return NextResponse.json({ error: "Player not found." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");

  if (body.action === "send") {
    const name = String(body.to ?? "").trim();
    const text = String(body.body ?? "").trim();

    if (!name) {
      return NextResponse.json({ error: "Type the name of the player to write to." }, { status: 400 });
    }
    if (!text) {
      return NextResponse.json({ error: "Write something in the message first." }, { status: 400 });
    }
    if (text.length > 2000) {
      return NextResponse.json({ error: "Messages can be up to 2,000 characters." }, { status: 400 });
    }

    const target = await prisma.player.findFirst({
      where: { username: { equals: name, mode: "insensitive" } },
      select: { id: true, username: true }
    });

    if (!target) {
      return NextResponse.json({ error: "There is no player with that name." }, { status: 404 });
    }
    if (target.id === me.id) {
      return NextResponse.json({ error: "You can't send a message to yourself." }, { status: 400 });
    }

    // Stop floods: no more than 10 letters a minute.
    const recent = await prisma.message.count({
      where: { fromName: me.username, createdAt: { gt: new Date(Date.now() - 60_000) } }
    });
    if (recent >= 10) {
      return NextResponse.json({ error: "Slow down. Try again in a minute." }, { status: 429 });
    }

    const firstLine = text.split("\n")[0];
    await prisma.message.create({
      data: {
        toId: target.id,
        fromName: me.username,
        subject: firstLine.length > 40 ? firstLine.slice(0, 40) + "…" : firstLine,
        body: text
      }
    });

    return NextResponse.json({ ok: true, message: `Message sent to ${target.username}.` });
  }

  if (body.action === "read") {
    await prisma.message.updateMany({
      where: { id, toId: me.id, readAt: null },
      data: { readAt: new Date() }
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "delete") {
    await prisma.message.deleteMany({ where: { id, toId: me.id } });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "deleteMany") {
    const ids = Array.isArray(body.ids) ? body.ids.map(String).slice(0, 200) : [];
    if (ids.length > 0) await prisma.message.deleteMany({ where: { id: { in: ids }, toId: me.id } });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "deleteAll") {
    await prisma.message.deleteMany({ where: { toId: me.id } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
