
"use client";

import { useState } from "react";
import CasinoGames from "@/components/CasinoGames";
import Forum from "@/components/Forum";

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
  {
    title: "Main",
    items: ["Home", "Updates", "Profile", "Statistics", "Rankings", "Find Player"]
  },
  {
    title: "Messaging",
    items: ["Forum", "Classifieds", "Off Topic", "Messages", "Crew"]
  },
  {
    title: "Campaign",
    items: ["Crimes", "Auto Theft", "Bootlegging", "Organised Crime", "Whack", "Rackets"]
  },
  {
    title: "Resources",
    items: ["Bank", "Market", "Properties", "Store", "Gun Shop", "Hospital"]
  },
  {
    title: "Casino",
    items: ["Blackjack", "Roulette", "Slots", "Keno", "Racetrack"]
  }
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
  const [section, setSection] = useState("Home");
  const [notice, setNotice] = useState("");
  const [energy, setEnergy] = useState(player.energy);
  const [money, setMoney] = useState(player.money);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  async function commitCrime() {
    setBusy(true);
    setNotice("");

    try {
      const response = await fetch("/api/game/crime", {
        method: "POST"
      });

      const data = await response.json();
      setBusy(false);

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
      setBusy(false);
      setNotice("Unable to connect. Please try again.");
    }
  }

  function selectSection(item: string) {
    setSection(item);
    setNotice("");
    setMenuOpen(false);
    setOpenGroup(null);
  }

  return (
    <div className="game">

      <header className="topbar">
        <div className="status-avatar">
          R
        </div>

        <div className="status-identity">
          <strong>{player.username}</strong>
          <span>{player.rank}</span>

          <div className="health-track">
            <i style={{ width: `${player.health}%` }} />
          </div>

          <small>{player.health}%</small>
        </div>

        <div className="status-resources">
          <span>
            <b>£</b>
            {money.toLocaleString("en-GB")}
            <small>Cash</small>
          </span>

          <span>
            <b>▦</b>
            {player.bullets.toLocaleString("en-GB")}
            <small>Bullets</small>
          </span>

          <span>
            <b>⚡</b>
            {energy}/{player.maxEnergy}
            <small>Energy</small>
          </span>
        </div>

        <button
          className="mobile-menu-toggle"
          onClick={() => {
            setMenuOpen(!menuOpen);
            setOpenGroup(null);
          }}
          aria-expanded={menuOpen}
        >
          {menuOpen ? "Close ×" : "Menu"}
        </button>

        <a href="/logout" className="logout">
          Exit
        </a>
      </header>

      <div className="city-strip">
        <div className="city-location">
          <strong>London</strong>
          <span>England</span>
        </div>

        <div className="city-weather">
          <i />
          Calm
        </div>

        <div className="city-era">
          Britain · 1933
        </div>
      </div>

      <div className="game-layout">

        <aside className={`sidebar ${menuOpen ? "menu-open" : ""}`}>

          {!openGroup ? (
            <div className="category-grid">
              {navGroups.map(group => (
                <button
                  key={group.title}
                  className="nav-category"
                  onClick={() => setOpenGroup(group.title)}
                >
                  {group.title}
                </button>
              ))}
            </div>
          ) : (
            <div className="category-content">

              <button
                className="category-back"
                onClick={() => setOpenGroup(null)}
              >
                « {openGroup}
              </button>

              <div className="nav-buttons">
                {navGroups
                  .find(group => group.title === openGroup)
                  ?.items.map(item => (
                    <button
                      key={item}
                      className={
                        section === item
                          ? "nav-item active"
                          : "nav-item"
                      }
                      onClick={() => selectSection(item)}
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
            <h1>
              {section === "Home"
                ? "Welcome to Rumrunners"
                : section}
            </h1>
          </div>

          {(section === "Home" ||
            section === "News" ||
            section === "Updates") && (
            <>
              <div className="game-section-heading">
                Welcome to Rumrunners
              </div>

              <p className="lead">
                The city is awake. Opportunity waits for nobody.
              </p>

              <div className="news-line">
                <b>DISPATCH</b>
                <span>
                  Keep your head down, choose your company
                  carefully, and watch your back.
                </span>
              </div>

              <div className="game-section-heading">
                Getting started
              </div>

              <p>
                Build your reputation through street crimes,
                auto theft and organised jobs. Your decisions
                shape your standing in the city.
              </p>
            </>
          )}

          {section === "Crimes" && (
            <>
              <div className="game-section-heading">
                Criminal Activity
              </div>

              <div className="job-row">
                <div>
                  <b>Street robbery</b>
                  <p>
                    Take a quick opportunity on a quiet street.
                  </p>
                  <small>
                    Cost: 1 energy · Modest reward
                  </small>
                </div>

                <button
                  className="button"
                  disabled={busy}
                  onClick={commitCrime}
                >
                  {busy ? "Working…" : "Attempt crime"}
                </button>
              </div>

              {notice && (
                <p className="notice">{notice}</p>
              )}
            </>
          )}

          {section === "Keno" && (
            <CasinoGames
              game="Keno"
              cash={money}
              onCash={setMoney}
            />
          )}

          {section === "Slots" && (
            <CasinoGames
              game="Slots"
              cash={money}
              onCash={setMoney}
            />
          )}

          {section === "Blackjack" && (
            <p>
              Blackjack table — natural blackjack pays 3:2.
              Table rules and betting limits are being prepared.
            </p>
          )}

          {section === "Roulette" && (
            <p>
              European roulette — single zero, numbers 0–36.
              Betting controls are being prepared.
            </p>
          )}

          {section === "Racetrack" && (
            <p>
              Racetrack — the colour betting game is being prepared.
            </p>
          )}

          {section === "Auto Theft" && (
            <p>
              Auto theft is being built next. This will become
              a repeatable activity with its own outcomes and rewards.
            </p>
          )}

          {section === "Bootlegging" && (
            <p>
              Build your bootlegging operation and move goods
              throughout the city.
            </p>
          )}

          {section === "Organised Crime" && (
            <p>
              Organised jobs will allow four players to work
              together and divide the rewards.
            </p>
          )}

          {section === "Whack" && (
            <p>
              Player combat, weapons, bullets and protection
              will be implemented as server-validated actions.
            </p>
          )}

          {section === "Market" && (
            <p>
              The market will list weapons, ammunition and
              other useful goods.
            </p>
          )}

          {section === "Properties" && (
            <p>
              Properties will provide a place in the city
              and future gameplay benefits.
            </p>
          )}

          {section === "Bank" && (
            <p>
              Bank balance: £{player.bank.toLocaleString("en-GB")}.
              Deposits and withdrawals will be added here.
            </p>
          )}

          {section === "Rankings" && (
            <p>
              The city rankings will list the most notorious players.
            </p>
          )}

          {(section === "Forum" ||
            section === "Classifieds" ||
            section === "Off Topic") && (
            <Forum
              isAdmin={isAdmin}
              playerId={playerId}
              initialCategory={
                section === "Classifieds"
                  ? "CLASSIFIEDS"
                  : section === "Off Topic"
                    ? "OFF_TOPIC"
                    : "OFFICIAL"
              }
            />
          )}

          {section === "Messages" && (
            <p>
              Player-to-player messages and system notices
              will appear here.
            </p>
          )}

          {section === "Profile" && (
            <p>Your criminal profile and personal details.</p>
          )}

          {section === "Statistics" && (
            <p>Your criminal statistics and achievements.</p>
          )}

          {section === "Find Player" && (
            <p>Search for other players in the city.</p>
          )}

          {section === "Crew" && (
            <p>Manage your crew and your associates.</p>
          )}

          {section === "Rackets" && (
            <p>Manage your rackets throughout the city.</p>
          )}

          {section === "Store" && (
            <p>Visit the city store.</p>
          )}

          {section === "Gun Shop" && (
            <p>Visit the gun shop.</p>
          )}

          {section === "Hospital" && (
            <p>Visit the hospital.</p>
          )}

        </main>
      </div>

      <div className="quick-status">
        <div>
          <span>Bank Account</span>
          <b>Ready</b>
        </div>

        <div>
          <span>Health</span>
          <b>{player.health}%</b>
        </div>

        <div>
          <span>Energy</span>
          <b>{energy}/{player.maxEnergy}</b>
        </div>

        <div className="cash-status">
          <span>Cash</span>
          <b>£{money.toLocaleString("en-GB")}</b>
        </div>
      </div>

      <footer className="footer">
        RUMRUNNERS · A CITY WITH ITS OWN RULES
      </footer>

    </div>
  );
}
