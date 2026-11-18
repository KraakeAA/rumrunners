import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { jailRemaining } from "@/lib/jail";
import {
  BOOZES,
  boozeByKey,
  boozeCapacity,
  boozePrice,
  boozeRange,
  cargoOf,
  cargoTotal,
  type Cargo
} from "@/lib/booze";

// Booze is carried by the player on the railway. The limit grows with rank.
export async function GET() {
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const me = await prisma.player.findUnique({ where: { userId } });

  if (!me) {
    return NextResponse.json({ error: "Player not found." }, { status: 404 });
  }

  const now = Date.now();
  const cargo = cargoOf(me.cargo);

  const market = BOOZES.map((b) => {
    const { low, high } = boozeRange(b, me.currentCity);
    const price = boozePrice(b, me.currentCity, now);
    const band = b.bands[me.currentCity];

    return {
      key: b.key,
      name: b.name,
      price,
      low,
      high,
      held: cargo[b.key] ?? 0,
      tag: band === "c" ? "low" : band === "d" ? "high" : "fair"
    };
  });

  return NextResponse.json({
    city: me.currentCity,
    money: me.money,
    jailed: jailRemaining(me.jailUntil, new Date()) > 0,
    capacity: boozeCapacity(me.rankLevel),
    used: cargoTotal(cargo),
    market
  });
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");
  const boozeKey = String(body.booze ?? "");
  const qty = Math.floor(Number(body.qty));

  if (action !== "buy" && action !== "sell") {
    return NextResponse.json({ error: "Choose buy or sell." }, { status: 400 });
  }
  const booze = boozeByKey(boozeKey);
  if (!booze) {
    return NextResponse.json({ error: "Unknown booze." }, { status: 400 });
  }
  if (!Number.isFinite(qty) || qty < 1 || qty > 1000) {
    return NextResponse.json({ error: "Enter a number of crates." }, { status: 400 });
  }

  try {
    const message = await prisma.$transaction(async (tx) => {
      const me = await tx.player.findUnique({ where: { userId } });
      if (!me) throw new Error("PLAYER_NOT_FOUND");
      if (jailRemaining(me.jailUntil, new Date()) > 0) throw new Error("JAILED");

      const cargo: Cargo = cargoOf(me.cargo);
      const price = boozePrice(booze, me.currentCity);

      if (action === "buy") {
        if (cargoTotal(cargo) + qty > boozeCapacity(me.rankLevel)) throw new Error("TOO_MUCH");

        const cost = price * qty;
        const paid = await tx.player.updateMany({
          where: { id: me.id, money: { gte: cost } },
          data: { money: { decrement: cost }, boozeBought: { increment: qty }, boozeSpent: { increment: cost } }
        });
        if (paid.count !== 1) throw new Error("INSUFFICIENT_FUNDS");

        cargo[booze.key] = (cargo[booze.key] ?? 0) + qty;
        await tx.player.update({ where: { id: me.id }, data: { cargo } });

        return `Bought ${qty} crate${qty === 1 ? "" : "s"} of ${booze.name} for £${cost.toLocaleString("en-GB")}.`;
      }

      const held = cargo[booze.key] ?? 0;
      if (held < qty) throw new Error("NOT_ENOUGH");

      const earned = price * qty;
      if (held === qty) delete cargo[booze.key];
      else cargo[booze.key] = held - qty;

      await tx.player.update({
        where: { id: me.id },
        data: { cargo, money: { increment: earned }, boozeSold: { increment: qty }, boozeEarned: { increment: earned } }
      });

      return `Sold ${qty} crate${qty === 1 ? "" : "s"} of ${booze.name} for £${earned.toLocaleString("en-GB")}.`;
    });

    return NextResponse.json({ ok: true, message });
  } catch (error) {
    const m = error instanceof Error ? error.message : "";
    const map: Record<string, [string, number]> = {
      PLAYER_NOT_FOUND: ["Player not found.", 404],
      JAILED: ["There is no bootlegging from a prison cell.", 403],
      TOO_MUCH: ["You can't carry that many crates. Rank up to carry more.", 400],
      INSUFFICIENT_FUNDS: ["You do not have enough cash.", 400],
      NOT_ENOUGH: ["You don't have that many crates of that.", 400]
    };
    if (map[m]) {
      return NextResponse.json({ error: map[m][0] }, { status: map[m][1] });
    }
    console.error("Bootlegging failed:", error);
    return NextResponse.json({ error: "That could not be completed." }, { status: 500 });
  }
}
