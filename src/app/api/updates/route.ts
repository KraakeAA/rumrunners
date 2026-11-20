import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

async function whoAmI() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true, player: { select: { username: true } } }
  });
}

export async function GET() {
  try {
    const me = await whoAmI();
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const rows = await prisma.update.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
    return NextResponse.json({
      isAdmin: me.isAdmin,
      updates: rows.map((u) => ({
        id: u.id,
        title: u.title,
        body: u.body,
        authorName: u.authorName,
        createdAt: u.createdAt.toISOString()
      }))
    });
  } catch (error) {
    console.error("Updates load failed:", error);
    return NextResponse.json({ error: "Updates could not be loaded." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await whoAmI();
    if (!me?.isAdmin) return NextResponse.json({ error: "Admins only." }, { status: 403 });
    const body = await req.json().catch(() => ({}));

    if (body.action === "delete") {
      await prisma.update.deleteMany({ where: { id: String(body.id ?? "") } });
      return NextResponse.json({ ok: true });
    }

    const title = String(body.title ?? "").trim();
    const text = String(body.body ?? "").trim();
    if (title.length < 3 || title.length > 100 || text.length < 3 || text.length > 5000) {
      return NextResponse.json(
        { error: "A title of 3 to 100 characters and a message of 3 to 5,000 are needed." },
        { status: 400 }
      );
    }
    await prisma.update.create({
      data: { title, body: text, authorName: me.player?.username ?? "Admin" }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Update save failed:", error);
    return NextResponse.json({ error: "That could not be saved." }, { status: 500 });
  }
}
