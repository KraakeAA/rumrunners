import { NextResponse } from "next/server";
import { userTag } from "@/lib/mailtext";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { STAFF_NAMES, TICKET_CATEGORIES, staffLevel } from "@/lib/staff";

class Refuse extends Error {}

const MAX_OPEN = 5;
const labelOf = (key: string) => TICKET_CATEGORIES.find((c) => c.key === key)?.label ?? key;
const minLevelOf = (key: string) => TICKET_CATEGORIES.find((c) => c.key === key)?.minLevel ?? 3;

async function me() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true, staffRole: true, player: { select: { id: true, username: true } } }
  });
  if (!user?.player) return null;
  return { playerId: user.player.id, username: user.player.username, level: staffLevel(user) };
}

function summary(t: {
  id: string;
  category: string;
  subject: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  player?: { username: string };
}) {
  return {
    id: t.id,
    category: labelOf(t.category),
    subject: t.subject,
    status: t.status,
    from: t.player?.username ?? "",
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString()
  };
}

export async function GET(req: Request) {
  try {
    const who = await me();
    if (!who) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

    const id = new URL(req.url).searchParams.get("id");
    if (id) {
      const t = await prisma.ticket.findUnique({
        where: { id },
        include: { player: { select: { username: true } }, messages: { orderBy: { createdAt: "asc" } } }
      });
      const mayRead = t && (t.playerId === who.playerId || who.level >= minLevelOf(t.category));
      if (!t || !mayRead) return NextResponse.json({ error: "That ticket isn't there." }, { status: 404 });
      return NextResponse.json({
        ticket: {
          ...summary(t),
          mine: t.playerId === who.playerId,
          messages: t.messages.map((m) => ({
            id: m.id,
            authorName: m.authorName,
            isStaff: m.isStaff,
            body: m.body,
            createdAt: m.createdAt.toISOString()
          }))
        }
      });
    }

    const mine = await prisma.ticket.findMany({
      where: { playerId: who.playerId },
      orderBy: { updatedAt: "desc" },
      take: 30
    });

    let queue: ReturnType<typeof summary>[] = [];
    if (who.level >= 1) {
      const allowed = TICKET_CATEGORIES.filter((c) => c.minLevel <= who.level).map((c) => c.key);
      const rows = await prisma.ticket.findMany({
        where: { status: "open", category: { in: allowed }, NOT: { playerId: who.playerId } },
        orderBy: { updatedAt: "asc" },
        take: 100,
        include: { player: { select: { username: true } } }
      });
      queue = rows.map(summary);
    }

    return NextResponse.json({
      level: who.level,
      staffName: STAFF_NAMES[who.level],
      categories: TICKET_CATEGORIES.map((c) => ({ key: c.key, label: c.label })),
      mine: mine.map(summary),
      queue
    });
  } catch (error) {
    console.error("Tickets load failed:", error);
    return NextResponse.json({ error: "Tickets could not be loaded." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const who = await me();
    if (!who) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");
    let ticketId = String(body.id ?? "");
    let message = "";

    if (action === "create") {
      const category = String(body.category ?? "");
      const text = String(body.body ?? "").trim();
      if (!TICKET_CATEGORIES.some((c) => c.key === category)) throw new Refuse("Choose a category.");
      if (text.length < 10 || text.length > 5000) throw new Refuse("Please describe the problem in 10 to 5,000 characters.");
      const open = await prisma.ticket.count({ where: { playerId: who.playerId, status: { not: "closed" } } });
      if (open >= MAX_OPEN) throw new Refuse(`You already have ${MAX_OPEN} tickets open. Wait for an answer or close one.`);
      const t = await prisma.ticket.create({
        data: {
          playerId: who.playerId,
          category,
          subject: text.replace(/\s+/g, " ").slice(0, 60),
          messages: { create: { authorName: who.username, isStaff: false, body: text } }
        }
      });
      ticketId = t.id;
      message = "Your ticket has been sent. You'll get a letter when staff reply.";
    } else if (action === "reply" || action === "close") {
      const t = await prisma.ticket.findUnique({ where: { id: ticketId } });
      if (!t) throw new Refuse("That ticket isn't there.");
      const owner = t.playerId === who.playerId;
      const staff = who.level >= minLevelOf(t.category);
      if (!owner && !staff) throw new Refuse("That ticket isn't there.");

      if (action === "close") {
        await prisma.ticket.update({ where: { id: t.id }, data: { status: "closed", updatedAt: new Date() } });
        message = "Ticket closed.";
      } else {
        const text = String(body.body ?? "").trim();
        if (text.length < 2 || text.length > 5000) throw new Refuse("Write a reply of up to 5,000 characters.");
        if (t.status === "closed") throw new Refuse("That ticket is closed.");
        const asStaff = staff && !owner;
        await prisma.$transaction([
          prisma.ticketMessage.create({
            data: { ticketId: t.id, authorName: who.username, isStaff: asStaff, body: text }
          }),
          prisma.ticket.update({
            where: { id: t.id },
            data: { status: asStaff ? "answered" : "open", updatedAt: new Date() }
          })
        ]);
        if (asStaff) {
          try {
            await prisma.message.create({
              data: {
                toId: t.playerId,
                fromName: "Help Desk",
                subject: `Your ticket has a reply: ${t.subject}`.slice(0, 100),
                body: `${userTag(who.username)} has replied to your ${labelOf(t.category)} ticket. Open the Help Desk to read it.`
              }
            });
          } catch {
            /* the letter is a courtesy */
          }
        }
        message = "Reply sent.";
      }
    } else {
      throw new Refuse("Unknown action.");
    }

    return NextResponse.json({ ok: true, message, id: ticketId });
  } catch (error) {
    if (error instanceof Refuse) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Ticket action failed:", error);
    return NextResponse.json({ error: "That could not be completed." }, { status: 500 });
  }
}
