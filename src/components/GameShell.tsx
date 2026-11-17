
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

const menuGroups = [
  {
    title: "Main",
    items: [
      "Home",
      "Updates",
      "Suggestion Box",
      "Rumrunners Live",
      "Wiki",
      "Terms of Service",
      "Find Player",
      "Help Desk",
      "Profile",
      "Cities",
      "Statistics",
      "Users Online",
      "Logout",
      "Full Site"
    ]
  },
  {
    title: "Messaging",
    items: [
      "Forums",
      "Crew",
      "Game",
      "Classifieds",
      "Off Topic",
      "Mailbox",
      "Saved Mail",
      "Send Letter"
    ]
  },
  {
    title: "Campaign",
    items: [
      "Auto Theft",
      "Bootlegging",
      "Crew",
      "Crimes",
      "Graveyard",
      "Gymnasium",
      "Whack",
      "Hitlist",
      "Organised Crime",
      "Rackets",
      "Search",
      "Shooting Range"
    ]
  },
  {
    title: "Resources",
    items: [
      "Gun Shop",
      "Escrow",
      "Store",
      "Gold",
      "Marketplace",
      "Hospital",
      "Jail",
      "Local Bank",
      "Pawn Shop",
      "Stock Market",
      "Train Station",
      "Brothel"
    ]
  },
  {
    title: "Casino",
    items: [
      "Blackjack",
      "Jacks or Better",
      "Keno",
      "Lottery",
      "Poker Run",
      "Race Track",
      "Roulette",
      "Slot Machines",
      "Sports Betting"
    ]
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
  const [selectedGroup, setSelectedGroup] = useState("Main");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [energy, setEnergy] = useState(player.energy);
  const [money, setMoney] = useState(player.money);
  const [busy, setBusy] = useState(false);

  const activeGroup = menuGroups.find(
    group => group.title === selectedGroup
  );

  async function commitCrime() {
    setBusy(true);
    setNotice("");

    try {
      const response = await fetch("/api/game/crime", {
        method: "POST"
      });

      const data = await response.json();

      if (!response.ok) {
        setNotice(
          data.error === "COOLDOWN"
            ? "The streets need time to cool down before your next job."
            : data.error === "NO_ENERGY"
              ? "You're exhausted. Wait for your energy to recover."
              : data.error || "The job failed."
        );
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

    if (item === "Logout") {
      window.location.href = "/logout";
      return;
    }

    if (item === "Profile") {
      window.location.href =
        `/profile/${encodeURIComponent(player.username)}`;
      return;
    }

    if (item === "Users Online") {
      window.location.href = "/users-online";
      return;
    }

    if (item === "Forums") {
      window.location.href = "/forum";
      return;
    }

    if (item === "Escrow") {
      window.location.href = "/escrow";
      return;
    }

    setSection(item);
  }

  function selectGroup(group: string) {
    setSelectedGroup(group);
    setMenuOpen(true);
  }

  return (
    <div className="game">

      <header className="topbar">
        <div className="brand">
          <span>R</span>
          <strong>RUMRUNNERS</strong>
          <small>BRITAIN · 1933</small>
        </div>

        <div className="top-player">
          <b>{player.username}</b>
          <span>{player.rank}</span>
          <span>£{money.toLocaleString("en-GB")}</span>
        </div>

        <button
          className="mobile-menu-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? "Close" : "Menu"}
        </button>
      </header>

      <div className="game-layout">

        <aside className={`sidebar ${menuOpen ? "menu-open" : ""}`}>

          {!menuOpen ? (
            <>
              <p className="side-heading">THE UNDERWORLD</p>

              {menuGroups.map(group => (
                <button
                  key={group.title}
                  className="nav-item"
                  onClick={() => selectGroup(group.title)}
                >
                  {group.title}
                </button>
              ))}
            </>
          ) : (
            <>
              <button
                className="nav-item active"
                onClick={() => setMenuOpen(false)}
              >
                × Close menu
              </button>

              <p className="side-heading">{selectedGroup}</p>

              <div className="menu-grid">
                {activeGroup?.items.map(item => (
                  <button
                    key={item}
                    className={
                      item === "Logout"
                        ? "nav-item logout-menu-item"
                        : "nav-item"
                    }
                    onClick={() => navigate(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <button
                className="nav-item"
                onClick={() => setMenuOpen(false)}
              >
                ← All categories
              </button>
            </>
          )}
        </aside>

        <main className="main-content">

          <div className="page-heading">
            <p className="eyebrow">THE UNDERWORLD</p>
            <h1>{section}</h1>
          </div>

          {section === "Home" && (
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

                <button
                  className="button"
                  disabled={busy}
                  onClick={commitCrime}
                >
                  {busy ? "Working…" : "Attempt crime"}
                </button>
              </div>

              {notice && <p className="notice">{notice}</p>}
            </>
          )}

          {section === "Keno" && (
            <CasinoGames game="Keno" cash={money} onCash={setMoney} />
          )}

          {section === "Slot Machines" && (
            <CasinoGames game="Slots" cash={money} onCash={setMoney} />
          )}

          {section === "Blackjack" && (
            <p>Blackjack table. Betting and game controls are being developed.</p>
          )}

          {section === "Roulette" && (
            <p>European roulette. Betting and game controls are being developed.</p>
          )}

          {section === "Home" && null}

          {section === "Auto Theft" && (
            <p>Auto theft will have its own jobs, vehicles and outcomes.</p>
          )}

          {section === "Bootlegging" && (
            <p>Build your bootlegging operation and supply the city's demand.</p>
          )}

          {section === "Organised Crime" && (
            <p>
              Organised jobs will support four players, invitations and
              a payout split totalling 100%.
            </p>
          )}

          {section === "Whack" && (
            <p>Player combat, weapons, bullets and protection.</p>
          )}

          {section === "Hitlist" && (
            <p>View and manage your targets.</p>
          )}

          {section === "Rackets" && (
            <p>Manage your criminal rackets around the city.</p>
          )}

          {section === "Local Bank" && (
            <p>
              Bank balance: £{player.bank.toLocaleString("en-GB")}.
              Deposits and withdrawals will be developed here.
            </p>
          )}

          {section === "Marketplace" && (
            <p>Buy and sell goods with other players.</p>
          )}

          {section === "Gun Shop" && (
            <p>Weapons and ammunition will be available here.</p>
          )}

          {section === "Escrow" && (
            <p>Secure player-to-player trading.</p>
          )}

          {section === "Rankings" && (
            <p>The city's most notorious players.</p>
          )}

          {section === "Statistics" && (
            <p>Your criminal statistics and career history.</p>
          )}

          {section === "Find Player" && (
            <p>Search for another player in Rumrunners.</p>
          )}

          {section === "Messages" && (
            <p>Player-to-player messages and system notices.</p>
          )}

          {section === "Mailbox" && (
            <p>Your incoming messages.</p>
          )}

          {section === "Classifieds" && (
            <p>Player advertisements and listings.</p>
          )}

          {section === "Off Topic" && (
            <p>General conversation away from the game.</p>
          )}

          {section === "Crew" && (
            <p>Your crew and criminal associates.</p>
          )}

          {section === "Updates" && (
            <p>News and development updates from Rumrunners.</p>
          )}

          {section === "Cities" && (
            <p>Explore the cities available in the game.</p>
          )}

          {section === "Jail" && (
            <p>Jail information and sentence details.</p>
          )}

          {section === "Hospital" && (
            <p>Medical treatment and recovery.</p>
          )}

          {section === "Graveyard" && (
            <p>Remember those who have fallen.</p>
          )}

          {section === "Gymnasium" && (
            <p>Train your character and improve your abilities.</p>
          )}

          {section === "Search" && (
            <p>Search the city for opportunities.</p>
          )}

          {section === "Full Site" && (
            <p>You are viewing the full Rumrunners game.</p>
          )}

          {section === "Suggestion Box" && (
            <p>Send suggestions for future game improvements.</p>
          )}

          {section === "Rumrunners Live" && (
            <p>Live news and activity from the underworld.</p>
          )}

          {section === "Wiki" && (
            <p>The Rumrunners game guide.</p>
          )}

          {section === "Terms of Service" && (
            <p>Game rules and terms of service.</p>
          )}

          {section === "Help Desk" && (
            <p>Help and support for players.</p>
          )}

          {section === "Send Letter" && (
            <p>Write a letter to another player.</p>
          )}

          {section === "Saved Mail" && (
            <p>Your saved messages.</p>
          )}

          {section === "Gold" && (
            <p>Gold account features.</p>
          )}

          {section === "Store" && (
            <p>The Rumrunners store.</p>
          )}

          {section === "Pawn Shop" && (
            <p>Buy and sell items at the pawn shop.</p>
          )}

          {section === "Stock Market" && (
            <p>Investments and the stock market.</p>
          )}

          {section === "Train Station" && (
            <p>Travel between cities.</p>
          )}

          {section === "Brothel" && (
            <p>Visit the city's establishments.</p>
          )}

          {section === "Lottery" && (
            <p>The city lottery.</p>
          )}

          {section === "Poker Run" && (
            <p>Poker Run.</p>
          )}

          {section === "Race Track" && (
            <p>Race Track.</p>
          )}

          {section === "Jacks or Better" && (
            <p>Jacks or Better.</p>
          )}

          {section === "Sports Betting" && (
            <p>Sports betting.</p>
          )}

          {section === "Auto Theft" && null}

          {section === "Profile" && (
            <p>Your player profile.</p>
          )}

          {section !== "Home" && notice && (
            <p className="notice">{notice}</p>
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
            <i
              className="health"
              style={{ width: `${player.health}%` }}
            />
          </div>

          <div className="meter-label">
            <span>Protection</span>
            <b>{player.protection}%</b>
          </div>

          <div className="meter">
            <i
              className="protection"
              style={{ width: `${player.protection}%` }}
            />
          </div>
        </aside>
      </div>

      <div className="game-status-strip">
        <div>
          <span>Bank Account</span>
          <strong>Ready</strong>
        </div>
        <div>
          <span>Jail</span>
          <strong>Free</strong>
        </div>
        <div>
          <span>Organised Crime</span>
          <strong>Ready</strong>
        </div>
        <div>
          <span>Rackets</span>
          <strong>Not active</strong>
        </div>
      </div>

      <footer className="footer">
        RUMRUNNERS · A CITY WITH ITS OWN RULES
      </footer>
    </div>
  );
}
