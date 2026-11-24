import type { ComponentProps, ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import GameShell from "@/components/GameShell";
import { maxEnergyFor } from "@/lib/game";
import DeadScreen from "@/components/DeadScreen";
import { regenHealth } from "@/lib/whack";
import { settleInterest } from "@/lib/interest";
import { levelsOf } from "@/lib/training";
import { expireEscrowsFor } from "@/lib/escrow";
import { staffLevel } from "@/lib/staff";

export type GameShellProps = Omit<ComponentProps<typeof GameShell>, "children">;

// Either a whole screen to show instead of the game (dead, or no player),
// or the details the game frame needs.
export type GameLoad =
  | { kind: "screen"; element: ReactNode }
  | { kind: "game"; props: GameShellProps };

// Everything the game frame needs about the signed-in player.
// The frame (src/app/(game)/layout.tsx) calls this once, so moving between
// pages does not load it all again.
export async function loadGame(): Promise<GameLoad> {
  const userId = await getSessionUserId();

  // Not signed in: go straight to the login screen.
  if (!userId) redirect("/login");

  const [
    player,
    account,
    recentCrimes,
    crimeGroups,
    casinoGroups,
    forumTopics,
    forumPosts
  ] = await Promise.all([
    prisma.player.findUnique({
      where: { userId }
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true, staffRole: true }
    }),
    prisma.crimeLog.findMany({
      where: {
        player: { userId }
      },
      orderBy: { createdAt: "desc" },
      take: 5
    }),
    prisma.crimeLog.groupBy({
      by: ["crimeType", "success"],
      where: { player: { userId } },
      _count: { _all: true },
      _sum: { cashChange: true }
    }),
    prisma.casinoLog.groupBy({
      by: ["game"],
      where: { player: { userId } },
      _count: { _all: true },
      _sum: { bet: true, payout: true },
      _max: { payout: true }
    }),
    prisma.forumTopic.count({
      where: { author: { userId } }
    }),
    prisma.forumPost.count({
      where: { author: { userId } }
    })
  ]);

  const crimeTotals = new Map<
    string,
    { attempts: number; successes: number; cashEarned: number }
  >();

  for (const row of crimeGroups) {
    const entry = crimeTotals.get(row.crimeType) ?? {
      attempts: 0,
      successes: 0,
      cashEarned: 0
    };

    entry.attempts += row._count._all;

    if (row.success) {
      entry.successes += row._count._all;
      entry.cashEarned += row._sum.cashChange ?? 0;
    }

    crimeTotals.set(row.crimeType, entry);
  }

  if (!player) {
    return {
      kind: "screen",
      element: (
        <main className="landing">
          <h1>Player record missing</h1>
          <a href="/logout">Sign out</a>
        </main>
      )
    };
  }

  // Call off any escrow trade that has run out of time, so held goods come back.
  if ((await expireEscrowsFor(prisma, player.id)) > 0) {
    const fresh = await prisma.player.findUnique({ where: { id: player.id }, select: { money: true, gold: true } });
    if (fresh) {
      player.money = fresh.money;
      player.gold = fresh.gold;
    }
  }

  // Pay any bank interest that has fallen due.
  if (player.bank > 0) {
    const acct = await settleInterest(prisma, player.id);
    player.bank = acct.bank;
  }

  // Heal slowly over time.
  const healed = regenHealth(player.health, player.healthAt);
  if (healed.health !== player.health) {
    await prisma.player.update({
      where: { id: player.id },
      data: { health: healed.health, healthAt: healed.healthAt }
    });
    player.health = healed.health;
  }

  if (player.health <= 0) {
    // File the name that has just died, so it appears in the revive list.
    await prisma.pastLife.upsert({
      where: { username: player.username },
      create: {
        userId,
        username: player.username,
        rank: player.rank,
        rankLevel: player.rankLevel,
        diedAt: player.diedAt ?? new Date(),
        killedBy: player.killedBy
      },
      update: {}
    });

    const pastLives = await prisma.pastLife.findMany({
      where: { userId },
      orderBy: { diedAt: "desc" }
    });

    const lives = pastLives.map((l) => ({
      id: l.id,
      username: l.username,
      rank: l.rank,
      diedAt: l.diedAt.toISOString(),
      killedBy: l.killedBy === "suicide" ? "suicide" : l.killedBy ? "shot" : null
    }));

    return {
      kind: "screen",
      element: (
        <DeadScreen
          name={player.username}
          rank={player.rank}
          gold={player.gold}
          killedBy={player.killedBy === "suicide" ? "suicide" : player.killedBy ? "shot" : null}
          lives={lives}
        />
      )
    };
  }

  return {
    kind: "game",
    props: {
      isAdmin: account?.isAdmin ?? false,
      staffLevel: staffLevel(account),
      playerId: player.id,
      training: levelsOf(player),
      player: {
        username: player.username,
        rank: player.rank,
        rankLevel: player.rankLevel,
        money: player.money,
        bank: player.bank,
        gold: player.gold,
        bullets: player.bullets,
        health: player.health,
        protection: player.protection,
        energy: player.energy,
        maxEnergy: maxEnergyFor(player.rankLevel),
        experience: player.experience,
        lastCrimeAt: player.lastCrimeAt?.toISOString() ?? null,
        currentCity: player.currentCity
      },
      stats: {
        crimeByType: Array.from(crimeTotals, ([crimeType, v]) => ({
          crimeType,
          ...v
        })),
        casinoByGame: casinoGroups.map((g) => ({
          game: g.game,
          plays: g._count._all,
          wagered: g._sum.bet ?? 0,
          returned: g._sum.payout ?? 0,
          biggestPayout: g._max.payout ?? 0
        })),
        forumTopics,
        forumPosts,
        theftWins: player.theftWins,
        theftFails: player.theftFails,
        boozeBought: player.boozeBought,
        boozeSold: player.boozeSold,
        boozeSpent: player.boozeSpent,
        boozeEarned: player.boozeEarned,
        ocsDone: player.ocsDone,
        ocsLed: player.ocsLed,
        ocEarned: player.ocEarned,
        kills: player.kills,
        joinedAt: player.createdAt.toISOString()
      },
      recentCrimes: recentCrimes.map((c) => ({
        crimeType: c.crimeType,
        success: c.success,
        cashChange: c.cashChange,
        createdAt: c.createdAt.toISOString()
      }))
    }
  };
}
