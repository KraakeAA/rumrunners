
"use client";

import { useCallback, useEffect, useState } from "react";

type RailwayData = {
  cities: string[];
  currentCity: string;
  canTravel: boolean;
  cooldownUntil: string | null;
  cooldownRemainingMs: number;
};

const panelStyle: React.CSSProperties = {
  background: "#171717",
  border: "1px solid #484038",
  marginBottom: "16px",
};

const headingStyle: React.CSSProperties = {
  background: "linear-gradient(90deg, #443426, #211b16)",
  borderBottom: "1px solid #65503a",
  padding: "11px 14px",
  color: "#e0c39a",
  fontWeight: 700,
  letterSpacing: "1px",
  textTransform: "uppercase",
};

const buttonStyle: React.CSSProperties = {
  background: "#76532f",
  border: "1px solid #a17a4c",
  color: "#fff",
  padding: "11px 20px",
  fontWeight: 700,
  cursor: "pointer",
};

export default function RailwayPage() {
  const [data, setData] = useState<RailwayData | null>(null);
  const [destination, setDestination] = useState("");
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadRailway = useCallback(async () => {
    try {
      const response = await fetch("/api/travel", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Unable to load Railway.");
        return;
      }

      setData(result);
      setError("");
    } catch {
      setError("Unable to connect to the Railway.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRailway();

    const clock = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(clock);
  }, [loadRailway]);

  async function travel() {
    if (!destination || busy || !data) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/travel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "travel",
          destination,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Your journey could not be completed.");

        if (result.cooldownUntil) {
          setData((previous) =>
            previous
              ? {
                  ...previous,
                  canTravel: false,
                  cooldownUntil: result.cooldownUntil,
                }
              : previous
          );
        }

        return;
      }

      setData((previous) =>
        previous
          ? {
              ...previous,
              currentCity: result.currentCity,
              canTravel: result.canTravel,
              cooldownUntil: result.cooldownUntil,
              cooldownRemainingMs: result.cooldownRemainingMs,
            }
          : previous
      );

      setDestination("");
      setMessage(result.message || `You have arrived in ${result.currentCity}.`);
    } catch {
      setError("Unable to contact the Railway. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function formatTime(milliseconds: number) {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [
      hours.toString().padStart(2, "0"),
      minutes.toString().padStart(2, "0"),
      seconds.toString().padStart(2, "0"),
    ].join(":");
  }

  if (loading) {
    return (
      <main style={{ padding: "20px", color: "#ddd" }}>
        Loading Railway...
      </main>
    );
  }

  if (!data) {
    return (
      <main style={{ padding: "20px", color: "#ddd" }}>
        <h1>Railway</h1>
        <p>{error || "Railway information is unavailable."}</p>
        <button style={buttonStyle} onClick={loadRailway}>
          Try again
        </button>
      </main>
    );
  }

  const remaining = data.cooldownUntil
    ? Math.max(0, new Date(data.cooldownUntil).getTime() - now)
    : 0;

  const canTravel = remaining === 0;

  const availableCities = data.cities.filter(
    (city) => city !== data.currentCity
  );

  return (
    <main
      style={{
        color: "#ddd",
        padding: "16px",
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      <div style={{ marginBottom: "18px" }}>
        <h1
          style={{
            color: "#e1c49b",
            fontSize: "25px",
            margin: "0 0 6px",
          }}
        >
          Railway Station
        </h1>
        <p style={{ color: "#999", margin: 0 }}>
          Travel between the cities of Britain.
        </p>
      </div>

      <section style={panelStyle}>
        <div style={headingStyle}>Your Location</div>

        <div style={{ padding: "18px" }}>
          <div style={{ color: "#999", fontSize: "12px" }}>
            CURRENT CITY
          </div>

          <div
            style={{
              fontSize: "25px",
              color: "#e1c49b",
              fontWeight: 700,
              marginTop: "5px",
            }}
          >
            {data.currentCity}
          </div>
        </div>
      </section>

      {error && (
        <div
          style={{
            background: "#3b1717",
            border: "1px solid #8c3939",
            color: "#ffb1b1",
            padding: "12px",
            marginBottom: "14px",
          }}
        >
          {error}
        </div>
      )}

      {message && (
        <div
          style={{
            background: "#19301e",
            border: "1px solid #416c49",
            color: "#b9e5bd",
            padding: "12px",
            marginBottom: "14px",
          }}
        >
          {message}
        </div>
      )}

      <section style={panelStyle}>
        <div style={headingStyle}>Travel Between Cities</div>

        <div style={{ padding: "18px" }}>
          {canTravel ? (
            <>
              <p style={{ color: "#aaa", marginTop: 0 }}>
                Choose your destination. You will arrive immediately.
              </p>

              <label
                htmlFor="railway-destination"
                style={{
                  display: "block",
                  marginBottom: "8px",
                  color: "#d8bd91",
                  fontSize: "13px",
                }}
              >
                DESTINATION
              </label>

              <select
                id="railway-destination"
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                style={{
                  width: "100%",
                  maxWidth: "400px",
                  padding: "12px",
                  background: "#252525",
                  border: "1px solid #66523d",
                  color: "#eee",
                  fontSize: "15px",
                  marginBottom: "18px",
                }}
              >
                <option value="">Select a destination...</option>

                {availableCities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>

              <div
                style={{
                  background: "#22201c",
                  border: "1px solid #40382f",
                  padding: "13px",
                  marginBottom: "18px",
                }}
              >
                <div style={{ color: "#aaa", fontSize: "12px" }}>
                  TRAVEL TIME
                </div>
                <strong style={{ color: "#e1c49b" }}>
                  Instant arrival
                </strong>
                <p
                  style={{
                    color: "#999",
                    fontSize: "12px",
                    marginBottom: 0,
                  }}
                >
                  You can travel again after a one-hour cooldown.
                </p>
              </div>

              <button
                style={{
                  ...buttonStyle,
                  opacity: !destination || busy ? 0.5 : 1,
                }}
                disabled={!destination || busy}
                onClick={travel}
              >
                {busy ? "Travelling..." : "Travel"}
              </button>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "12px" }}>
              <div style={{ color: "#aaa", fontSize: "12px" }}>
                NEXT TRAVEL AVAILABLE IN
              </div>

              <div
                style={{
                  fontSize: "36px",
                  fontWeight: 700,
                  color: "#d9bd91",
                  fontVariantNumeric: "tabular-nums",
                  margin: "12px 0",
                }}
              >
                {formatTime(remaining)}
              </div>

              <p style={{ color: "#999", fontSize: "13px" }}>
                You have arrived in {data.currentCity}. You can continue
                playing while your travel cooldown runs.
              </p>
            </div>
          )}
        </div>
      </section>

      <section style={panelStyle}>
        <div style={headingStyle}>Available Cities</div>

        <div>
          {data.cities.map((city) => {
            const isCurrent = city === data.currentCity;

            return (
              <div
                key={city}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "13px 15px",
                  borderBottom: "1px solid #333",
                  background: isCurrent ? "#242a22" : "transparent",
                }}
              >
                <span style={{ color: "#ddd", fontWeight: 600 }}>
                  {city}
                </span>

                <span
                  style={{
                    fontSize: "11px",
                    color: isCurrent ? "#91c58d" : "#888",
                    textTransform: "uppercase",
                  }}
                >
                  {isCurrent ? "Your location" : "Available"}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
