
"use client";

import { useState } from "react";
import CasinoGames from "@/components/CasinoGames";

type Player = {
  username: string;
  rank: string;
  money: number;
  bank: number;
  bullets: number;
  health: number;
  protection: number;
  energy: number;
  maxEnergy: number;
};

const navGroups = [
  { title: "The City", items: ["News", "Rankings", "Users Online"] },
  { title: "Activities", items: ["Crimes", "Auto Theft", "Organised Crime"] },
  { title: "Combat", items: ["Whack"] },
  { title: "Casinos", items: ["Casinos", "Blackjack", "Roulette", "Slots", "Keno", "Racetrack"] },
  { title: "Economy", items: ["Market", "Properties", "Bank", "Escrow"] },
  { title: "Social", items: ["Forum", "Messages"] }
];

export default function GameShell({
  player,
  isAdmin = false,
  playerId
}: {
  player: Player;
  isAdmin?: boolean;
  playerId: string;
}) {
  const [section, setSection] = useState("News");
  const [notice, setNotice] = useState("");
  const [energy, setEnergy] = useState(player.energy);
  const [money, setMoney] = useState(player.money);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  async function commitCrime() {
    setBusy(true);
    setNotice("");

    try {
      const response = await fetch("/api/game/crime", {
        method: "POST"
      });

      const data = await response.json();

      if (!response.ok) {
        setNotice(data.error || "The job failed.");
        return;
      }

      setEnergy(data.energy);
      setMoney(data.money);

      setNotice(
        data.success
          ? `Job successful. You pocketed £${data.cashChange}.`
          : "The job went wrong. You got away empty-handed."
      );
    } catch {
      setNotice("Unable to connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function navigate(item: string) {
    setNotice("");
    setMenuOpen(false);
    setSelectedGroup(null);

    if (item === "Forum") {
      window.location.href = "/forum";
      return;
    }

    if (item === "Users Online") {
      window.location.href = "/users-online";
      return;
    }

    if (item === "Escrow") {
      window.location.href = "/escrow";
      return;
    }

    setSection(item);
  }

  const currentGroup = navGroups.find(
    group => group.title === selectedGroup
  );

  return (
    <div className="game">
      <header className="topbar">
        <div className="status-avatar">R</div>

        <div className="status-identity">
          <strong>{player.username}</strong>
          <span>{player.rank}</span>
          <small>BRITAIN · 1933</small>
          <div className="health-track">
            <i style={{ width: `${Math.max(0, Math.min(100, player.health))}%` }} />
          </div>
          <small>{player.health}/100 Health</small>
        </div>

        <div className="status-resources">
          <span>
            <b>£{money.toLocaleString("en-GB")}</b>
            <small>Cash</small>
          </span>
          <span>
            <b>{player.bullets}</b>
            <small>Bullets</small>
          </span>
          <span>
            <b>{energy}/{player.maxEnergy}</b>
            <small>Energy</small>
          </span>
        </div>

        <button
          className="mobile-menu-toggle"
          onClick={() => {
            setMenuOpen(!menuOpen);
            setSelectedGroup(null);
          }}
          aria-expanded={menuOpen}
        >
          {menuOpen ? "Close ×" : "☰ Menu"}
        </button>

        <a href="/logout" className="logout">Sign out</a>
      </header>

      <div className="city-strip">
        <div className="city-location">
          <strong>London</strong>
          <span>The City</span>
        </div>
        <div className="city-weather">
          <i />
          Overcast
        </div>
        <div className="city-era">1933</div>
      </div>

      <div className="game-layout">
        <aside className={`sidebar ${menuOpen ? "menu-open" : ""}`}>
          {!selectedGroup ? (
            <>
              <div className="category-grid">
                {navGroups.map(group => (
                  <button
                    key={group.title}
                    className="nav-category"
                    onClick={() => setSelectedGroup(group.title)}
                  >
                    {group.title}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="category-content">
              <button
                className="category-back"
                onClick={() => setSelectedGroup(null)}
              >
                ← All categories
              </button>

              <p className="side-heading">{selectedGroup}</p>

              <div className="nav-buttons">
                {currentGroup?.items.map(item => (
                  <button
                    key={item}
                    onClick={() => navigate(item)}
                    className={section === item ? "nav-item active" : "nav-item"}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        <main className="main-content">
          <div className="page-heading">
            <p className="eyebrow">THE UNDERWORLD</p>
            <h1>{section}</h1>
          </div>

          {section === "News" && (
            <>
              <p className="lead">
                The city is awake. Opportunity waits for nobody.
              </p>

              <div className="news-line">
                <b>DISPATCH</b>
                <span>
                  Keep your head down, choose your company carefully,
                  and watch your back.
                </span>
              </div>

              <h2>Getting started</h2>

              <p>
                Build your reputation through street crimes, auto theft
                and organised jobs. Your decisions shape your standing
                in the city.
              </p>
            </>
          )}

          {section === "Crimes" && (
            <>
              <p className="lead">
                Small jobs keep money moving. They also attract attention.
              </p>

              <div className="job-row">
                <div>
                  <b>Street robbery</b>
                  <p>Take a quick opportunity on a quiet street.</p>
                  <small>Cost: 1 energy · Success earns a modest reward</small>
                </div>

                <button className="button" disabled={busy} onClick={commitCrime}>
                  {busy ? "Working…" : "Attempt crime"}
                </button>
              </div>

              {notice && <p className="notice">{notice}</p>}
            </>
          )}

          {section === "Keno" && (
            <CasinoGames game="Keno" cash={money} onCash={setMoney} />
          )}

          {section === "Slots" && (
            <CasinoGames game="Slots" cash={money} onCash={setMoney} />
          )}

          {section === "Casinos" && (
            <>
              <p className="lead">The city's gaming rooms.</p>
              <div className="nav-buttons">
                {["Blackjack", "Roulette", "Slots", "Keno", "Racetrack"].map(name => (
                  <button key={name} className="nav-item" onClick={() => setSection(name)}>
                    {name}
                  </button>
                ))}
              </div>
            </>
          )}

          {section === "Blackjack" && (
            <p>Blackjack table — natural blackjack pays 3:2. Table rules and betting limits still need final specification.</p>
          )}

          {section === "Roulette" && (
            <p>European roulette — single zero, numbers 0–36. Betting controls are being prepared.</p>
          )}

          {section === "Racetrack" && (
            <p>Racetrack — ten colours and the proposed multiplier ladder. Final colour-to-payout mapping and stake-return convention still need confirmation.</p>
          )}

          {section === "Auto Theft" && (
            <p>Auto theft is being built next. This will become a separate repeatable activity with its own outcomes and rewards.</p>
          )}

          {section === "Organised Crime" && (
            <p>Organised jobs are being built next: four players, a leader, three invited crew members and a freely allocated 100% payout split locked when the job begins.</p>
          )}

          {section === "Whack" && (
            <p>Player combat, weapons, bullets and protection will be implemented as server-validated actions.</p>
          )}

          {section === "Market" && (
            <p>The market will list weapons, ammunition and other useful goods.</p>
          )}

          {section === "Properties" && (
            <p>Properties will provide a place in the city and future gameplay benefits.</p>
          )}

          {section === "Bank" && (
            <p>Bank balance: £{player.bank.toLocaleString("en-GB")}. Deposits and withdrawals will be added here.</p>
          )}

          {section === "Rankings" && (
            <p>The city rankings will list the most notorious players.</p>
          )}

          {section === "Messages" && (
            <p>Player-to-player messages and system notices will appear here.</p>
          )}
        </main>

        <aside className="right-panel">
          <h2>YOUR POSITION</h2>

          <div className="stat">
            <span>Rank</span>
            <b>{player.rank}</b>
          </div>

          <div className="stat">
            <span>Cash</span>
            <b>£{money.toLocaleString("en-GB")}</b>
          </div>

          <div className="stat">
            <span>Bank</span>
            <b>£{player.bank.toLocaleString("en-GB")}</b>
          </div>

          <div className="stat">
            <span>Bullets</span>
            <b>{player.bullets}</b>
          </div>

          <div className="stat">
            <span>Energy</span>
            <b>{energy}/{player.maxEnergy}</b>
          </div>

          <div className="meter-label">
            <span>Health</span>
            <b>{player.health}%</b>
          </div>

          <div className="meter">
            <i className="health" style={{ width: `${player.health}%` }} />
          </div>

          <div className="meter-label">
            <span>Protection</span>
            <b>{player.protection}%</b>
          </div>

          <div className="meter">
            <i className="protection" style={{ width: `${player.protection}%` }} />
          </div>
        </aside>
      </div>

      <footer className="footer">
        RUMRUNNERS · A CITY WITH ITS OWN RULES
      </footer>
    </div>
  );
}
