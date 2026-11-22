"use client";

// Shown once after you break yourself out of prison, over whatever page you land on.
export default function BreakoutPopup({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-label="Escaped from prison"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 310,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(0, 0, 0, 0.6)"
      }}
    >
      <div style={{ width: "100%", maxWidth: 280 }}>
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            padding: "12px 14px 10px",
            textAlign: "center",
            background: "#2a2619",
            border: "1px solid #c69a48",
            boxShadow: "0 6px 22px rgba(0,0,0,0.75)"
          }}
        >
          <div style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 700, color: "#fff3cf" }}>
            Breakout!
          </div>
          <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.4, color: "#f3ead0" }}>
            You successfully busted yourself out of prison. You&apos;re a free man again.
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{ display: "block", marginLeft: "auto", marginTop: 4, background: "none", border: 0, color: "#d4cab2", fontSize: 11, cursor: "pointer" }}
        >
          (Click to close)
        </button>
      </div>
    </div>
  );
}
