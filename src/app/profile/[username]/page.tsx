
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export default async function PlayerProfile({
  params
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const userId = await getSessionUserId();

  if (!userId) {
    return (
      <main className="landing">
        <h1>Rumrunners</h1>
        <p>You must be logged in to view player profiles.</p>
        <Link href="/login" className="button">
          Log in
        </Link>
      </main>
    );
  }

  const player = await prisma.player.findUnique({
    where: {
      username
    },
    select: {
      id: true,
      username: true,
      rank: true,
      rankLevel: true,
      experience: true,
      health: true,
      protection: true,
      createdAt: true,
      crimeLogs: {
        select: {
          success: true
        }
      },
      forumTopics: {
        select: {
          id: true
        }
      },
      forumPosts: {
        select: {
          id: true
        }
      }
    }
  });

  if (!player) {
    notFound();
  }

  const health = Math.max(0, Math.min(100, player.health));
  const protection = Math.max(0, Math.min(100, player.protection));
  const successfulCrimes = player.crimeLogs.filter(
    crime => crime.success
  ).length;

  return (
    <main className="game profile-page">
      <header className="topbar">
        <Link href="/" className="brand">
          <span>R</span>
          <strong>RUMRUNNERS</strong>
          <small>BRITAIN · 1933</small>
        </Link>

        <div className="top-player">
          <b>{player.username}</b>
          <span>{player.rank}</span>
        </div>

        <Link href="/logout" className="logout">
          Sign out
        </Link>
      </header>

      <div className="forum-city-strip">
        <div>
          <strong>London</strong>
          <span>England</span>
        </div>
        <span className="forum-era">Britain · 1933</span>
      </div>

      <div className="page-heading">
        <p className="eyebrow">THE UNDERWORLD</p>
        <h1>Player Profile</h1>
      </div>

      <section className="profile-card">
        <div className="profile-identity">
          <div className="profile-portrait">R</div>

          <div>
            <h2>{player.username}</h2>
            <p>{player.rank}</p>
            <small>Rank level {player.rankLevel}</small>
          </div>
        </div>

        <div className="profile-section">
          <h2>Character Status</h2>

          <div className="meter-label">
            <span>Health</span>
            <b>{health}%</b>
          </div>
          <div className="meter">
            <i
              className="health"
              style={{ width: `${health}%` }}
            />
          </div>

          <div className="meter-label">
            <span>Protection</span>
            <b>{protection}%</b>
          </div>
          <div className="meter">
            <i
              className="protection"
              style={{ width: `${protection}%` }}
            />
          </div>
        </div>

        <div className="profile-section">
          <h2>Public Statistics</h2>

          <div className="stat">
            <span>Experience</span>
            <b>{player.experience.toLocaleString("en-GB")}</b>
          </div>

          <div className="stat">
            <span>Successful crimes</span>
            <b>{successfulCrimes}</b>
          </div>

          <div className="stat">
            <span>Forum topics</span>
            <b>{player.forumTopics.length}</b>
          </div>

          <div className="stat">
            <span>Forum replies</span>
            <b>{player.forumPosts.length}</b>
          </div>

          <div className="stat">
            <span>Joined</span>
            <b>
              {player.createdAt.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric"
              })}
            </b>
          </div>
        </div>

        <div className="profile-actions">
          <Link href="/" className="button secondary">
            Back to city
          </Link>
        </div>
      </section>

      <footer className="footer">
        RUMRUNNERS · A CITY WITH ITS OWN RULES
      </footer>
    </main>
  );
}
