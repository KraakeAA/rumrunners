"use client";

import { FormEvent, useState, type CSSProperties } from "react";
import Link from "next/link";

// The artwork is 1199 x 1312. Everything below is positioned in percentages of
// that picture, so the fields stay on the painted boxes at any screen size.
const W = 1199;
const H = 1312;
const pctX = (x: number) => `${(x / W) * 100}%`;
const pctY = (y: number) => `${(y / H) * 100}%`;

// Painted boxes (left, top, width, height in artwork pixels).
const USER_BOX = { x: 659, y: 554, w: 463, h: 66 };
const PASS_BOX = { x: 659, y: 681, w: 463, h: 66 };
const BUTTON_BOX = { x: 659, y: 785, w: 463, h: 80 };

// Easy tap size: never smaller than 40px tall, even when the picture is small.
function box(b: { x: number; y: number; w: number; h: number }): CSSProperties {
  return {
    position: "absolute",
    left: pctX(b.x),
    width: pctX(b.w),
    top: pctY(b.y + b.h / 2),
    height: `max(${(b.h / H) * 100}%, 40px)`,
    transform: "translateY(-50%)",
    boxSizing: "border-box"
  };
}

const inputStyle: CSSProperties = {
  ...box(USER_BOX),
  margin: 0,
  padding: "0 4%",
  border: 0,
  outline: "none",
  background: "transparent",
  color: "#f7efdb",
  caretColor: "#e4c04d",
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "max(16px, 2.6cqw)", // 16px or more stops iPhone zooming in on tap
  letterSpacing: 0.3
};

type Link6 = { label: string; href: string; cx: number; cy: number; w: number };

// Centre of each painted word in the footer, and a width to tap on.
const LINKS: Link6[] = [
  { label: "Register", href: "/register", cx: 246, cy: 1158, w: 250 },
  { label: "Lost Password", href: "/lost-password", cx: 575, cy: 1158, w: 330 },
  { label: "Screenshots", href: "/screenshots", cx: 934, cy: 1158, w: 290 },
  { label: "Reviews", href: "/reviews", cx: 276, cy: 1215, w: 250 },
  { label: "Contact", href: "/contact", cx: 588, cy: 1215, w: 250 },
  { label: "Full Site", href: "/", cx: 912, cy: 1215, w: 250 }
];

export default function LoginScreen() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);

    const form = new FormData(e.currentTarget);
    const login = String(form.get("login") ?? "").trim();
    const password = String(form.get("password") ?? "");

    if (!login || !password) {
      setBusy(false);
      setError("Enter your username and password.");
      return;
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setBusy(false);
        setError(data.error || "Something went wrong.");
        return;
      }

      window.location.href = "/";
    } catch {
      setBusy(false);
      setError("Unable to connect. Please try again.");
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        width: "100%",
        overflowX: "hidden",
        background: "#050403",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <div
        style={{
          position: "relative",
          // As wide as the screen, but never taller than the screen on a desktop.
          width: `min(100vw, calc(100dvh * ${W / H}))`,
          aspectRatio: `${W} / ${H}`,
          containerType: "inline-size"
        }}
      >
        {/* The approved artwork, untouched. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/login/rumrunners-login-artwork.png"
          alt="RumRunners: a city with its own rules"
          width={W}
          height={H}
          draggable={false}
          style={{ display: "block", width: "100%", height: "100%", userSelect: "none" }}
        />

        <h1
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            overflow: "hidden",
            clip: "rect(0 0 0 0)",
            whiteSpace: "nowrap"
          }}
        >
          RumRunners login
        </h1>

        <form onSubmit={submit} noValidate>
          <input
            name="login"
            type="text"
            aria-label="Username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={254}
            style={{ ...inputStyle, ...box(USER_BOX) }}
          />
          <input
            name="password"
            type="password"
            aria-label="Password"
            autoComplete="current-password"
            maxLength={128}
            style={{ ...inputStyle, ...box(PASS_BOX) }}
          />
          <button
            type="submit"
            disabled={busy}
            aria-label={busy ? "Logging in" : "Login"}
            style={{
              ...box(BUTTON_BOX),
              border: 0,
              padding: 0,
              background: "transparent",
              cursor: busy ? "wait" : "pointer",
              WebkitTapHighlightColor: "rgba(228,192,77,0.25)",
              borderRadius: 6,
              color: "#f7efdb",
              fontFamily: "Georgia, serif",
              fontSize: "max(14px, 2.4cqw)",
              letterSpacing: 2
            }}
          >
            {busy ? "PLEASE WAIT…" : ""}
          </button>
        </form>

        {error && (
          <p
            role="alert"
            style={{
              position: "absolute",
              left: pctX(USER_BOX.x),
              width: pctX(USER_BOX.w),
              top: pctY(872),
              margin: 0,
              padding: "3px 6px",
              boxSizing: "border-box",
              textAlign: "center",
              background: "rgba(10,5,4,0.82)",
              border: "1px solid #7a2a22",
              borderRadius: 3,
              color: "#ff9a8a",
              fontFamily: "Georgia, serif",
              fontSize: "max(12px, 1.9cqw)",
              lineHeight: 1.25
            }}
          >
            {error}
          </p>
        )}

        <nav aria-label="Site links">
          {LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              aria-label={l.label}
              style={{
                position: "absolute",
                left: pctX(l.cx - l.w / 2),
                width: pctX(l.w),
                top: pctY(l.cy - 28),
                height: pctY(56),
                display: "block",
                WebkitTapHighlightColor: "rgba(228,192,77,0.25)",
                borderRadius: 4
              }}
            />
          ))}
        </nav>
      </div>
    </main>
  );
}
