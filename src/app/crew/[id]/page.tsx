import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { renderBB } from "@/lib/bbcode";
import { MAX_MEMBERS } from "@/lib/crew";
import SiteMenuBar from "@/components/SiteMenuBar";

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

export default async function CrewProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();

  if (!userId) {
    return (
      <main className="landing">
        <h1>Rumrunners</h1>
        <p>You must be logged in to view crews.</p>
        <Link href="/login" className="button">
          Log in
        </Link>
      </main>
    );
  }

  const crew = await prisma.crew.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      color: true,
      motto: true,
      createdAt: true,
      leader: { select: { username: true } },
      members: { select: { username: true, rank: true }, orderBy: { username: "asc" } }
    }
  });
  if (!crew) notFound();

  const viewer = await prisma.player.findUnique({
    where: { userId },
    select: { crewId: true }
  });
  const canApply = viewer !== null && viewer.crewId === null;

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
        <SiteMenuBar />

        <div style={bar}>Crew Profile For {crew.name}</div>

        <div
          style={{
            ...row,
            justifyContent: "center",
            padding: "8px",
            background: crew.color,
            borderColor: crew.color,
            color: "#fff",
            textShadow: "0 1px 2px #000",
            fontFamily: "Georgia, serif",
            fontSize: 18
          }}
        >
          {crew.name}
        </div>

        {canApply && (
          <div style={row}>
            <Link
              href="/?go=Crew"
              style={{ flex: 1, textAlign: "center", padding: "6px 0", color: "#f1e8d3", textDecoration: "none", fontSize: 12 }}
            >
              ✉ Apply to join
            </Link>
          </div>
        )}

        <div>
          <div style={row}>
            <div style={label}>Leader:</div>
            <div style={value}>
              <Link href={`/profile/${encodeURIComponent(crew.leader.username)}`} style={{ color: "#e4c04d" }}>
                {crew.leader.username}
              </Link>
            </div>
          </div>
          <div style={row}>
            <div style={label}>Members:</div>
            <div style={value}>
              {crew.members.length}/{MAX_MEMBERS}
            </div>
          </div>
          <div style={row}>
            <div style={label}>Founded:</div>
            <div style={value}>
              {crew.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </div>
          </div>
        </div>

        <div style={{ ...bar, fontSize: 13, padding: "4px 8px", marginTop: 6 }}>Description</div>
        <div style={{ ...row, padding: "8px 10px", minHeight: 36, overflowWrap: "anywhere", lineHeight: 1.4 }}>
          {crew.motto ? renderBB(crew.motto) : <span style={{ color: "#8f8873" }}>No description yet.</span>}
        </div>

        <div style={{ ...bar, fontSize: 13, padding: "4px 8px", marginTop: 6 }}>Members</div>
        {crew.members.map((m) => (
          <div key={m.username} style={{ ...row, padding: "5px 8px", alignItems: "center", gap: 8 }}>
            <Link
              href={`/profile/${encodeURIComponent(m.username)}`}
              style={{ color: "#f7efdb", textDecoration: "none", fontWeight: 600, flex: 1, minWidth: 0 }}
            >
              {m.username}
              {m.username === crew.leader.username && <span style={{ color: "#e4c04d", fontSize: 11 }}> · Leader</span>}
            </Link>
            <span style={{ color: "#b7ad93", fontSize: 11 }}>{m.rank}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
