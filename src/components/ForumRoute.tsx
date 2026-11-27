"use client";

import ForumBoard from "@/components/ForumBoard";
import { useGame } from "@/components/GameContext";

export type ForumPage =
  | "Classifieds"
  | "Crew Forum"
  | "Forums"
  | "Game"
  | "Off Topic"
  | "Suggestion Box";

const BOARDS = {
  Classifieds: { category: "CLASSIFIEDS", title: "Classifieds" },
  "Crew Forum": { category: "CREW", title: "Crew Forum" },
  Game: { category: "OFFICIAL", title: "Game" },
  "Off Topic": { category: "OFF_TOPIC", title: "Off Topic" },
  "Suggestion Box": { category: "SUGGESTIONS", title: "Suggestion Box" }
} as const;

const titleBarStyle = {
  padding: "6px 8px",
  textAlign: "center" as const,
  fontSize: 16,
  lineHeight: 1.25,
  fontWeight: 400,
  fontFamily: "Georgia, serif",
  letterSpacing: 0.3,
  color: "#f7efdb",
  background: "linear-gradient(180deg, #8a7038 0%, #4d3d1c 100%)",
  borderTop: "1px solid #b0904a",
  borderBottom: "1px solid #b0904a",
  textShadow: "0 1px 2px #000"
};

// The forums: the list at /forums and each board on its own page.
export default function ForumRoute({ page }: { page: ForumPage }) {
  const g = useGame();

  if (page === "Forums") {
    return (
      <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", display: "grid", gap: 6 }}>
        <div style={titleBarStyle}>Forums</div>
        {[
          { name: "Game", note: "Talk about the game, news and updates." },
          { name: "Classifieds", note: "Buy, sell and trade with other players." },
          { name: "Off Topic", note: "The public house. Anything beyond the game." }
        ].map((f) => (
          <button
            key={f.name}
            type="button"
            className="nav-item"
            onClick={() => g.go(f.name)}
            style={{ width: "100%" }}
          >
            <strong style={{ display: "block", fontSize: 14 }}>{f.name}</strong>
            <span style={{ fontSize: 11, color: "#b7ad93", fontFamily: "inherit" }}>{f.note}</span>
          </button>
        ))}
      </div>
    );
  }

  const board = BOARDS[page];
  return (
    <ForumBoard
      category={board.category}
      title={board.title}
      isAdmin={g.isAdmin}
      playerId={g.playerId}
    />
  );
}
