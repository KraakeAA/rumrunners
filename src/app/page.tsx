import Link from "next/link";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import GameShell from "@/components/GameShell";

export default async function Home() {
  const userId = await getSessionUserId();

  if (!userId) {
    return (
      <main className="landing">
        <div className="landing-mark">R</div>
        <p className="eyebrow">BRITAIN · 1933</p>
        <h1>RUMRUNNERS</h1>
        <p className="intro">
          The streets are unforgiving. Make your name in the underworld.
        </p>
        <div className="landing-actions">
          <Link className="button" href="/login">
            Enter the city
          </Link>
          <Link className="button secondary" href="/register">
            Create an account
          </Link>
        </div>
        <p className="small-note">
          A persistent, multiplayer browser game.
        </p>
      </main>
    );
  }

  const [player, account, recentCrimes] = await Promise.all([
    prisma.player.findUnique({
      where: { userId }
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true }
    }),
    prisma.crimeLog.findMany({
      where: {
        player: { userId }
      },
      orderBy: { createdAt: "desc" },
      take: 5
    })
  ]);

  if (!player) {
    return (
      <main className="landing">
        <h1>Player record missing</h1>
        <Link href="/logout">Sign out</Link>
      </main>
    );
  }

  return (
    <GameShell
      isAdmin={account?.isAdmin ?? false}
      playerId={player.id}
      player={{
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
        maxEnergy
