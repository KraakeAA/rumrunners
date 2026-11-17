
"use client";

import { useCallback, useEffect, useState } from "react";

type RailwayData = {
  cities: string[];
  currentCity: string;
  travelDestination: string | null;
  travelStartedAt: string | null;
  travelArrivesAt: string | null;
  gold: number;
  isTravelling: boolean;
  instantTravelCost: number;
  travelDurationMinutes: number;
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

    const clock = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    const refresh = setInterval(() => {
      loadRailway();
    }, 5000);

    return () => {
      clearInterval(clock);
      clearInterval(refresh);
    };
  }, [loadRailway]);

  async function travel(action: "travel" | "skip") {
    if (busy) return;

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
          action,
          destination,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Your request could not be completed.");
      } else {
        setMessage(result.message || "Your request was successful.");
        await loadRailway();
      }
    } catch {
      setError("Unable to contact the Railway. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function formatTime(milliseconds: number) {
    const totalSeconds = Math.max(
      0,
      Math.ceil(milliseconds / 1000)
    );

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

  const travelling =
    data.isTravelling &&
    !!data.travelDestination &&
    !!data.travelArrivesAt;

  const remaining = travelling
    ? new Date(data.travelArrivesAt!).getTime() - now
    : 0;

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

          <div style={{ color: "#aaa", marginTop: "8px" }}>
            Gold balance:{" "}
            <strong style={{ color: "#e5c46b" }}>
              {data.gold.toLocaleString()}
            </strong>
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

      {travelling ? (
        <section style={panelStyle}>
          <div style={headingStyle}>Journey in Progress</div>

          <div style={{ padding: "20px", textAlign: "center" }}>
            <div style={{ color: "#999", fontSize: "12px" }}>
              YOUR DESTINATION
            </div>

            <div
              style={{
                color: "#e1c49b",
                fontSize: "27px",
                fontWeight: 700,
                margin: "8px 0 20px",
              }}
            >
              {data.travelDestination}
            </div>

            <div style={{ color: "#aaa", fontSize: "12px" }}>
              TIME REMAINING
            </div>

            <div
              style={{
                fontSize: "36px",
                fontWeight: 700,
                color: "#d9bd91",
                fontVariantNumeric: "tabular-nums",
                margin: "8px 0",
              }}
            >
              {formatTime(remaining)}
            </div>

            <p style={{ color: "#999", fontSize: "13px" }}>
              Your journey continues even when you log out.
            </p>

            <div
              style={{
                borderTop: "1px solid #38332d",
                marginTop: "20px",
                paddingTop: "18px",
              }}
            >
              <p style={{ color: "#d8bd83" }}>
                Arrive immediately for 10 Gold?
              </p>

              <button
                style={{
                  ...buttonStyle,
                  opacity: busy || data.gold < data.instantTravelCost
                    ? 0.5
                    : 1,
                }}
                disabled={busy || data.gold < data.instantTravelCost}
                onClick={() => travel("skip")}
              >
                {busy
                  ? "Please wait..."
                  : `Arrive Now - ${data.instantTravelCost} Gold`}
              </button>

              {data.gold < data.instantTravelCost && (
                <p style={{ color: "#d88b8b", fontSize: "12px" }}>
                  You need more Gold to use this option.
                </p>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section style={panelStyle}>
          <div style={headingStyle}>Book Your Journey</div>

          <div style={{ padding: "18px" }}>
            <p style={{ color: "#aaa", marginTop: 0 }}>
              Select the city you wish to travel to.
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
                JOURNEY DURATION
              </div>
              <strong style={{ color: "#e1c49b" }}>
                1 hour
              </strong>

              <p
                style={{
                  color: "#999",
                  fontSize: "12px",
                  marginBottom: 0,
                }}
              >
                Travel time runs on real-world time, including while
                you are logged out.
              </p>
            </div>

            <button
              style={{
                ...buttonStyle,
                opacity: !destination || busy ? 0.5 : 1,
              }}
              disabled={!destination || busy}
              onClick={() => travel("travel")}
            >
              {busy ? "Booking..." : "Travel"}
            </button>
          </div>
        </section>
      )}

      <section style={panelStyle}>
        <div style={headingStyle}>Available Cities</div>

        <div>
          {data.cities.map((city) => {
            const isCurrent = city === data.currentCity;
            const isDestination = city === data.travelDestination;

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
                    color: isCurrent
                      ? "#91c58d"
                      : isDestination
                        ? "#d8bd83"
                        : "#888",
                    textTransform: "uppercase",
                  }}
                >
                  {isCurrent
                    ? "Your location"
                    : isDestination
                      ? "Your destination"
                      : "Available"}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
