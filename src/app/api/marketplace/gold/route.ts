import { NextResponse } from "next/server";
import { lockPlayer } from "@/lib/lock";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { denyIfDead } from "@/lib/alive";
import { splitTransfer, TRANSFER_FEE } from "@/lib/fees";

class Refuse extends Error {}

const PER_PAGE = 15;
const MAX_LISTINGS = 10;
const MAX_PRICE = 1_000_000_000;
const MAX_TOTAL = 2_000_000_000;

export async function GET(req: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const me = await prisma.player.findUnique({
      where: { userId },
      select: { id: true, gold: true, money: true }
    });
    if (!me) return NextResponse.json({ error: "Player not found." }, { status: 404 });

    const wanted = Math.max(1, Math.floor(Number(new URL(req.url).searchParams.get("page"))) || 1);
    const where = {
      status: "active",
      remaining: { gt: 0 },
      seller: { health: { gt: 0 } }
    };
    const total = await prisma.goldListing.count({ where });
    const pages = Math.max(1, Math.ceil(total / PER_PAGE));
    const page = Math.min(wanted, pages);

    const [rows, last] = await Promise.all([
      prisma.goldListing.findMany({
        where,
        orderBy: [{ price: "asc" }, { createdAt: "asc" }],
        skip: (page - 1) * PER_PAGE,
        take: PER_PAGE
      }),
      prisma.goldSale.findFirst({ orderBy: { createdAt: "desc" }, select: { price: true } })
    ]);

    return NextResponse.json({
      gold: me.gold,
      money: me.money,
      recentValue: last?.price ?? null,
      feePercent: Math.round(TRANSFER_FEE * 100),
      page,
      pages,
      listings: rows.map((l) => ({
        id: l.id,
        remaining: l.remaining,
        batchSize: l.batchSize,
        batches: Math.floor(l.remaining / l.batchSize),
        price: l.price,
        mine: l.sellerId === me.id
      }))
    });
  } catch (error) {
    console.error("Gold marketplace failed:", error);
    return NextResponse.json({ error: "The Marketplace could not be reached." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const dead = await denyIfDead();
  if (dead) return dead;

  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    const message = await prisma.$transaction(async (tx) => {
      await lockPlayer(tx, userId);
      const me = await tx.player.findUnique({ where: { userId } });
      if (!me) throw new Refuse("Player not found.");

      // ---- List gold: it leaves the account and is held here ----
      if (action === "list") {
        const amount = Math.floor(Number(body.amount));
        const batchSize = Math.floor(Number(body.batchSize) || 1);
        const price = Math.floor(Number(body.price));

        if (!Number.isSafeInteger(amount) || amount < 1) throw new Refuse("Enter how much gold to sell.");
        if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > amount) {
          throw new Refuse("Batch size must be between 1 and the amount.");
        }
        if (amount % batchSize !== 0) throw new Refuse("The amount must divide evenly into batches.");
        if (!Number.isSafeInteger(price) || price < 1 || price > MAX_PRICE) {
          throw new Refuse("Enter a price per gold coin.");
        }
        if (price * batchSize > MAX_TOTAL) throw new Refuse("That batch costs too much.");

        const open = await tx.goldListing.count({ where: { sellerId: me.id, status: "active" } });
        if (open >= MAX_LISTINGS) throw new Refuse(`You can have at most ${MAX_LISTINGS} listings at once.`);

        const taken = await tx.player.updateMany({
          where: { id: me.id, gold: { gte: amount } },
          data: { gold: { decrement: amount } }
        });
        if (taken.count !== 1) throw new Refuse("You do not have that much gold.");

        await tx.goldListing.create({
          data: {
            sellerId: me.id,
            sellerName: me.username,
            amount,
            remaining: amount,
            batchSize,
            price
          }
        });
        return `Listed ${amount.toLocaleString("en-GB")} gold at £${price.toLocaleString("en-GB")} each. It is held on the Marketplace until sold or removed.`;
      }

      // ---- Remove a listing: the unsold gold comes back ----
      if (action === "remove") {
        const id = String(body.id ?? "");
        const listing = await tx.goldListing.findUnique({ where: { id } });
        if (!listing || listing.sellerId !== me.id) throw new Refuse("That listing isn't yours.");

        const closed = await tx.goldListing.updateMany({
          where: { id, status: "active" },
          data: { status: "removed", remaining: 0 }
        });
        if (closed.count !== 1) throw new Refuse("That listing has already closed.");

        if (listing.remaining > 0) {
          await tx.player.update({ where: { id: me.id }, data: { gold: { increment: listing.remaining } } });
        }
        return `Listing removed. ${listing.remaining.toLocaleString("en-GB")} gold returned to you.`;
      }

      // ---- Buy: whole batches, cash from you, gold to you, cash (less tax) to the seller ----
      if (action === "buy") {
        const id = String(body.id ?? "");
        const batches = Math.floor(Number(body.batches));
        if (!Number.isSafeInteger(batches) || batches < 1) throw new Refuse("Enter how many to buy.");

        const listing = await tx.goldListing.findUnique({ where: { id } });
        if (!listing || listing.status !== "active") throw new Refuse("That listing is no longer available.");
        if (listing.sellerId === me.id) throw new Refuse("You can't buy your own listing. Remove it instead.");

        const seller = await tx.player.findUnique({ where: { id: listing.sellerId }, select: { health: true } });
        if (!seller || seller.health <= 0) throw new Refuse("That listing is no longer available.");

        const quantity = batches * listing.batchSize;
        if (quantity > listing.remaining) throw new Refuse("There isn't that much left in that listing.");

        const cost = quantity * listing.price;
        if (cost > MAX_TOTAL) throw new Refuse("That's too large a purchase in one go.");

        const claimed = await tx.goldListing.updateMany({
          where: { id, status: "active", remaining: { gte: quantity } },
          data: { remaining: { decrement: quantity } }
        });
        if (claimed.count !== 1) throw new Refuse("Someone else got there first.");
        if (listing.remaining === quantity) {
          await tx.goldListing.update({ where: { id }, data: { status: "sold" } });
        }

        const paid = await tx.player.updateMany({
          where: { id: me.id, money: { gte: cost } },
          data: { money: { decrement: cost }, gold: { increment: quantity } }
        });
        if (paid.count !== 1) throw new Refuse("You do not have enough cash on hand.");

        const { received, fee } = splitTransfer(cost);
        await tx.player.update({ where: { id: listing.sellerId }, data: { money: { increment: received } } });

        await tx.transfer.create({
          data: {
            fromId: me.id,
            fromName: me.username,
            toId: listing.sellerId,
            toName: listing.sellerName,
            amount: cost,
            fee,
            received,
            reference: `${quantity.toLocaleString("en-GB")} gold`,
            kind: "marketplace"
          }
        });
        await tx.goldSale.create({
          data: { listingId: id, sellerId: listing.sellerId, buyerId: me.id, quantity, price: listing.price }
        });

        return `Bought ${quantity.toLocaleString("en-GB")} gold for £${cost.toLocaleString("en-GB")}.`;
      }

      throw new Refuse("Unknown action.");
    });

    const after = await prisma.player.findUnique({ where: { userId }, select: { gold: true, money: true } });
    return NextResponse.json({ ok: true, message, gold: after?.gold ?? 0, money: after?.money ?? 0 });
  } catch (error) {
    if (error instanceof Refuse) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Gold marketplace action failed:", error);
    return NextResponse.json({ error: "That could not be completed." }, { status: 500 });
  }
}
