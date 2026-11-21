import Link from "next/link";
import type { ReactNode } from "react";

// A small page in the game's brass-and-green look, for the links on the login screen.
export default function SimplePage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main style={{ minHeight: "100dvh", background: "#0b0f0d", padding: "16px 12px", color: "#f1e8d3" }}>
      <div style={{ width: "100%", maxWidth: 560, margin: "0 auto" }}>
        <div
          style={{
            padding: "6px 8px",
            textAlign: "center",
            fontFamily: "Georgia, serif",
            fontSize: 16,
            color: "#f7efdb",
            background: "linear-gradient(180deg, #8a7038, #4d3d1c)",
            borderTop: "1px solid #b0904a",
            borderBottom: "1px solid #b0904a",
            textShadow: "0 1px 2px #000"
          }}
        >
          {title}
        </div>
        <div
          style={{
            border: "1px solid #6b5d3a",
            borderTop: 0,
            background: "#1f2a25",
            padding: "12px 12px",
            fontSize: 14,
            lineHeight: 1.55
          }}
        >
          {children}
        </div>
        <p style={{ textAlign: "center", marginTop: 14 }}>
          <Link href="/login" style={{ color: "#e4c04d" }}>
            ← Back to login
          </Link>
        </p>
      </div>
    </main>
  );
}
