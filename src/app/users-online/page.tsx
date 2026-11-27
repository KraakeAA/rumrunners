"use client";

import { Fragment, useCallback, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import SiteMenuBar from "@/components/SiteMenuBar";

type OnlinePlayer = {
  username: string;
  rank: string;
  rankLevel: number;
  updatedAt: string;
  isAdmin?: boolean;
  staffRole?: string;
};

// Name colours: admins red, moderators green, help desk operators yellow, everyone else white.
function roleOf(p: OnlinePlayer): "admin" | "mod" | "helper" | "user" {
  if (p.isAdmin) return "admin";
  if (p.staffRole === "MODERATOR") return "mod";
  if (p.staffRole === "HELPER") return "helper";
  return "user";
}
const ROLE_COLOUR = { admin: "#e0584f", mod: "#6fcf6f", helper: "#e4c04d", user: "#f1e8d3" };
const ROLE_TITLE = { admin: "Admin", mod: "Moderator", helper: "Help desk", user: "" };

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
const box: CSSProperties = {
  border: "1px solid #6b5d3a",
  borderTop: 0,
  background: "#1f2a25",
  padding: "8px 10px",
  fontSize: 13,
  lineHeight: 1.5
};

export default function UsersOnlinePage() {
  const [players, setPlayers] = useState<OnlinePlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshPlayers = useCallback(async () => {
    try {
      await fetch("/api/presence", {
        method: "POST",
        cache: "no-store",
      });

      const response = await fetch("/api/presence", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Unable to retrieve online players.");
      }

      const data = await response.json();
      setPlayers(data.players ?? []);
      setError("");
    } catch {
      setError("Unable to load the online player list.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshPlayers();

    const interval = window.setInterval(refreshPlayers, 30000);

    return () => window.clearInterval(interval);
  }, [refreshPlayers]);

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

        <div style={bar}>Users Online · Last 2 Minutes</div>

        <div style={{ ...box, minHeight: 60 }}>
          {loading ? (
            <p style={{ margin: 0 }}>Loading players...</p>
          ) : error ? (
            <p style={{ margin: 0, color: "#f09a8c" }}>{error}</p>
          ) : players.length === 0 ? (
            <p style={{ margin: 0, textAlign: "center", color: "#b7ad93" }}>
              Nobody is currently online.
            </p>
          ) : (
            <div style={{ overflowWrap: "anywhere" }}>
              {players.map((player, index) => (
                <Fragment key={player.username}>
                  {index > 0 && <span style={{ color: "#8a8470" }}> - </span>}
                  <Link
                    href={`/profile/${encodeURIComponent(player.username)}`}
                    title={roleOf(player) !== "user" ? ROLE_TITLE[roleOf(player)] : `${player.rank} (${player.rankLevel})`}
                    style={{
                      color: ROLE_COLOUR[roleOf(player)],
                      fontWeight: roleOf(player) !== "user" ? 700 : 400,
                      textDecoration: "none"
                    }}
                  >
                    {player.username}
                  </Link>
                </Fragment>
              ))}
            </div>
          )}
        </div>

        <div style={{ ...box, textAlign: "center", padding: "5px 10px" }}>
          <strong>Total:</strong> {players.length}
        </div>

        <div
          style={{
            ...box,
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: "2px 14px",
            padding: "5px 10px",
            fontSize: 11
          }}
        >
          <span style={{ color: "#b7ad93" }}>Key:</span>
          <span style={{ color: ROLE_COLOUR.admin, fontWeight: 700 }}>Admin</span>
          <span style={{ color: ROLE_COLOUR.mod, fontWeight: 700 }}>Moderator</span>
          <span style={{ color: ROLE_COLOUR.helper, fontWeight: 700 }}>Help desk</span>
          <span style={{ color: ROLE_COLOUR.user }}>Player</span>
        </div>

        <p style={{ color: "#8a8470", fontSize: 11, textAlign: "center", margin: "8px 0 0" }}>
          The list refreshes automatically every 30 seconds.
        </p>
      </div>
    </main>
  );
}
