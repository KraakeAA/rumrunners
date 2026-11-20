"use client";

import { useState } from "react";
import { MENU_GROUPS, menuHref } from "@/lib/menu";

// A slim top bar with the same Menu as the game, for pages outside the game screen.
export default function SiteMenuBar() {
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState("");

  const items = MENU_GROUPS.find((g) => g.title === group)?.items ?? [];

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto 8px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 10px",
          background: "rgba(11, 15, 13, 0.35)",
          borderBottom: "1px solid rgba(160, 131, 64, 0.35)"
        }}
      >
        <a
          href="/"
          style={{
            fontFamily: "Georgia, serif",
            fontSize: 18,
            letterSpacing: 1,
            color: "#f7efdb",
            textDecoration: "none"
          }}
        >
          RUMRUNNERS
        </a>
        <button
          type="button"
          aria-pressed={open}
          onClick={() => {
            setOpen((o) => !o);
            setGroup("");
          }}
          style={{
            minWidth: 58,
            height: 32,
            padding: "0 10px",
            border: "1px solid #a88b5b",
            borderRadius: 3,
            background: "linear-gradient(180deg, #4a3b28, #292117)",
            color: "#f7efdb",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          Menu
        </button>
      </div>

      {open && (
        <div style={{ border: "1px solid #6b5d3a", borderTop: 0, background: "#1f2a25", padding: 6 }}>
          {group === "" ? (
            <div style={{ display: "grid", gap: 4 }}>
              {MENU_GROUPS.map((g) => (
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
