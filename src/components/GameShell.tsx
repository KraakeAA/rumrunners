"use client";

import { useEffect, useMemo, useState } from "react";
import CasinoGames from "@/components/CasinoGames";
import { CRIMES, xpForLevel } from "@/lib/game";

type Player = {
  username: string;
  rank: string;
  rankLevel: number;
  money: number;
  bank: number;
  gold: number;
  bullets: number;
  health: number;
  protection: number;
  energy: number;
  maxEnergy: number;
  experience: number;
  lastCrimeAt: string | null;
  currentCity: string;
};

type CrimeLog = {
  crimeType: string;
  success: boolean;
  cashChange: number;
  createdAt: string;
};

const menuGroups = [
  {
    title: "Main",
    items: [
      "Home", "Updates", "Suggestion Box", "Rumrunners Live",
      "Wiki", "Terms of Service", "Find Player", "Help Desk",
      "Profile", "Cities", "Statistics", "Users Online",
      "Logout", "Full Site"
    ]
  },
  {
    title: "Messaging",
    items: [
      "Forums", "Crew", "Game", "Classifieds",
      "Off Topic", "Mailbox", "Saved Mail", "Send Letter"
    ]
  },
  {
    title: "Campaign",
    items: [
      "Auto Theft", "Bootlegging", "Crew", "Crimes",
      "Graveyard", "Gymnasium", "Whack", "Hitlist",
      "Organised Crime", "Rackets", "Search", "Shooting Range"
    ]
  },
  {
    title: "Resources",
    items: [
      "Gun Shop", "Escrow", "Store", "Gold",
      "Marketplace", "Hospital", "Jail", "Local Bank",
      "Pawn Shop", "Stock Market", "Railway", "Brothel"
    ]
  },
  {
    title: "Casino",
    items: [
      "Blackjack", "Jacks or Better", "Keno", "Lottery",
      "Poker Run", "Race Track", "Roulette",
      "Slot Machines", "Sports Betting"
    ]
  }
];

export default function GameShell({
  player,
  isAdmin = false,
  playerId,
  recentCrimes = []
}: {
  player: Player;
  isAdmin?: boolean;
  playerId: string;
  recentCrimes?: CrimeLog[];
}) {
  const [section, setSection] = useState("Home");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [energy, setEnergy] = useState(player.energy);
  const [money, setMoney] = useState(player.money);
  const [bank, setBank] = useState(player.bank);
  const [rank, setRank] = useState(player.rank);
  const [rankLevel, setRankLevel] = useState(player.rankLevel);
  const [experience, setExperience] = useState(player.experience);
  const [lastCrimeAt, setLastCrimeAt] = useState(player.lastCrimeAt);
  const [busy, setBusy] = useState(false);
  const [currentCity, setCurrentCity] = useState(player.currentCity || "London");
  const [ukClock, setUkClock] = useState("--:--:--");
  const [ukDate, setUkDate] = useState("Loading UK time");
  const [crimeCooldown, setCrimeCooldown] = useState(0);
  const [bankAmount, setBankAmount] = useState("100");
  const [localCrimes, setLocalCrimes] = useState(recentCrimes);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setUkClock(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/London",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false
        }).format(now)
      );
      setUkDate(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/London",
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric"
        }).format(now)
      );
    };
    updateClock();
    const clockTimer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(clockTimer);
  }, []);

  useEffect(() => {
    const tick = () => {
      if (!lastCrimeAt) {
        setCrimeCooldown(0);
        return;
      }
      const elapsed = (Date.now() - new Date(lastCrimeAt).getTime()) / 1000;
      const remaining = Math.max(0, 90 - Math.floor(elapsed));
      setCrimeCooldown(remaining);
    };
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [lastCrimeAt]);

  useEffect(() => {
    let active = true;
    async function loadLocation() {
      try {
        const response = await fetch("/api/travel", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (active && typeof data.currentCity === "string") {
          setCurrentCity(data.currentCity);
        }
      } catch {
        // keep default
      }
    }
    loadLocation();
    return () => {
      active = false;
    };
  }, []);

  const xpCurrent = experience;
  const xpNext = xpForLevel(rankLevel + 1);
  const xpPrev = xpForLevel(rankLevel);
  const xpProgress =
    xpNext > xpPrev
      ? Math.min(100, Math.floor(((xpCurrent - xpPrev) / (xpNext - xpPrev)) * 100))
      : 100;

  async function commitCrime(crimeId: string) {
    setBusy(true);
    setNotice("");

    try {
      const response = await fetch("/api/game/crime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crimeId })
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === "COOLDOWN") {
          setNotice(
            `The streets are still hot. Wait ${data.remaining ?? "a few"} seconds.`
          );
        } else if (data.error === "NO_ENERGY") {
          setNotice("You're exhausted. Wait for your energy to recover.");
        } else if (data.error === "RANK_TOO_LOW") {
          setNotice("You need a higher rank for that job.");
        } else {
          setNotice(data.error || "The job failed.");
        }
        return;
      }

      setEnergy(data.energy);
      setMoney(data.money);
      setExperience(data.experience);
      setRank(data.rank);
      setRankLevel(data.rankLevel);
      setLastCrimeAt(new Date().toISOString());

      setLocalCrimes((prev) =>
        [
          {
            crimeType: data.crimeName,
            success: data.success,
            cashChange: data.cashChange,
            createdAt: new Date().toISOString()
          },
          ...prev
        ].slice(0, 8)
      );

      if (data.leveledUp) {
        setNotice(
          data.success
            ? `Job successful. You took £${data.cashChange.toLocaleString("en-GB")}. Rank up — you are now ${data.rank}.`
            : `The job went wrong, but you still gained experience. Rank up — you are now ${data.rank}.`
        );
      } else {
        setNotice(
          data.success
            ? `Job successful. You pocketed £${data.cashChange.toLocaleString("en-GB")} (+${data.xpGained} XP).`
            : `The job went wrong. You got away empty-handed (+${data.xpGained} XP).`
        );
      }
    } catch {
      setNotice("Unable to connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function bankAction(action: "deposit" | "withdraw") {
    const amount = Number(bankAmount);
    if (!Number.isSafeInteger(amount) || amount < 1) {
      setNotice("Enter a whole number amount.");
      return;
    }

    setBusy(true);
    setNotice("");

    try {
      const response = await fetch("/api/game/bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, amount })
      });

      const data = await response.json();

      if (!response.ok) {
        setNotice(data.error || "Bank transaction failed.");
        return;
      }

      setMoney(data.money);
      setBank(data.bank);
      setNotice(
        action === "deposit"
          ? `Deposited £${amount.toLocaleString("en-GB")}.`
          : `Withdrew £${amount.toLocaleString("en-GB")}.`
      );
    } catch {
      setNotice("Unable to reach the bank.");
    } finally {
      setBusy(false);
    }
  }

  function navigate(item: string) {
    setNotice("");
    setMenuOpen(false);
    setSelectedGroup("");

    if (item === "Logout") {
      window.location.href = "/logout";
      return;
    }
    if (item === "Profile") {
      window.location.href = `/profile/${encodeURIComponent(player.username)}`;
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
    if (item === "Railway") {
      window.location.href = "/railway";
      return;
    }

    setSection(item);
  }

  const availableCrimes = useMemo(
    () => CRIMES.filter((c) => c.minRankLevel <= rankLevel + 1),
    [rankLevel]
  );

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
          <span>{rank}</span>
          <span>£{money.toLocaleString("en-GB")}</span>
        </div>

        <button
          className="mobile-menu-toggle"
          onClick={() => {
            setMenuOpen(!menuOpen);
            setSelectedGroup("");
          }}
        >
          {menuOpen ? "Close" : "Menu"}
        </button>
      </header>

      <div className="city-strip">
        <div className="city-location">
          <strong>{currentCity}</strong>
          <span>
            {currentCity === "London" ? "Greater London" : "Britain"}
          </span>
        </div>

        <div className="city-weather">
          <span aria-hidden="true">☁</span>
          <span>Overcast</span>
          <i aria-hidden="true" />
        </div>

        <div className="city-era">
          <strong>{ukClock}</strong>
          <span>{ukDate} · UK TIME</span>
        </div>
      </div>

      <div className="game-layout">
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

              <div className="dash-grid">
                <div className="dash-card">
                  <h3>Your standing</h3>
                  <p className="dash-rank">{rank}</p>
                  <div className="xp-bar-wrap">
                    <div className="xp-bar">
                      <i style={{ width: `${xpProgress}%` }} />
                    </div>
                    <small>
                      Level {rankLevel} · {xpCurrent.toLocaleString()} /{" "}
                      {xpNext.toLocaleString()} XP
                    </small>
                  </div>
                </div>

                <div className="dash-card">
                  <h3>Energy</h3>
                  <p className="dash-big">
                    {energy}
                    <span>/{player.maxEnergy}</span>
                  </p>
                  <small>Recovers 1 every 3 minutes</small>
                </div>

                <div className="dash-card">
                  <h3>Cash</h3>
                  <p className="dash-big">
                    £{money.toLocaleString("en-GB")}
                  </p>
                  <small>Bank: £{bank.toLocaleString("en-GB")}</small>
                </div>
              </div>

              <div className="news-line">
                <b>DISPATCH</b>
                <span>
                  Keep your head down, choose your company carefully, and
                  watch your back. Street work pays — higher ranks unlock
                  bigger scores.
                </span>
              </div>

              <h2>Recent activity</h2>
              {localCrimes.length === 0 ? (
                <p className="muted">No jobs logged yet. Try the Crimes section.</p>
              ) : (
                <ul className="activity-list">
                  {localCrimes.map((c, i) => (
                    <li key={i}>
                      <span className={c.success ? "ok" : "fail"}>
                        {c.success ? "✓" : "✗"}
                      </span>
                      <span>
                        {c.crimeType}
                        {c.success
                          ? ` · +£${c.cashChange.toLocaleString("en-GB")}`
                          : " · failed"}
                      </span>
                      <time>
                        {new Date(c.createdAt).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </time>
                    </li>
                  ))}
                </ul>
              )}

              <div className="quick-actions">
                <button className="button" onClick={() => navigate("Crimes")}>
                  Go to Crimes
                </button>
                <button
                  className="button secondary"
                  onClick={() => navigate("Local Bank")}
                >
                  Local Bank
                </button>
                <button
                  className="button secondary"
                  onClick={() => navigate("Keno")}
                >
                  Casino
                </button>
              </div>
            </>
          )}

          {section === "Crimes" && (
            <>
              <p className="lead">
                Small jobs keep money moving. Bigger scores require rank
                and energy. Heat rises with ambition.
              </p>

              {crimeCooldown > 0 && (
                <div className="cooldown-banner">
                  Cooldown: {crimeCooldown}s remaining before the next job.
                </div>
              )}

              <div className="crime-list">
                {availableCrimes.map((crime) => {
                  const locked = rankLevel < crime.minRankLevel;
                  return (
                    <div
                      key={crime.id}
                      className={`crime-card ${locked ? "locked" : ""}`}
                    >
                      <div className="crime-info">
                        <b>{crime.name}</b>
                        <p>{crime.description}</p>
                        <small>
                          Energy {crime.energyCost} · Rank{" "}
                          {crime.minRankLevel}+ · Pay £
                          {crime.minCash.toLocaleString()}–£
                          {crime.maxCash.toLocaleString()}
                          {locked && " · LOCKED"}
                        </small>
                      </div>
                      <button
                        className="button"
                        disabled={
                          busy ||
                          locked ||
                          crimeCooldown > 0 ||
                          energy < crime.energyCost
                        }
                        onClick={() => commitCrime(crime.id)}
                      >
                        {locked
                          ? "Rank required"
                          : busy
                            ? "Working…"
                            : "Attempt"}
                      </button>
                    </div>
                  );
                })}
              </div>

              {notice && <p className="notice">{notice}</p>}
            </>
          )}

          {section === "Local Bank" && (
            <>
              <p className="lead">
                Cash on the street can be taken. Money in the bank is safer.
              </p>

              <div className="bank-panel">
                <div className="bank-balances">
                  <div>
                    <span>On hand</span>
                    <b>£{money.toLocaleString("en-GB")}</b>
                  </div>
                  <div>
                    <span>In bank</span>
                    <b>£{bank.toLocaleString("en-GB")}</b>
                  </div>
                </div>

                <label>
                  Amount (£)
                  <input
                    type="number"
                    min="1"
                    value={bankAmount}
                    onChange={(e) => setBankAmount(e.target.value)}
                  />
                </label>

                <div className="bank-actions">
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => bankAction("deposit")}
                  >
                    Deposit
                  </button>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => bankAction("withdraw")}
                  >
                    Withdraw
                  </button>
                </div>
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
            <p className="flavour">Blackjack tables are being prepared.</p>
          )}
          {section === "Roulette" && (
            <p className="flavour">European roulette wheel is under construction.</p>
          )}
          {section === "Auto Theft" && (
            <p className="flavour">Steal cars, strip them, or sell them on the quiet. Coming soon.</p>
          )}
          {section === "Bootlegging" && (
            <p className="flavour">Build stills and supply the city&apos;s demand for illegal liquor.</p>
          )}
          {section === "Organised Crime" && (
            <p className="flavour">Four-player jobs with invitations and a 100% payout split.</p>
          )}
          {section === "Whack" && (
            <p className="flavour">Player combat. Weapons, bullets and protection.</p>
          )}
          {section === "Hitlist" && (
            <p className="flavour">View and manage your targets.</p>
          )}
          {section === "Rackets" && (
            <p className="flavour">Own and protect criminal rackets for passive income.</p>
          )}
          {section === "Marketplace" && (
            <p className="flavour">Buy and sell goods with other players.</p>
          )}
          {section === "Gun Shop" && (
            <p className="flavour">Weapons and ammunition.</p>
          )}
          {section === "Escrow" && (
            <p className="flavour">Secure player-to-player trading.</p>
          )}
          {section === "Statistics" && (
            <div>
              <p className="lead">Your criminal record so far.</p>
              <div className="stat-grid">
                <div><span>Rank</span><b>{rank}</b></div>
                <div><span>Level</span><b>{rankLevel}</b></div>
                <div><span>Experience</span><b>{experience.toLocaleString()}</b></div>
                <div><span>Health</span><b>{player.health}%</b></div>
                <div><span>Protection</span><b>{player.protection}%</b></div>
                <div><span>Bullets</span><b>{player.bullets}</b></div>
              </div>
            </div>
          )}
          {section === "Jail" && (
            <p className="flavour">You are currently free.</p>
          )}
          {section === "Hospital" && (
            <p className="flavour">Your health is currently {player.health}%.</p>
          )}
          {section === "Graveyard" && (
            <p className="flavour">Remember those who have fallen.</p>
          )}
          {section === "Gymnasium" && (
            <p className="flavour">Train strength, stamina and accuracy. Coming later.</p>
          )}
          {section === "Search" && (
            <p className="flavour">Search the city for opportunities.</p>
          )}
          {section === "Updates" && (
            <p className="flavour">Development updates will be posted here.</p>
          )}
          {section === "Cities" && (
            <p className="flavour">London, Birmingham, Manchester, Liverpool, Glasgow.</p>
          )}
          {section === "Find Player" && (
            <p className="flavour">Search for another player by name.</p>
          )}
          {section === "Mailbox" && (
            <p className="flavour">Your incoming messages.</p>
          )}
          {section === "Send Letter" && (
            <p className="flavour">Write a letter to another player.</p>
          )}
          {section === "Saved Mail" && (
            <p className="flavour">Your saved messages.</p>
          )}
          {section === "Classifieds" && (
            <p className="flavour">Player advertisements and listings.</p>
          )}
          {section === "Off Topic" && (
            <p className="flavour">General conversation away from the game.</p>
          )}
          {section === "Crew" && (
            <p className="flavour">Your crew and criminal associates.</p>
          )}
          {section === "Gold" && (
            <p className="flavour">Premium currency. Not yet active.</p>
          )}
          {section === "Store" && (
            <p className="flavour">The Rumrunners store.</p>
          )}
          {section === "Pawn Shop" && (
            <p className="flavour">Buy and sell items at the pawn shop.</p>
          )}
          {section === "Stock Market" && (
            <p className="flavour">Investments and the stock market.</p>
          )}
          {section === "Brothel" && (
            <p className="flavour">Visit the city&apos;s establishments.</p>
          )}
          {section === "Lottery" && (
            <p className="flavour">The city lottery. Coming soon.</p>
          )}
          {section === "Poker Run" && (
            <p className="flavour">Poker Run tables are being prepared.</p>
          )}
          {section === "Race Track" && (
            <p className="flavour">Race Track betting will open later.</p>
          )}
          {section === "Jacks or Better" && (
            <p className="flavour">Video poker. Coming soon.</p>
          )}
          {section === "Sports Betting" && (
            <p className="flavour">Sports books are not yet open.</p>
          )}
          {section === "Rumrunners Live" && (
            <p className="flavour">Live news from the underworld.</p>
          )}
          {section === "Wiki" && (
            <p className="flavour">The Rumrunners game guide.</p>
          )}
          {section === "Terms of Service" && (
            <p className="flavour">Game rules and terms of service.</p>
          )}
          {section === "Help Desk" && (
            <p className="flavour">Help and support for players.</p>
          )}
          {section === "Suggestion Box" && (
            <p className="flavour">Send suggestions for future improvements.</p>
          )}
          {section === "Full Site" && (
            <p className="flavour">You are viewing the full Rumrunners game.</p>
          )}
          {section === "Profile" && (
            <p className="flavour">Your player profile.</p>
          )}
          {section === "Game" && (
            <p className="flavour">Game discussion board.</p>
          )}

          {section !== "Home" &&
            section !== "Crimes" &&
            section !== "Local Bank" &&
            notice && <p className="notice">{notice}</p>}
        </main>

        {/* MENU */}
        <aside className={`sidebar ${menuOpen ? "menu-open" : ""}`}>
          {selectedGroup === "" ? (
            <>
              <p className="side-heading">MENU</p>
              <div className="category-grid">
                {menuGroups.map((group) => (
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
                onClick={() => setSelectedGroup("")}
              >
                « {selectedGroup}
              </button>

              <div className="nav-buttons">
                {menuGroups
                  .find((g) => g.title === selectedGroup)
                  ?.items.map((item) => (
                    <button
                      key={item}
                      className={
                        item === "Logout"
                          ? "nav-item logout-menu-item"
                          : section === item
                            ? "nav-item active"
                            : "nav-item"
                      }
                      onClick={() => navigate(item)}
                    >
                      {item}
                    </button>
                  ))}
              </div>
            </div>
          )}
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
