import { randomInt } from "crypto";
import { prisma } from "@/lib/prisma";

export const TICKET_PRICE = 10;
export const MAX_TICKETS_PER_PLAYER = 100;
export const HOUSE_CUT = 0.1; // share of the pot kept by the house
export const DRAW_DAY = 3; // Wednesday
export const DRAW_HOUR = 20; // 8pm London time

const LONDON = "Europe/London";

// Offset of London from UTC at a given instant, in minutes (0 in winter, 60 in summer).
function londonOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

function londonWeekday(at: Date): number {
  const name = new Intl.DateTimeFormat("en-GB", { timeZone: LONDON, weekday: "short" }).format(at);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

// The next Wednesday 8pm (London) strictly after `from`.
export function nextDrawAt(from = new Date()): Date {
  for (let d = 0; d < 9; d++) {
    const day = new Date(from.getTime() + d * 86_400_000);
    const guess = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), DRAW_HOUR, 0, 0);
    const at = new Date(guess - londonOffsetMinutes(new Date(guess)) * 60000);
    if (at.getTime() > from.getTime() && londonWeekday(at) === DRAW_DAY) return at;
  }
  return new Date(from.getTime() + 7 * 86_400_000);
}

// Draws any lottery whose time has passed. Safe to call as often as you like:
// the unique drawAt means a draw can only ever be made once.
export async function settleLotteries(now = new Date()) {
  const due = await prisma.lotteryTicket.groupBy({
    by: ["drawAt"],
    where: { drawAt: { lte: now } },
    _count: { _all: true }
  });
  if (due.length === 0) return;

  const done = await prisma.lotteryDraw.findMany({
    where: { drawAt: { in: due.map((d) => d.drawAt) } },
    select: { drawAt: true }
  });
  const doneSet = new Set(done.map((d) => d.drawAt.getTime()));

  for (const group of due) {
    if (doneSet.has(group.drawAt.getTime())) continue;

    try {
      await prisma.$transaction(async (tx) => {
        const tickets = await tx.lotteryTicket.findMany({
          where: { drawAt: group.drawAt },
          select: { id: true, playerId: true, player: { select: { username: true } } }
        });
        if (tickets.length === 0) return;

        const pot = tickets.length * TICKET_PRICE;
        const prize = Math.floor(pot * (1 - HOUSE_CUT));
        const winner = tickets[randomInt(tickets.length)];

        // Throws if another request has already drawn this one.
        await tx.lotteryDraw.create({
          data: {
            drawAt: group.drawAt,
            tickets: tickets.length,
            pot,
            prize,
            winnerName: winner.player.username
          }
        });

        await tx.player.update({ where: { id: winner.playerId }, data: { money: { increment: prize } } });

        const when = group.drawAt.toLocaleDateString("en-GB", { timeZone: LONDON, day: "numeric", month: "long" });
        const entrants = new Map<string, number>();
        for (const t of tickets) entrants.set(t.playerId, (entrants.get(t.playerId) ?? 0) + 1);

        await tx.message.createMany({
          data: Array.from(entrants.entries()).map(([playerId, count]) =>
            playerId === winner.playerId
              ? {
                  toId: playerId,
                  fromName: "The Lottery",
                  subject: "You won the lottery!",
                  body: `Your ticket was drawn on ${when}. You have won £${prize.toLocaleString("en-GB")} out of a pot of £${pot.toLocaleString("en-GB")}. The money is already in your pocket.`
                }
              : {
                  toId: playerId,
                  fromName: "The Lottery",
                  subject: "Lottery result",
                  body: `The draw for ${when} has been made. ${winner.player.username} won £${prize.toLocaleString("en-GB")}. You held ${count} ticket${count === 1 ? "" : "s"}. Better luck next Wednesday.`
                }
          )
        });
      });
    } catch {
      // Already drawn by another request, or a transient error: try again next time.
    }
  }
}
