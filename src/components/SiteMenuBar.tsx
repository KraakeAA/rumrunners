"use client";

import { useEffect, useRef, useState } from "react";
import { MENU_GROUPS, menuHref } from "@/lib/menu";
import { skyFor, SKYLINE } from "@/lib/sky";
import { clock, useActionStatus } from "@/components/EnergyBar";

type Balance = {
  money: number;
  gold: number;
  health: number;
  staff: number;
  unreadMail: number;
};

// The same top bar as the game screen (health, cash, gold, energy, mail, jail and
// Menu) for the pages that sit outside it: profiles, users online, crews.
export default function SiteMenuBar() {
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState("");
  const [bal, setBal] = useState<Balance | null>(null);
  const [top, setTop] = useState(0);
  const [city, setCity] = useState("London");
  const [ukClock, setUkClock] = useState("--:--:--");
  const [ukDate, setUkDate] = useState("");
  const barRef = useRef<HTMLDivElement>(null);
  const status = useActionStatus({ energy: 0, maxEnergy: 400 });

  useEffect(() => {
    let alive = true;
    async function check() {
      if (document.hidden) return;
      try {
        const r = await fetch("/api/balance", { cache: "no-store" });
        if (!r.ok || !alive) return;
        setBal(await r.json());
      } catch {
        /* try again next time */
      }
    }
    check();
    const t = window.setInterval(check, 5000);
    document.addEventListener("visibilitychange", check);
    return () => {
      alive = false;
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setUkClock(
        new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(now)
      );
      setUkDate(
        new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now)
      );
    };
    tick();
    const t = window.setInterval(tick, 1000);
    (async () => {
      try {
        const r = await fetch("/api/travel", { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        if (typeof d.currentCity === "string") setCity(d.currentCity);
      } catch {
        /* keep London */
      }
    })();
    return () => window.clearInterval(t);
  }, []);

  const sky = skyFor(ukClock);

  // While the menu is open it covers the page under the top bar, exactly like
  // the game screen, instead of pushing the page down.
  useEffect(() => {
    if (!open) return;
    window.scrollTo(0, 0);
    const measure = () => setTop(barRef.current?.getBoundingClientRect().bottom ?? 0);
    measure();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("resize", measure);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("resize", measure);
    };
  }, [open]);

  const staff = bal?.staff ?? 0;
  const groups = MENU_GROUPS.map((g) =>
    g.title === "Main" && staff >= 2 ? { ...g, items: [...g.items, "Admin"] } : g
  );
  const items = groups.find((g) => g.title === group)?.items ?? [];
  const mail = bal?.unreadMail ?? status.unreadMail;
  const health = bal?.health ?? 100;
  const iconBtn = {
    position: "relative" as const,
    width: 34,
    height: 38,
    display: "grid",
    placeItems: "center",
    padding: 0,
    border: 0,
    background: "transparent",
    color: "#e8d7b6",
    textShadow: "0 1px 3px #000",
    cursor: "pointer",
    textDecoration: "none"
  };

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto 8px" }}>
      <div
        ref={barRef}
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 6,
          padding: "4px 4px 8px",
          position: "relative",
          overflow: "hidden",
          background: sky.background,
          borderBottom: 0
        }}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 400 20"
          preserveAspectRatio="none"
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, width: "100%", height: 20, pointerEvents: "none" }}
        >
          <path d={SKYLINE.d} fill="#0b0f0d" />
          {SKYLINE.windows.map(([wx, wy]) => (
            <rect key={`${wx}-${wy}`} x={wx} y={wy} width="1.2" height="1.4" fill="#f2c96a" opacity={sky.lights * 0.85} />
          ))}
        </svg>
        <div style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: 5, minWidth: 0, flex: 1 }}>
          <a
            href="/"
            aria-label="Back to the game"
            title="Back to the game"
            style={{
              position: "relative",
              width: 38,
              height: 44,
              flexShrink: 0,
              overflow: "hidden",
              border: "1px solid #7d7a70",
              borderRadius: 2,
              background: "linear-gradient(180deg, #393126, #211c16)",
              display: "block"
            }}
          >
            <svg viewBox="0 0 40 44" width="24" height="27" aria-hidden="true" style={{ display: "block", margin: "2px auto 0" }}>
              <ellipse cx="20" cy="8" rx="12" ry="2.5" fill="#cbb98a" />
              <rect x="13" y="1" width="14" height="8" rx="2" fill="#e8d7b6" />
              <circle cx="20" cy="16" r="6" fill="#c9b48a" />
              <path d="M6 42 Q8 26 20 24 Q32 26 34 42 Z" fill="#8a7a58" />
            </svg>
            <span aria-label={`Health ${health}%`} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 10, background: "#1a1410" }}>
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${Math.max(0, Math.min(100, health))}%`,
                  background: health > 50 ? "#3f9a46" : health > 25 ? "#c9923a" : "#b3342a"
                }}
              />
              <span style={{ position: "relative", display: "block", textAlign: "center", fontSize: 8, lineHeight: "10px", fontWeight: 700, color: "#fff", textShadow: "0 1px 1px #000" }}>
                {health}%
              </span>
            </span>
          </a>

          <div style={{ minWidth: 0, flex: 1, maxWidth: 150 }}>
            <div style={{ display: "grid", gap: 1, padding: "2px 6px", background: "rgba(0, 0, 0, 0.55)", borderRadius: 2, color: "#f1e8d3" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", minWidth: 0 }}>
                <span
                  aria-hidden="true"
                  style={{ width: 14, height: 8, borderRadius: 2, border: "1px solid #3f8a4d", background: "linear-gradient(135deg, #4f9a5a, #2a5c34)", flexShrink: 0 }}
                />
                <strong style={{ fontSize: 12, fontWeight: 400, color: "#f7efdb", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {bal ? `£${bal.money.toLocaleString("en-GB")}` : "…"}
                </strong>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", fontSize: 12 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "radial-gradient(circle at 35% 30%, #fff2a8, #e4b822 55%, #9a7410)",
                    border: "1px solid #7a5a0c",
                    flexShrink: 0,
                    marginLeft: 2
                  }}
                />
                <strong style={{ fontWeight: 400, color: "#f7efdb" }}>{bal ? bal.gold.toLocaleString("en-GB") : "…"}</strong>
              </span>
            </div>

            <div
              aria-label={`Energy ${status.energy} of ${status.maxEnergy}`}
              style={{
                position: "relative",
                height: 13,
                marginTop: 3,
                background: "rgba(0, 0, 0, 0.55)",
                border: "1px solid #6b5d3a",
                borderRadius: 3,
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${Math.max(0, Math.min(100, (status.energy / Math.max(1, status.maxEnergy)) * 100))}%`,
                  background: "linear-gradient(180deg, #c9a43a, #7a6016)",
                  transition: "width 0.4s"
                }}
              />
              <div style={{ position: "relative", textAlign: "center", fontSize: 10, lineHeight: "11px", fontWeight: 600, color: "#fff", textShadow: "0 1px 2px #000" }}>
                {status.energy} / {status.maxEnergy}
              </div>
            </div>
          </div>
        </div>

        <nav aria-label="Game shortcuts" style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2, flexShrink: 0, marginLeft: "auto" }}>
          <a href={menuHref("Mailbox")} aria-label="Messages" title="Messages" style={{ ...iconBtn, fontSize: 22 }}>
            ✉
            {mail > 0 && (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: -2,
                  right: -2,
                  minWidth: 15,
                  height: 15,
                  padding: "0 3px",
                  boxSizing: "border-box",
                  borderRadius: 9,
                  background: "#c0392b",
                  color: "#fff",
                  fontSize: 9,
                  lineHeight: "15px",
                  fontWeight: 700,
                  textAlign: "center",
                  textShadow: "none"
                }}
              >
                {mail > 99 ? "99+" : mail}
              </span>
            )}
          </a>
          <a href={menuHref("Jail")} aria-label="Jail" title={status.jailLeft > 0 ? `Jail: ${clock(status.jailLeft)}` : "Jail"} style={{ ...iconBtn, fontSize: 20 }}>
            ▥
          </a>
          <button
            type="button"
            aria-label="Menu"
            aria-pressed={open}
            onClick={() => {
              setOpen((o) => !o);
              setGroup("");
            }}
            style={{
              minWidth: 42,
              height: 38,
              padding: "0 6px",
              border: "1px solid #b9b6ad",
              borderRadius: 2,
              background: "rgba(0, 0, 0, 0.6)",
              color: "#f7efdb",
              fontSize: 12,
              cursor: "pointer"
            }}
          >
            Menu
          </button>
        </nav>
      </div>

      {open && (
        <div
          style={{
            position: "fixed",
            top,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 50,
            overflowY: "auto",
            background: "#0b0f0d"
          }}
        >
        <div style={{ width: "100%", maxWidth: 560, margin: "0 auto" }}>
        <div
          className="city-strip"
          style={{ minHeight: 40, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "nowrap", gap: 8, padding: "4px 10px", background: "transparent", borderBottom: 0 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div className="city-location" style={{ flexShrink: 0 }}>
              <strong>{city}</strong>
              <span>{city === "London" ? "Greater London" : "Britain"}</span>
            </div>
            <div className="city-weather" style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", fontSize: 12 }}>
              <span aria-hidden="true">☁</span>
              <span>Overcast</span>
            </div>
          </div>
          <div className="city-era" style={{ width: "auto", marginLeft: "auto", flexShrink: 0, textAlign: "right", lineHeight: 1.25 }}>
            <strong style={{ fontSize: 15 }}>{ukClock}</strong>
            <span style={{ fontSize: 10 }}>{ukDate} · UK TIME</span>
          </div>
        </div>
        </div>
        <div className="menu-screen" style={{ width: "100%", maxWidth: 560, margin: "0 auto", boxSizing: "border-box", padding: "4px 0" }}>
          {group === "" ? (
            <>
              <p className="side-heading">MENU</p>
              <div className="category-grid">
                {groups.map((g) => (
                  <button key={g.title} type="button" className="nav-category" onClick={() => setGroup(g.title)}>
                    {g.title}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="category-content">
              <button type="button" className="category-back" onClick={() => setGroup("")}>
                « {group}
              </button>
              <div className="nav-buttons">
                {items.map((item) => (
                  <a
                    key={item}
                    href={menuHref(item)}
                    className={item === "Logout" ? "nav-item logout-menu-item" : "nav-item"}
                    style={{ display: "block", textDecoration: "none", boxSizing: "border-box" }}
                  >
                    {item}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div
            className="game-status-strip"
            style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 12, padding: "4px 8px", background: "#000000", borderTop: "0", borderBottom: "1px solid #494033" }}
          >
            {[
              { label: "Jail", status: status.jailLeft > 0 ? clock(status.jailLeft) : "Free", target: "Jail" },
              { label: "Organised Crime", status: "Ready", target: "Organised Crime" },
              { label: "Rackets", status: "Not active", target: "Rackets" }
            ].map((it) => (
              <a
                key={it.label}
                href={menuHref(it.target)}
                aria-label={`${it.label}: ${it.status}`}
                title={`Go to ${it.label}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  flex: "0 0 auto",
                  padding: "2px 7px",
                  border: "1px solid #3f8a4d",
                  borderRadius: 3,
                  background: "#1e3a22",
                  color: "#7fe08f",
                  fontSize: 10,
                  lineHeight: 1.3,
                  textAlign: "center",
                  textDecoration: "none",
                  cursor: "pointer"
                }}
              >
                <span style={{ display: "inline", margin: 0, color: "#a9e8b3" }}>{it.label}</span>
                <strong style={{ color: "#7fe08f", fontWeight: 600 }}>{it.status}</strong>
              </a>
            ))}
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
