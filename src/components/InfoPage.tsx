"use client";

import type { CSSProperties } from "react";

const bar: CSSProperties = {
  padding: "6px 8px",
  textAlign: "center",
  fontFamily: "Georgia, serif",
  fontSize: 15,
  color: "#f7efdb",
  background: "linear-gradient(180deg, #8a7038, #4d3d1c)",
  borderTop: "1px solid #b0904a",
  borderBottom: "1px solid #b0904a",
  textShadow: "0 1px 2px #000"
};
const head: CSSProperties = { ...bar, fontSize: 13, padding: "4px 8px", marginTop: 6 };
const box: CSSProperties = {
  border: "1px solid #6b5d3a",
  borderTop: 0,
  background: "#1f2a25",
  padding: "8px 10px",
  fontSize: 13,
  lineHeight: 1.5
};

type Section = { title: string; lines: string[] };

const TERMS: Section[] = [
  {
    title: "Playing fair",
    lines: [
      "One account per person. Do not create extra accounts to help your main account, to dodge a ban, or to hold money, gold or property for yourself.",
      "Do not use bots, scripts, macros or anything else that plays the game for you.",
      "Do not exploit bugs. If you find one, report it in the Help Desk. Using a bug for gain can lead to the gain being removed and the account being banned."
    ]
  },
  {
    title: "Behaviour",
    lines: [
      "Be civil on the forums and in letters. No harassment, threats, hate speech, or sexual or illegal content.",
      "Do not share other people's personal details.",
      "Do not impersonate the admins."
    ]
  },
  {
    title: "Trading",
    lines: [
      "Game money, gold and property have no real-world value. Do not sell them for real money or buy them with real money.",
      "Do not ask other players for their password. Admins will never ask for yours."
    ]
  },
  {
    title: "Admins",
    lines: [
      "Admins may remove content, adjust an account, jail, or ban an account if these rules are broken. A banned account sees the reason when it tries to sign in.",
      "Admin decisions are final, but you can appeal through the Help Desk.",
      "These rules may change. Big changes will be posted on the Updates page."
    ]
  }
];

const WIKI: Section[] = [
  {
    title: "Getting started",
    lines: [
      "You begin as a Scum in London with £500. Every new life gets seven days of protection from attack.",
      "Everything you do costs energy. You have up to 400 energy and gain 10 every 40 seconds. Gym training lowers what jobs cost.",
      "Money in your hand can be stolen or lost. Keep it safe in the Local Bank, which pays interest."
    ]
  },
  {
    title: "Making money",
    lines: [
      "Crimes: jobs in four tiers that unlock as you rise in rank. Each job has its own wait before you can repeat it.",
      "Auto Theft: steal cars at four levels. Finer cars are harder to take. A car keeps the number plate of the city where it was stolen.",
      "Bootlegging: buy booze in one city and sell it in another. You cannot sell crates in the city where you bought them.",
      "Organised Crime: a leader and three crew members, each with a role, pull off bigger jobs together."
    ]
  },
  {
    title: "Cars and the Garage",
    lines: [
      "Cars are not driven. Melt them down for bullets at the Bullet Factory, use them on Organised Crime jobs, or trade them in Escrow.",
      "From the Garage you can ship a car to another city by rail freight for a fee. The plate does not change.",
      "A new plate costs a little and cools the car's heat. Damaged cars can be repaired in the workshop on the Auto Theft page."
    ]
  },
  {
    title: "Crews",
    lines: [
      "A crew is a gang with a leader, a colour, a bank and up to 24 members. Only ten crews can exist at once, so starting one is a big deal.",
      "Apply to a crew from the Crew page. The leader sets the questions and decides.",
      "Any member can pay into the crew bank. Only the leader can take money out."
    ]
  },
  {
    title: "Staying alive",
    lines: [
      "You can be shot and killed. A dead player must start a new life, but gold survives. You can revive an old name or pick a new one.",
      "Heal in the Hospital. Jail stops many actions until your sentence ends or you break out."
    ]
  },
  {
    title: "Money between players",
    lines: [
      "Bank transfers between players carry a 10% fee.",
      "Escrow holds both sides of a trade until both agree. The Marketplace is where gold is bought and sold."
    ]
  }
];

export default function InfoPage({ kind }: { kind: "terms" | "wiki" }) {
  const sections = kind === "terms" ? TERMS : WIKI;
  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
      <div style={bar}>{kind === "terms" ? "Terms of Service" : "Rumrunners Wiki"}</div>
      <div style={{ ...box, color: "#b7ad93", fontSize: 12 }}>
        {kind === "terms"
          ? "By playing Rumrunners you agree to the rules below."
          : "A short guide to how the game works. It will grow over time."}
      </div>
      {sections.map((s) => (
        <div key={s.title}>
          <div style={head}>{s.title}</div>
          <div style={box}>
            {s.lines.map((l, i) => (
              <p key={i} style={{ margin: i === 0 ? 0 : "6px 0 0" }}>
                {l}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
