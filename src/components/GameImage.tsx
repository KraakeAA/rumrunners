"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// Picture slots. Drop a picture into public/images/<slot>.jpg (or .png / .webp)
// and it appears. Until then a tidy placeholder shows its file name.
// ---------------------------------------------------------------------------

const EXTENSIONS = ["jpg", "png", "webp"];

export function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function GameImage({
  slot,
  width,
  height,
  dim = false
}: {
  slot: string;
  width: number | string;
  height: number | string;
  dim?: boolean;
}) {
  const [attempt, setAttempt] = useState(0);
  const missing = attempt >= EXTENSIONS.length;

  const frame: CSSProperties = {
    width,
    height,
    boxSizing: "border-box",
    overflow: "hidden",
    position: "relative",
    background: "#111915",
    border: "1px solid #3d4a41",
    opacity: dim ? 0.45 : 1,
    flexShrink: 0
  };

  if (missing) {
    return (
      <div
        style={{
          ...frame,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          border: "1px dashed #5f5535",
          background:
            "repeating-linear-gradient(135deg, #131b17, #131b17 8px, #161f1a 8px, #161f1a 16px)"
        }}
        title={`Add a picture at public/images/${slot}.jpg`}
      >
        <span
          style={{
            fontSize: typeof height === "number" && height < 90 ? 8 : 11,
            lineHeight: 1.25,
            color: "#7d765f",
            padding: 3,
            wordBreak: "break-all"
          }}
        >
          {slot}
        </span>
      </div>
    );
  }

  return (
    <div style={frame}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/images/${slot}.${EXTENSIONS[attempt]}`}
        alt=""
        onError={() => setAttempt((a) => a + 1)}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    </div>
  );
}

// The wide picture across the top of a page.
export function Banner({ slot, height = 130 }: { slot: string; height?: number }) {
  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto 6px" }}>
      <GameImage slot={slot} width="100%" height={height} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// The job card used for Crimes and Auto Theft: title, a line of description,
// Take / Heat / Success meters, the cost, a small picture and a button.
// ---------------------------------------------------------------------------

export type Meter = { label: string; level: number; word: string; colour: string };

const GREEN = "#2fa83a";
const RED = "#a8302f";

export function meter(label: string, level: number, word: string, colour = GREEN): Meter {
  return { label, level: Math.max(1, Math.min(5, Math.round(level))), word, colour };
}

export const TAKE_WORDS = ["Petty", "Modest", "Decent", "Rich", "Huge"];
export const HEAT_WORDS = ["Quiet", "Noticed", "Warm", "Hot", "Burning"];

export function successMeter(chance: number): Meter {
  const level = chance >= 0.9 ? 5 : chance >= 0.75 ? 4 : chance >= 0.6 ? 3 : chance >= 0.4 ? 2 : 1;
  return meter("Success", level, `${["", "Risky", "Dicey", "Fair", "Likely", "Safe"][level]} ${Math.round(chance * 100)}%`);
}

export function heatMeter(level: number): Meter {
  const l = Math.max(1, Math.min(5, Math.round(level)));
  return meter("Heat", l, HEAT_WORDS[l - 1], RED);
}

export function takeMeter(level: number): Meter {
  const l = Math.max(1, Math.min(5, Math.round(level)));
  return meter("Take", l, TAKE_WORDS[l - 1]);
}

function Segments({ level, colour }: { level: number; colour: string }) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          style={{
            width: 9,
            height: 14,
            background: n <= level ? colour : "#2a2f2c",
            border: "1px solid #101412"
          }}
        />
      ))}
    </span>
  );
}

const chip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "2px 9px",
  border: "1px solid #6b6b60",
  borderRadius: 12,
  background: "#202824",
  color: "#f1e8d3",
  fontSize: 12
};

export function JobCard({
  slot,
  title,
  description,
  meters,
  seconds,
  energy,
  tired,
  buttonLabel,
  disabled,
  onClick,
  locked,
  lockedText,
  waiting,
  waitLeft,
  hideTime,
  compact
}: {
  slot: string;
  title: string;
  description: string;
  meters: Meter[];
  seconds?: number;
  energy?: number;
  tired?: boolean;
  buttonLabel: string;
  disabled?: boolean;
  onClick?: () => void;
  locked?: boolean;
  lockedText?: string;
  waiting?: boolean;
  waitLeft?: number;
  hideTime?: boolean;
  compact?: boolean;
}) {
  if (compact) {
    const pct =
      waiting && typeof waitLeft === "number" && typeof seconds === "number" && seconds > 0
        ? Math.max(0, Math.min(100, (1 - waitLeft / seconds) * 100))
        : null;
    return (
      <div
        style={{
          border: "1px solid #6b5d3a",
          background: "#1f2a25",
          marginBottom: 4,
          opacity: locked ? 0.7 : waiting ? 0.85 : 1,
          position: "relative"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px" }}>
          <GameImage slot={slot} width={46} height={46} dim={locked} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: "Georgia, serif",
                fontSize: 14,
                fontWeight: 700,
                lineHeight: 1.2,
                color: locked ? "#8a8470" : "#f7efdb"
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontSize: 11,
                lineHeight: 1.25,
                color: "#b7ad93",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden"
              }}
            >
              {description}
            </div>
          </div>
          <div style={{ display: "grid", gap: 4, justifyItems: "center", flexShrink: 0 }}>
            {locked ? (
              <span style={{ fontSize: 10, color: "#8a8470", textAlign: "center", maxWidth: 76 }}>{lockedText}</span>
            ) : (
              typeof energy === "number" && (
                <span style={{ fontSize: 11, color: tired ? "#f09a8c" : "#f1e8d3" }}>
                  <span style={{ color: "#d9473b" }}>⚡</span> {energy}
                </span>
              )
            )}
            <button
              type="button"
              className="button"
              style={{ width: 76, padding: "5px 0", fontSize: 13, opacity: disabled || locked ? 0.55 : 1 }}
              disabled={disabled || locked}
              onClick={onClick}
            >
              {buttonLabel}
            </button>
          </div>
        </div>
        {pct !== null && (
          <div style={{ height: 3, background: "#0e1411" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "#5f9a2a" }} />
          </div>
        )}
      </div>
    );
  }

  const body: ReactNode = locked ? (
    <div style={{ fontSize: 12, color: "#8a8470", padding: "4px 0" }}>{lockedText}</div>
  ) : (
    <div style={{ display: "grid", gap: 5 }}>
      {meters.map((m) => (
        <div key={m.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <strong style={{ width: 62, color: "#f7efdb" }}>{m.label}:</strong>
          <Segments level={m.level} colour={m.colour} />
          <span style={{ color: "#d8cfb8" }}>{m.word}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div
      style={{
        border: "1px solid #6b5d3a",
        background: "#1f2a25",
        marginBottom: 6,
        opacity: locked ? 0.7 : waiting ? 0.85 : 1
      }}
    >
      <div style={{ padding: "5px 9px", background: "#2a3630", borderBottom: "1px solid #3d4a41" }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 700, color: locked ? "#8a8470" : "#f7efdb" }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: "#b7ad93", lineHeight: 1.3 }}>{description}</div>
      </div>

      {waiting && typeof waitLeft === "number" && typeof seconds === "number" && seconds > 0 && (
        <div style={{ padding: "5px 9px 0", fontSize: 11, color: "#c9bfa6" }}>
          Recovering from your previous job…
          <div style={{ height: 8, background: "#0e1411", border: "1px solid #34402f", marginTop: 3 }}>
            <div
              style={{
                height: "100%",
                width: `${Math.max(0, Math.min(100, (1 - waitLeft / seconds) * 100))}%`,
                background: "linear-gradient(180deg, #7fb83a, #4f7a1f)"
              }}
            />
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 10, padding: "8px 9px", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {body}
          {!locked && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <strong style={{ width: 62, fontSize: 13, color: "#f7efdb" }}>Cost:</strong>
              {typeof seconds === "number" && !hideTime && <span style={chip}>⏱ {seconds}s</span>}
              {typeof energy === "number" && (
                <span style={{ ...chip, color: tired ? "#f09a8c" : "#f1e8d3" }}>
                  <span style={{ color: "#d9473b" }}>⚡</span> {energy}
                </span>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gap: 6, justifyItems: "center", flexShrink: 0 }}>
          <GameImage slot={slot} width={70} height={70} dim={locked} />
          <button
            type="button"
            className="button"
            style={{ width: 76, padding: "5px 0", fontSize: 13, opacity: disabled || locked ? 0.55 : 1 }}
            disabled={disabled || locked}
            onClick={onClick}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
