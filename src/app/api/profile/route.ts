import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

const OPTION_KEYS = [
  "allowProfileImages",
  "friendsOnlyImages",
  "showOcStatus",
  "showProfileViews",
  "showOrganization"
] as const;

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const p = await prisma.player.findUnique({
    where: { userId },
    select: {
      username: true,
      profileQuote: true,
      profilePictureUrl: true,
      profileStatus: true,
      statusExpiresAt: true,
      allowProfileImages: true,
      friendsOnlyImages: true,
      showOcStatus: true,
      showProfileViews: true,
      showOrganization: true
    }
  });
  if (!p) return NextResponse.json({ error: "Player not found." }, { status: 404 });

  const live = p.profileStatus && (!p.statusExpiresAt || p.statusExpiresAt.getTime() > Date.now());
  return NextResponse.json({ ...p, profileStatus: live ? p.profileStatus : null });
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");

  const me = await prisma.player.findUnique({ where: { userId }, select: { id: true } });
  if (!me) return NextResponse.json({ error: "Player not found." }, { status: 404 });

  if (action === "quote") {
    const quote = String(body.quote ?? "").slice(0, 2000);
    await prisma.player.update({ where: { id: me.id }, data: { profileQuote: quote || null } });
    return NextResponse.json({ ok: true, message: "Your quote has been updated." });
  }

  if (action === "picture") {
    const url = String(body.url ?? "").trim();
    if (url === "") {
      await prisma.player.update({ where: { id: me.id }, data: { profilePictureUrl: null } });
      return NextResponse.json({ ok: true, message: "Your picture has been removed." });
    }
    if (url.length > 500 || !/^https:\/\/[^\s"'<>]+$/i.test(url)) {
      return NextResponse.json(
        { error: "Use the full https:// web address of a picture." },
        { status: 400 }
      );
    }
    await prisma.player.update({ where: { id: me.id }, data: { profilePictureUrl: url } });
    return NextResponse.json({ ok: true, message: "Your picture has been updated." });
  }

  if (action === "status") {
    const message = String(body.message ?? "").trim().slice(0, 140);
    if (!message) {
      await prisma.player.update({ where: { id: me.id }, data: { profileStatus: null, statusExpiresAt: null } });
      return NextResponse.json({ ok: true, message: "Your status bar has been cleared." });
    }
    const minutes = Math.floor(Number(body.minutes));
    let expires: Date | null = null;
    if (Number.isFinite(minutes) && minutes > 0) {
      expires = new Date(Date.now() + Math.min(minutes, 60 * 24 * 365) * 60000);
    }
    await prisma.player.update({
      where: { id: me.id },
      data: { profileStatus: message, statusExpiresAt: expires }
    });
    return NextResponse.json({ ok: true, message: "Your status bar has been posted." });
  }

  if (action === "options") {
    const data: Record<string, boolean> = {};
    for (const key of OPTION_KEYS) {
      if (typeof body[key] === "boolean") data[key] = body[key];
    }
    await prisma.player.update({ where: { id: me.id }, data });
    return NextResponse.json({ ok: true, message: "Your options have been saved." });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
