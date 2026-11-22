"use client";

// Shown once when a job or theft earns a new rank.
export default function PromotionPopup({ rank, onClose }: { rank: string; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-label="Promotion"
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
      <div style={{ position: "relative", width: "100%", maxWidth: 300, paddingLeft: 34 }}>
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          style={{ position: "absolute", left: 0, top: "50%", width: 74, height: 74, transform: "translateY(-50%)", zIndex: 2, filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.7))" }}
        >
          <defs>
            <linearGradient id="promoStar" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffe48a" />
              <stop offset="0.55" stopColor="#c69a48" />
              <stop offset="1" stopColor="#8a6a22" />
            </linearGradient>
          </defs>
          <polygon
            points="50,4 62,36 96,38 69,59 79,92 50,73 21,92 31,59 4,38 38,36"
            fill="url(#promoStar)"
            stroke="#5a430f"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative",
            padding: "14px 12px 10px 46px",
            textAlign: "center",
            background: "#2a2619",
            border: "1px solid #c69a48",
            boxShadow: "0 6px 22px rgba(0,0,0,0.75)"
          }}
        >
          <div style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 700, textDecoration: "underline", color: "#fff3cf" }}>
            Promotion!
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: "#f3ead0" }}>You have been promoted to:</div>
          <div style={{ marginTop: 6, fontFamily: "Georgia, serif", fontSize: 16, color: "#ffe48a" }}>{rank}</div>
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
