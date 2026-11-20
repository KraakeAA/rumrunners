"use client";

import { useEffect, useState } from "react";
import { MENU_GROUPS, menuHref } from "@/lib/menu";
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
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 6,
          padding: "4px 4px 6px",
          background: "linear-gradient(180deg, #0e1424 0%, #1a2236 100%)",
          borderBottom: "1px solid rgba(160, 131, 64, 0.5)"
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 5, minWidth: 0, flex: 1 }}>
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

        <nav aria-label="Game shortcuts" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2, flexShrink: 0, marginLeft: "auto" }}>
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
        <div style={{ border: "1px solid #6b5d3a", borderTop: 0, background: "#1f2a25", padding: 6 }}>
          {group === "" ? (
            <div style={{ display: "grid", gap: 4 }}>
              {groups.map((g) => (
                <button
                  key={g.title}
                  type="button"
                  onClick={() => setGroup(g.title)}
                  style={{
                    padding: "9px 10px",
                    textAlign: "left",
                    border: "1px solid #6b5d3a",
                    background: "#2a3630",
                    color: "#f7efdb",
                    fontSize: 14,
                    cursor: "pointer"
                  }}
                >
                  {g.title}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 4 }}>
              <button
                type="button"
                onClick={() => setGroup("")}
                style={{
                  padding: "8px 10px",
                  textAlign: "left",
                  border: "1px solid #a08340",
                  background: "#3a3222",
                  color: "#f7efdb",
                  fontSize: 14,
                  cursor: "pointer"
                }}
              >
                « {group}
              </button>
              {items.map((item) => (
                <a
                  key={item}
                  href={menuHref(item)}
                  style={{
                    display: "block",
                    padding: "9px 10px",
                    border: "1px solid #6b5d3a",
                    background: "#2a3630",
                    color: "#f7efdb",
                    fontSize: 14,
                    textDecoration: "none"
                  }}
                >
                  {item}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
