
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

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
        background: "#101010",
        color: "#dedede",
        padding: "12px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "760px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            background: "linear-gradient(#484037, #25211d)",
            border: "1px solid #71604a",
            padding: "12px",
            marginBottom: "12px",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: "19px",
              color: "#e5c99b",
              letterSpacing: "1px",
              textTransform: "uppercase",
            }}
          >
            Players Online
          </h1>

          <p
            style={{
              margin: "6px 0 0",
              fontSize: "12px",
              color: "#b9ad9d",
            }}
          >
            See who is currently roaming the streets.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#222222",
            border: "1px solid #444",
            padding: "12px",
            marginBottom: "10px",
          }}
        >
          <span style={{ fontSize: "13px", color: "#ccc" }}>
            Players currently online
          </span>

          <strong
            style={{
              color: "#72c879",
              fontSize: "21px",
            }}
          >
            {players.length}
          </strong>
        </div>

        <div
          style={{
            background: "#292929",
            border: "1px solid #484848",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              background: "#3b3833",
              borderBottom: "1px solid #555",
              padding: "10px",
              fontSize: "11px",
              fontWeight: "bold",
              color: "#d6c5a9",
              textTransform: "uppercase",
            }}
          >
            <span>Player</span>
            <span style={{ textAlign: "right" }}>Rank</span>
          </div>

          {loading ? (
            <p style={{ padding: "15px", fontSize: "13px" }}>
              Loading players...
            </p>
          ) : error ? (
            <p style={{ padding: "15px", color: "#e08080", fontSize: "13px" }}>
              {error}
            </p>
          ) : players.length === 0 ? (
            <p
              style={{
                padding: "18px 12px",
                textAlign: "center",
                color: "#999",
                fontSize: "13px",
              }}
            >
              Nobody is currently online.
            </p>
          ) : (
            players.map((player, index) => (
              <div
                key={player.username}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  alignItems: "center",
                  padding: "11px 10px",
                  background: index % 2 === 0 ? "#292929" : "#222222",
                  borderBottom: "1px solid #3b3b3b",
                  fontSize: "13px",
                }}
              >
                <Link
                  href={`/profile/${encodeURIComponent(player.username)}`}
                  style={{
                    color: "#d9b77d",
                    textDecoration: "none",
                    fontWeight: "bold",
                  }}
                >
                  {player.username}
                </Link>

                <span
                  style={{
                    textAlign: "right",
                    color: "#bdbdbd",
                  }}
                >
                  {player.rank} ({player.rankLevel})
                </span>
              </div>
            ))
          )}
        </div>

        <p
          style={{
            color: "#777",
            fontSize: "11px",
            textAlign: "center",
            marginTop: "12px",
          }}
        >
          Online status refreshes automatically every 30 seconds.
        </p>

        <Link
          href="/"
          style={{
            display: "block",
            marginTop: "15px",
            padding: "11px",
            textAlign: "center",
            background: "#35312b",
            border: "1px solid #625441",
            color: "#e0c69b",
            textDecoration: "none",
            fontSize: "13px",
          }}
        >
          Return to the City
        </Link>
      </div>
    </main>
  );
}
