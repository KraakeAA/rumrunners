import { denyIfDead } from "@/lib/alive";
import { lockPlayer, lockPlayerId } from "@/lib/lock";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import {
  blackjackResult,
  dealerPlay,
  freshDeck,
  handValue,
  isBlackjack,
  type Card
} from "@/lib/casino";
import { finishEscrow, startEscrow, validBet, wagerError } from "@/lib/casino-action";

const GAME = "Blackjack";

type Hand = { id: string; playerId: string; city: string; bet: number; deck: unknown; player: unknown; dealer: unknown };

// What the browser may see: the dealer's second card stays face down until the hand ends.
function view(h: { bet: number; player: Card[]; dealer: Card[] }, done: boolean) {
  return {
    bet: h.bet,
    player: h.player,
    playerTotal: handValue(h.player),
    dealer: done ? h.dealer : [h.dealer[0]],
    dealerTotal: done ? handValue(h.dealer) : null,
    hidden: !done
  };
}

// Pays out and removes the hand.
async function finish(userId: string, hand: Hand, player: Card[], dealerStart: Card[], deck: Card[], stood: boolean) {
  // The dealer only plays if the player is still in with a chance.
  const needDealer = stood && handValue(player) <= 21 && !isBlackjack(player);
  const dealer = needDealer ? dealerPlay(dealerStart, deck).hand : dealerStart;
  const { multiplier, label } = blackjackResult(player, dealer);
  const outcome = { player, dealer, label, multiplier };

  const paid = await prisma.$transaction(async (tx) => {
    await lockPlayerId(tx, hand.playerId);
    const removed = await tx.blackjackHand.deleteMany({ where: { id: hand.id } });
    if (removed.count !== 1) throw new Error("NO_HAND");
    return finishEscrow(tx, hand.playerId, GAME, hand.city, hand.bet, multiplier, outcome);
  });

  return NextResponse.json({
    done: true,
    label,
    money: paid.money,
    payout: paid.payout,
    fullPayout: paid.fullPayout,
    net: paid.net,
    takeover: paid.takeover,
    previousOwner: paid.previousOwner,
    ...view({ bet: hand.bet, player, dealer }, true)
  });
}

async function me() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const player = await prisma.player.findUnique({ where: { userId } });
  return player ? { userId, player } : null;
}

// Resume a hand that is in play (for example after a page refresh).
export async function GET() {
  const who = await me();
  if (!who) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const h = await prisma.blackjackHand.findUnique({ where: { playerId: who.player.id } });
  if (!h) return NextResponse.json({ inPlay: false });

  return NextResponse.json({
    inPlay: true,
    done: false,
    ...view({ bet: h.bet, player: h.player as Card[], dealer: h.dealer as Card[] }, false)
  });
}

export async function POST(req: Request) {
  const __dead = await denyIfDead();
  if (__dead) return __dead;

  const who = await me();
  if (!who) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");

  try {
    if (action === "deal") {
      const bet = Number(body.bet);
      if (!validBet(bet)) {
        return NextResponse.json({ error: "Enter a whole-number bet of at least £1." }, { status: 400 });
      }

      const started = await prisma.$transaction(async (tx) => {
        await lockPlayer(tx, who.userId);
        const existing = await tx.blackjackHand.findUnique({ where: { playerId: who.player.id } });
        if (existing) throw new Error("HAND_IN_PLAY");

        const { city } = await startEscrow(tx, who.userId, GAME, bet);
        const deck = freshDeck();
        const player = [deck[0], deck[2]];
        const dealer = [deck[1], deck[3]];
        const hand = await tx.blackjackHand.create({
          data: {
            playerId: who.player.id,
            city,
            bet,
            deck: deck.slice(4) as unknown as object,
            player: player as unknown as object,
            dealer: dealer as unknown as object
          }
        });
        return { hand, player, dealer, deck: deck.slice(4) };
      });

      // A natural on either side ends the hand straight away.
      if (isBlackjack(started.player) || isBlackjack(started.dealer)) {
        return await finish(who.userId, started.hand, started.player, started.dealer, started.deck, true);
      }

      const fresh = await prisma.player.findUnique({ where: { id: who.player.id }, select: { money: true } });
      return NextResponse.json({
        done: false,
        money: fresh?.money,
        ...view({ bet, player: started.player, dealer: started.dealer }, false)
      });
    }

    if (action === "hit" || action === "stand") {
      const h = await prisma.blackjackHand.findUnique({ where: { playerId: who.player.id } });
      if (!h) throw new Error("NO_HAND");

      let player = h.player as unknown as Card[];
      const dealer = h.dealer as unknown as Card[];
      let deck = h.deck as unknown as Card[];

      if (action === "hit") {
        player = [...player, deck[0]];
        deck = deck.slice(1);

        if (handValue(player) < 21) {
          await prisma.blackjackHand.update({
            where: { id: h.id },
            data: { player: player as unknown as object, deck: deck as unknown as object }
          });
          return NextResponse.json({ done: false, ...view({ bet: h.bet, player, dealer }, false) });
        }
        // 21 or bust: the hand is over (21 stands automatically).
        return await finish(who.userId, h, player, dealer, deck, handValue(player) === 21);
      }

      return await finish(who.userId, h, player, dealer, deck, true);
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return wagerError(error, GAME);
  }
}
