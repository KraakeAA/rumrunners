import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { renderBB } from "@/lib/bbcode";
import { wealthStatus } from "@/lib/wealth";

const ONLINE_MS = 5 * 60 * 1000;

const bar: CSSProperties = {
  padding: "6px 8px",
  textAlign: "center",
  fontFamily: "Georgia, serif",
  fontSize: 15,
  color: "#f7efdb",
  background: "linear-gradient(180deg, #8a7038, #4d3d1c)",
  borderTop: "1px solid #b0904a",
  borderBottom: "1px solid #b0904a",
  textShadow: "0 1px 2px #000"
};
const row: CSSProperties = {
  display: "flex",
  border: "1px solid #6b5d3a",
  borderTop: 0,
  background: "#1f2a25",
  fontSize: 13,
  boxSizing: "border-box"
};
const label: CSSProperties = {
  width: "34%",
  flexShrink: 0,
  padding: "4px 8px",
  fontWeight: 700,
  color: "#d4cab2",
  borderRight: "1px solid #6b5d3a",
  background: "#17201c"
};
const value: CSSProperties = { flex: 1, minWidth: 0, padding: "4px 8px", overflowWrap: "anywhere" };

function lastSeen(at: Date, online: boolean) {
  if (online) return "Now";
  const mins = Math.floor((Date.now() - at.getTime()) / 60000);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

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
    where: { username },
    select: {
      id: true,
      username: true,
      rank: true,
      rankLevel: true,
      experience: true,
      health: true,
      protection: true,
      money: true,
      bank: true,
      kills: true,
      createdAt: true,
      updatedAt: true,
      profileQuote: true,
      profilePictureUrl: true,
      profileStatus: true,
      statusExpiresAt: true,
      profileViews: true,
      showProfileViews: true,
      showOcStatus: true,
      showOrganization: true,
      forumTopics: { select: { id: true } },
      forumPosts: { select: { id: true } },
      jailUntil: true
    }
  });

  if (!player) notFound();

  const viewer = await prisma.player.findUnique({
    where: { userId },
    select: { id: true, allowProfileImages: true }
  });
  const isMe = viewer?.id === player.id;

  let views = player.profileViews;
  if (!isMe) {
    const updated = await prisma.player.update({
      where: { id: player.id },
      data: { profileViews: { increment: 1 } },
      select: { profileViews: true }
    });
    views = updated.profileViews;
  }

  // Crew status.
  const [led, slot] = await Promise.all([
    prisma.organisedCrime.findUnique({ where: { leaderId: player.id }, select: { id: true } }),
    prisma.ocSlot.findFirst({
      where: { playerId: player.id, state: { in: ["selecting", "ready"] } },
      select: { id: true }
    })
  ]);
  const inCrew = Boolean(led || slot);

  const online = Date.now() - player.updatedAt.getTime() < ONLINE_MS;
  const jailed = player.jailUntil ? player.jailUntil.getTime() > Date.now() : false;
  const alive = player.health > 0;
  const messages = player.forumTopics.length + player.forumPosts.length;
  const statusLive =
    player.profileStatus && (!player.statusExpiresAt || player.statusExpiresAt.getTime() > Date.now());
  const showPicture = Boolean(player.profilePictureUrl) && (isMe || viewer?.allowProfileImages !== false);

  const iconStyle: CSSProperties = {
    flex: 1,
    textAlign: "center",
    padding: "6px 0",
    color: "#f1e8d3",
    textDecoration: "none",
    fontSize: 12,
    borderRight: "1px solid #6b5d3a"
  };
  const navStyle: CSSProperties = {
    ...row,
    borderTop: "1px solid #6b5d3a",
    flex: 1,
    justifyContent: "center",
    padding: "6px 0",
    color: "#f1e8d3",
    textDecoration: "none",
    fontSize: 12
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b0f0d",
        color: "#f1e8d3",
        padding: 6,
        boxSizing: "border-box",
        overflowX: "hidden",
        fontFamily: '"DejaVu Sans", Verdana, Arial, sans-serif',
        fontSize: 13
      }}
    >
      <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
        <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
          <Link href="/" style={navStyle}>
            Back to game
          </Link>
          {isMe && (
            <Link href="/profile-edit" style={navStyle}>
              Edit profile
            </Link>
          )}
        </div>

        <div style={bar}>Profile For {player.username}</div>

        {statusLive && (
          <div style={{ ...row, justifyContent: "center", padding: "5px 8px", background: "#4d3d1c", color: "#ffe3b0", textAlign: "center" }}>
            {player.profileStatus}
          </div>
        )}

        <div
          style={{
            background: "#17201c",
            border: "1px solid #6b5d3a",
            borderTop: 0,
            display: "grid",
            placeItems: "center",
            padding: 6,
            boxSizing: "border-box"
          }}
        >
          {showPicture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={player.profilePictureUrl as string}
              alt={`${player.username}'s picture`}
              style={{ maxWidth: "100%", maxHeight: 200, objectFit: "contain", display: "block" }}
            />
          ) : (
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                border: "2px solid #b0904a",
                fontFamily: "Georgia, serif",
                fontSize: 28,
                color: "#d2b783"
              }}
            >
              {player.username.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        {player.showOcStatus && (
          <div
            style={{
              ...row,
              justifyContent: "center",
              padding: "4px 8px",
              background: inCrew ? "#4d3d1c" : "#1e3a22"
            }}
          >
            OC status:&nbsp;<strong>{inCrew ? "In a crew" : "Available"}</strong>
          </div>
        )}

        <div style={row}>
          {!isMe ? (
            <a href={`/?to=${encodeURIComponent(player.username)}`} style={iconStyle}>
              ✉ Message
            </a>
          ) : (
            <Link href="/profile-edit" style={iconStyle}>
              ✎ Edit
            </Link>
          )}
          <Link href="/users-online" style={{ ...iconStyle, borderRight: "none" }}>
            ☰ Users online
          </Link>
        </div>

        <div>
          <div style={row}>
            <div style={label}>Name:</div>
            <div style={value}>{player.username}</div>
          </div>
          {player.showOrganization && (
            <div style={row}>
              <div style={label}>Organisation:</div>
              <div style={value}>None</div>
            </div>
          )}
          <div style={row}>
            <div style={label}>Status:</div>
            <div style={value}>
              {alive ? "Alive" : "Dead"}
              {jailed ? " - In jail" : ""} -{" "}
              <span style={{ color: online ? "#00ff00" : "#b7ad93" }}>{online ? "Online" : "Offline"}</span>
            </div>
          </div>
          <div style={row}>
            <div style={label}>Rank:</div>
            <div style={value}>{player.rank}</div>
          </div>
          <div style={row}>
            <div style={label}>Wealth:</div>
            <div style={value}>{wealthStatus(player.money, player.bank)}</div>
          </div>
          <div style={row}>
            <div style={label}>Kills:</div>
            <div style={value}>{player.kills.toLocaleString("en-GB")}</div>
          </div>
          <div style={row}>
            <div style={label}>Last seen:</div>
            <div style={value}>{lastSeen(player.updatedAt, online)}</div>
          </div>
          <div style={row}>
            <div style={label}>Messages:</div>
            <div style={value}>{messages.toLocaleString("en-GB")}</div>
          </div>
          {player.showProfileViews && (
            <div style={row}>
              <div style={label}>Profile views:</div>
              <div style={value}>{views.toLocaleString("en-GB")}</div>
            </div>
          )}
          <div style={row}>
            <div style={label}>Joined:</div>
            <div style={value}>
              {player.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </div>
          </div>
        </div>

        <div style={{ ...bar, fontSize: 13, padding: "4px 8px", marginTop: 6 }}>Quote</div>
        <div
          style={{
            ...row,
            padding: "8px 10px",
            minHeight: 36,
            overflowWrap: "anywhere",
            lineHeight: 1.4
          }}
        >
          {player.profileQuote ? renderBB(player.profileQuote) : <span style={{ color: "#8f8873" }}>No quote yet.</span>}
        </div>
      </div>
    </main>
  );
}
