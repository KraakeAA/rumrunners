"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import SiteMenuBar from "@/components/SiteMenuBar";

type OnlinePlayer = {
  username: string;
  rank: string;
  rankLevel: number;
  updatedAt: string;
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
        padding: "8px",
        fontFamily: '"DejaVu Sans", Verdana, Arial, sans-serif',
      }}
    >
      <SiteMenuBar />
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div
          style={{
            border: "2px solid #6b5d3a",
            background: "#1f2a25",
          }}
        >
          <div
            style={{
              padding: "10px 8px",
              textAlign: "center",
              fontSize: 20,
              fontFamily: "Georgia, serif",
              color: "#f7efdb",
              background: "linear-gradient(180deg, #8a7038 0%, #4d3d1c 100%)",
              borderBottom: "2px solid #b0904a",
              textShadow: "0 1px 2px #000",
            }}
          >
            Total Users Online in the Last 2 Minutes
          </div>

          <div
            style={{
              padding: "8px 8px 14px",
              fontSize: 17,
              lineHeight: 1.55,
              minHeight: 120,
            }}
          >
            {loading ? (
              <p style={{ margin: 0 }}>Loading players...</p>
            ) : error ? (
              <p style={{ margin: 0, color: "#f09a8c" }}>{error}</p>
            ) : players.length === 0 ? (
              <p style={{ margin: 0, textAlign: "center", color: "#b7ad93" }}>
                Nobody is currently online.
              </p>
            ) : (
              <div>
                {players.map((player, index) => (
                  <Fragment key={player.username}>
                    {index > 0 && (
                      <span style={{ color: "#8a8470" }}> - </span>
                    )}
                    <Link
                      href={`/profile/${encodeURIComponent(player.username)}`}
                      title={`${player.rank} (${player.rankLevel})`}
                      style={{
                        color: "#f1e8d3",
                        textDecoration: "none",
                      }}
                    >
                      {player.username}
                    </Link>
                  </Fragment>
                ))}
              </div>
            )}
          </div>

          <div
            style={{
              padding: "16px 8px 14px",
              textAlign: "center",
              fontSize: 17,
            }}
          >
            <strong>Total:</strong> {players.length}
          </div>
        </div>

        <p
          style={{
            color: "#8a8470",
            fontSize: 11,
            textAlign: "center",
            margin: "12px 0 0",
          }}
        >
          The list refreshes automatically every 30 seconds.
        </p>
      </div>
    </main>
  );
}
