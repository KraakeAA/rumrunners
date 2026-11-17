
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import Forum from "@/components/Forum";

export default async function ForumPage() {
  const userId = await getSessionUserId();

  if (!userId) {
    redirect("/login");
  }

  const [player, account] = await Promise.all([
    prisma.player.findUnique({
      where: { userId }
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true }
    })
  ]);

  if (!player) {
    redirect("/logout");
  }

  const health = Math.max(0, Math.min(100, player.health));
  const energyPercent = player.maxEnergy > 0
    ? Math.max(0, Math.min(100, (player.energy / player.maxEnergy) * 100))
    : 0;

  return (
    <main className="game forum-page">
      <header className="game-status-bar">
        <Link href="/" className="status-portrait" aria-label="Return to the city">
          R
        </Link>

        <div className="status-player">
          <strong>{player.username}</strong>
          <span>{player.rank}</span>

          <div className="status-health-track">
            <div
              className="status-health-fill"
              style={{ width: `${health}%` }}
            />
          </div>
          <small>{health}% Health</small>
        </div>

        <div className="status-resource">
          <strong>£{player.money.toLocaleString("en-GB")}</strong>
          <span>Cash</span>
        </div>

        <div className="status-resource">
          <strong>{player.bullets.toLocaleString("en-GB")}</strong>
          <span>Bullets</span>
        </div>

        <div className="status-resource">
          <strong>{player.energy}/{player.maxEnergy}</strong>
          <span>Energy</span>
          <div className="status-energy-track">
            <div
              className="status-energy-fill"
              style={{ width: `${energyPercent}%` }}
            />
          </div>
        </div>

        <Link href="/" className="status-menu">
          Menu
        </Link>
      </header>

      <div className="forum-city-strip">
        <div>
          <strong>London</strong>
          <span>England</span>
        </div>
        <span className="forum-weather">◈ Calm</span>
        <span className="forum-era">Britain · 1933</span>
      </div>

      <div className="forum-page-heading">
        <div>
          <small>THE UNDERWORLD</small>
          <h1>City Forum</h1>
        </div>
        <Link href="/" className="forum-home-link">
          ← Back to city
        </Link>
      </div>

      <Forum
        isAdmin={account?.isAdmin ?? false}
        playerId={player.id}
      />

      <footer className="forum-page-footer">
        RUMRUNNERS · BRITAIN · 1933
      </footer>
    </main>
  );
}
