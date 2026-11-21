"use client";

import { FormEvent, useState, type CSSProperties } from "react";
import Link from "next/link";

type Rect = { x: number; y: number; w: number; h: number };
type Cfg = {
  src: string;
  W: number;
  H: number;
  fillWidth?: boolean;
  user: Rect;
  pass: Rect;
  btn: Rect;
  err: { x: number; y: number; w: number };
  links: { label: string; href: string; cx: number; cy: number; w: number; h: number }[];
};

// Everything is measured in pixels of its own picture, then turned into percentages,
// so the fields stay on the painted boxes at any screen size.

// Phone picture (portrait): 452 x 909.
const MOBILE: Cfg = {
  src: "/images/login/rumrunners-login-iphone.png",
  W: 452,
  H: 909,
  fillWidth: true, // fill the phone's width; the page scrolls a little if the screen is short
  user: { x: 70, y: 467, w: 314, h: 43 },
  pass: { x: 70, y: 545, w: 314, h: 43 },
  btn: { x: 69, y: 605, w: 320, h: 60 },
  err: { x: 70, y: 667, w: 314 },
  links: [
    { label: "Register", href: "/register", cx: 135, cy: 715, w: 150, h: 40 },
    { label: "Lost Password", href: "/lost-password", cx: 308, cy: 715, w: 170, h: 40 },
    { label: "Screenshots", href: "/screenshots", cx: 150, cy: 757, w: 160, h: 40 },
    { label: "Reviews", href: "/reviews", cx: 322, cy: 757, w: 150, h: 40 },
    { label: "Contact", href: "/contact", cx: 145, cy: 800, w: 150, h: 40 },
    { label: "Full Site", href: "/", cx: 318, cy: 800, w: 150, h: 40 }
  ]
};

// Desktop picture (landscape): 1048 x 682.
const DESKTOP: Cfg = {
  src: "/images/login/rumrunners-login-desktop.png",
  W: 1048,
  H: 682,
  user: { x: 570, y: 297, w: 298, h: 44 },
  pass: { x: 570, y: 381, w: 298, h: 44 },
  btn: { x: 575, y: 446, w: 294, h: 58 },
  err: { x: 570, y: 510, w: 298 },
  links: [
    { label: "Register", href: "/register", cx: 167, cy: 621, w: 120, h: 40 },
    { label: "Lost Password", href: "/lost-password", cx: 326, cy: 621, w: 190, h: 40 },
    { label: "Screenshots", href: "/screenshots", cx: 507, cy: 621, w: 150, h: 40 },
    { label: "Reviews", href: "/reviews", cx: 657, cy: 621, w: 110, h: 40 },
    { label: "Contact", href: "/contact", cx: 782, cy: 621, w: 110, h: 40 },
    { label: "Full Site", href: "/", cx: 913, cy: 621, w: 110, h: 40 }
  ]
};

// Desktop picture on wide screens, phone picture when the screen is taller than it is wide.
const CSS = `
.rr-login-desk { display: flex; }
.rr-login-mob { display: none; }
@media (max-aspect-ratio: 1/1) {
  .rr-login-desk { display: none; }
  .rr-login-mob { display: flex; }
}
`;

function Layout({
  cfg,
  className,
  error,
  busy,
  onSubmit
}: {
  cfg: Cfg;
  className: string;
  error: string;
  busy: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  const { W, H } = cfg;
  const pctX = (x: number) => `${(x / W) * 100}%`;
  const pctY = (y: number) => `${(y / H) * 100}%`;

  // Sits on a painted box, but never smaller than 40px tall so it is easy to tap.
  const box = (b: Rect): CSSProperties => ({
    position: "absolute",
    left: pctX(b.x),
    width: pctX(b.w),
    top: pctY(b.y + b.h / 2),
    height: `max(${(b.h / H) * 100}%, 40px)`,
    transform: "translateY(-50%)",
    boxSizing: "border-box"
  });

  const inputStyle: CSSProperties = {
    margin: 0,
    padding: "0 4%",
    border: 0,
    outline: "none",
    background: "transparent",
    color: "#f7efdb",
    caretColor: "#e4c04d",
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: "max(16px, 2.6cqw)", // 16px or more stops the iPhone zooming in on tap
    letterSpacing: 0.3
  };

  return (
    <div
      className={className}
      style={{
        minHeight: "100dvh",
        width: "100%",
        overflow: "hidden",
        background: "#050403",
        position: "relative",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      {/* Soft, dimmed copy of the artwork fills any spare space around it. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: -40,
          backgroundImage: `url(${cfg.src})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(28px) brightness(0.45)"
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: cfg.fillWidth ? "100vw" : `min(100vw, calc(100dvh * ${W / H}))`,
          aspectRatio: `${W} / ${H}`,
          containerType: "inline-size"
        }}
      >
        {/* The approved artwork, untouched. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cfg.src}
          alt="RumRunners: a city with its own rules"
          width={W}
          height={H}
          draggable={false}
          style={{ display: "block", width: "100%", height: "100%", userSelect: "none" }}
        />

        <form onSubmit={onSubmit} noValidate>
          <input
            name="login"
            type="text"
            aria-label="Username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={254}
            style={{ ...inputStyle, ...box(cfg.user) }}
          />
          <input
            name="password"
            type="password"
            aria-label="Password"
            autoComplete="current-password"
            maxLength={128}
            style={{ ...inputStyle, ...box(cfg.pass) }}
          />
          <button
            type="submit"
            disabled={busy}
            aria-label={busy ? "Logging in" : "Login"}
            style={{
              ...box(cfg.btn),
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
              left: pctX(cfg.err.x),
              width: pctX(cfg.err.w),
              top: pctY(cfg.err.y),
              margin: 0,
              padding: "2px 6px",
              boxSizing: "border-box",
              textAlign: "center",
              background: "rgba(10,5,4,0.88)",
              border: "1px solid #7a2a22",
              borderRadius: 3,
              color: "#ff9a8a",
              fontFamily: "Georgia, serif",
              fontSize: "max(12px, 2.2cqw)",
              lineHeight: 1.2
            }}
          >
            {error}
          </p>
        )}

        <nav aria-label="Site links">
          {cfg.links.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              aria-label={l.label}
              style={{
                position: "absolute",
                left: pctX(l.cx - l.w / 2),
                width: pctX(l.w),
                top: pctY(l.cy - l.h / 2),
                height: pctY(l.h),
                display: "block",
                WebkitTapHighlightColor: "rgba(228,192,77,0.25)",
                borderRadius: 4
              }}
            />
          ))}
        </nav>
      </div>
    </div>
  );
}

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
    <main style={{ background: "#050403" }}>
      <style>{CSS}</style>
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
      <Layout cfg={DESKTOP} className="rr-login-desk" error={error} busy={busy} onSubmit={submit} />
      <Layout cfg={MOBILE} className="rr-login-mob" error={error} busy={busy} onSubmit={submit} />
    </main>
  );
}
