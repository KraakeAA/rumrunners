"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode
} from "react";
import AutoTheftSection from "@/components/AutoTheft";
import { GarageSection, TravelSection } from "@/components/Travel";
import { BulletFactorySection, CasinoSection, CitiesSection } from "@/components/Venues";
import {
  CRIMES,
  MAX_STREAK,
  crimePayRange,
  streakBonusFor,
  streakFromLogs,
  successChance,
  xpForLevel,
  xpScale
} from "@/lib/game";
import { rankForLevel } from "@/lib/ranks";

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

type CrimeResult = {
  crimeName: string;
  label: string;
  tier: string;
  sceneTitle: string;
  setup: string;
  result: string;
  success: boolean;
  cashChange: number;
  xpGained: number;
  streak: number;
  streakBonus: number;
  leveledUp: boolean;
  rank: string;
};

const TIER_COLOURS: Record<string, string> = {
  perfect: "#e4c04d",
  clean: "#7fe08f",
  messy: "#d9a441",
  backed_off: "#b9a783",
  got_away: "#e0a07f",
  caught: "#e06b5e"
};

type CrimeTypeStat = {
  crimeType: string;
  attempts: number;
  successes: number;
  cashEarned: number;
};

type CasinoGameStat = {
  game: string;
  plays: number;
  wagered: number;
  returned: number;
  biggestPayout: number;
};

type PlayerStats = {
  crimeByType: CrimeTypeStat[];
  casinoByGame: CasinoGameStat[];
  forumTopics: number;
  forumPosts: number;
  joinedAt: string | null;
};

const EMPTY_STATS: PlayerStats = {
  crimeByType: [],
  casinoByGame: [],
  forumTopics: 0,
  forumPosts: 0,
  joinedAt: null
};

const STAT_CATEGORIES = [
  "Current",
  "Criminal Activity",
  "Economy",
  "Casino",
  "Social"
];

const gbp = (n: number) => `£${n.toLocaleString("en-GB")}`;

const titleBarStyle: CSSProperties = {
  padding: "4px 8px",
  textAlign: "center",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 1,
  textTransform: "uppercase",
  color: "#f0dfc0",
  background: "linear-gradient(180deg, #6b5230 0%, #3a2c18 55%, #2a2012 100%)",
  borderTop: "1px solid #8d7140",
  borderBottom: "1px solid #1a140b",
  textShadow: "0 1px 0 #1a140b"
};

function TitleBar({ children }: { children: ReactNode }) {
  return <div style={titleBarStyle}>{children}</div>;
}

function StatGroup({ title }: { title: string }) {
  return (
    <div
      style={{
        padding: "3px 8px",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        color: "#d9b45f",
        background: "#221d15",
        borderBottom: "1px solid #3a342c"
      }}
    >
      {title}
    </div>
  );
}

function StatRow({
  label,
  value,
  tone
}: {
  label: string;
  value: ReactNode;
  tone?: "good" | "bad";
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 12,
        padding: "4px 8px",
        fontSize: 13,
        lineHeight: 1.35,
        background: "#171410",
        borderBottom: "1px solid #2e2820"
      }}
    >
      <span style={{ color: "#c7bba7", minWidth: 0, overflowWrap: "anywhere" }}>
        {label}
      </span>
      <span
        style={{
          color:
            tone === "good"
              ? "#7fe08f"
              : tone === "bad"
                ? "#e08f7f"
                : "#ead9b8",
          fontWeight: 600,
          textAlign: "right",
          flexShrink: 0
        }}
      >
        {value}
      </span>
    </div>
  );
}

function StatTable({
  columns,
  rows
}: {
  columns: string[];
  rows: string[][];
}) {
  const template = `minmax(0, 1.5fr) repeat(${columns.length - 1}, minmax(0, 1fr))`;
  const cell = (i: number): CSSProperties => ({
    textAlign: i === 0 ? "left" : "right",
    minWidth: 0,
    overflowWrap: "anywhere"
  });

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: template,
          gap: 8,
          padding: "3px 8px",
          fontSize: 11,
          color: "#b9a783",
          background: "#1e1a14",
          borderBottom: "1px solid #3a342c"
        }}
      >
        {columns.map((c, i) => (
          <span key={c} style={cell(i)}>
            {c}
          </span>
        ))}
      </div>

      {rows.map((row, r) => (
        <div
          key={r}
          style={{
            display: "grid",
            gridTemplateColumns: template,
            gap: 8,
            padding: "4px 8px",
            fontSize: 13,
            lineHeight: 1.35,
            color: "#ead9b8",
            background: "#171410",
            borderBottom: "1px solid #2e2820"
          }}
        >
          {row.map((value, i) => (
            <span
              key={i}
              style={{
                ...cell(i),
                color: i === 0 ? "#c7bba7" : "#ead9b8",
                fontWeight: i === 0 ? 400 : 600
              }}
            >
              {value}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

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
      "Pawn Shop", "Stock Market", "Railway", "Garage", "Brothel"
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
  recentCrimes = [],
  stats = EMPTY_STATS
}: {
  player: Player;
  isAdmin?: boolean;
  playerId: string;
  recentCrimes?: CrimeLog[];
  stats?: PlayerStats;
}) {
  const [section, setSection] = useState("Home");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuGroup, setMenuGroup] = useState("");
  const [notice, setNotice] = useState("");
  const [energy, setEnergy] = useState(player.energy);
  const [money, setMoney] = useState(player.money);
  const [bullets, setBullets] = useState(player.bullets);
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
  const [crimeByType, setCrimeByType] = useState(stats.crimeByType);
  const [outcome, setOutcome] = useState<CrimeResult | null>(null);
  const [streak, setStreak] = useState(() => streakFromLogs(recentCrimes));
  const [statsCategory, setStatsCategory] = useState("Current");

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

      const elapsed =
        (Date.now() - new Date(lastCrimeAt).getTime()) / 1000;

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
        const response = await fetch("/api/travel", {
          cache: "no-store"
        });

        if (!response.ok) return;

        const data = await response.json();

        if (active && typeof data.currentCity === "string") {
          setCurrentCity(data.currentCity);
        }
      } catch {
        // Keep the current city if the request fails.
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
      ? Math.min(
          100,
          Math.max(
            0,
            Math.floor(
              ((xpCurrent - xpPrev) / (xpNext - xpPrev)) * 100
            )
          )
        )
      : 100;

  async function commitCrime(crimeId: string) {
    setBusy(true);
    setNotice("");

    try {
      const response = await fetch("/api/game/crime", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
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

      setCrimeByType((prev) => {
        const wonCash = data.success ? data.cashChange : 0;
        const won = data.success ? 1 : 0;

        if (!prev.some((c) => c.crimeType === data.crimeName)) {
          return [
            ...prev,
            {
              crimeType: data.crimeName,
              attempts: 1,
              successes: won,
              cashEarned: wonCash
            }
          ];
        }

        return prev.map((c) =>
          c.crimeType === data.crimeName
            ? {
                ...c,
                attempts: c.attempts + 1,
                successes: c.successes + won,
                cashEarned: c.cashEarned + wonCash
              }
            : c
        );
      });

      setStreak(typeof data.streak === "number" ? data.streak : 0);

      setOutcome({
        crimeName: data.crimeName,
        label: data.label ?? (data.success ? "Job done" : "Job failed"),
        tier: data.tier ?? (data.success ? "clean" : "got_away"),
        sceneTitle: data.sceneTitle ?? data.crimeName,
        setup: data.setup ?? "",
        result: data.result ?? "",
        success: Boolean(data.success),
        cashChange: data.cashChange,
        xpGained: data.xpGained,
        streak: typeof data.streak === "number" ? data.streak : 0,
        streakBonus: data.streakBonus ?? 0,
        leveledUp: Boolean(data.leveledUp),
        rank: data.rank
      });

      setNotice(
        data.leveledUp ? `Rank up — you are now ${data.rank}.` : ""
      );
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
        headers: {
          "Content-Type": "application/json"
        },
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
    setOutcome(null);
    setMenuOpen(false);
    setSelectedGroup("");
    setMenuGroup("");

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

    setSection(item);
  }

  function toggleMenu() {
    setNotice("");
    setMenuGroup("");
    setMenuOpen((open) => !open);
  }

  function renderStatistics() {
    const attempts = crimeByType.reduce((n, c) => n + c.attempts, 0);
    const succeeded = crimeByType.reduce((n, c) => n + c.successes, 0);
    const failed = attempts - succeeded;
    const cashEarned = crimeByType.reduce((n, c) => n + c.cashEarned, 0);
    const pct = (won: number, total: number) =>
      total > 0 ? `${Math.round((won / total) * 1000) / 10}%` : "0%";

    const casinoPlays = stats.casinoByGame.reduce((n, g) => n + g.plays, 0);
    const casinoWagered = stats.casinoByGame.reduce((n, g) => n + g.wagered, 0);
    const casinoReturned = stats.casinoByGame.reduce((n, g) => n + g.returned, 0);
    const casinoNet = casinoReturned - casinoWagered;
    const casinoBiggest = stats.casinoByGame.reduce(
      (n, g) => Math.max(n, g.biggestPayout),
      0
    );

    const sortedCrimes = [...crimeByType].sort((a, b) =>
      a.crimeType.localeCompare(b.crimeType)
    );

    return (
      <div style={{ width: "100%", minWidth: 0 }}>
        <TitleBar>Welcome to Rumrunners</TitleBar>
        <TitleBar>Statistics</TitleBar>

        <div style={{ padding: "6px 0", background: "#12100d" }}>
          <select
            aria-label="Statistics category"
            value={statsCategory}
            onChange={(e) => setStatsCategory(e.target.value)}
            style={{
              display: "block",
              width: "100%",
              height: 36,
              padding: "0 8px",
              border: "1px solid #65543b",
              borderRadius: 0,
              background: "#1b1814",
              color: "#ead9b8",
              fontSize: 16
            }}
          >
            {STAT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div style={{ border: "1px solid #3a342c", borderBottom: 0 }}>
          {statsCategory === "Current" && (
            <>
              <StatGroup title="Crimes" />
              <StatRow label="Crimes succeeded" value={succeeded.toLocaleString("en-GB")} />
              <StatRow label="Success percentage" value={pct(succeeded, attempts)} />
              <StatRow label="Crimes failed" value={failed.toLocaleString("en-GB")} />
              <StatRow label="Total crimes" value={attempts.toLocaleString("en-GB")} />
              <StatRow label="Cash earned" value={gbp(cashEarned)} />

              <StatGroup title="Character" />
              <StatRow label="Rank" value={rank} />
              <StatRow label="Level" value={rankLevel} />
              <StatRow
                label="Experience"
                value={`${xpCurrent.toLocaleString("en-GB")} / ${xpNext.toLocaleString("en-GB")}`}
              />
              <StatRow label="Level progress" value={`${xpProgress}%`} />
              <StatRow label="Energy" value={`${energy} / ${player.maxEnergy}`} />
              <StatRow label="Health" value={`${player.health}%`} />
              <StatRow label="Protection" value={`${player.protection}%`} />
              <StatRow label="Bullets" value={bullets.toLocaleString("en-GB")} />
              <StatRow label="Location" value={currentCity} />
            </>
          )}

          {statsCategory === "Criminal Activity" && (
            <>
              <StatGroup title="Jobs by type" />
              {sortedCrimes.length === 0 ? (
                <StatRow label="No jobs recorded yet" value="—" />
              ) : (
                <StatTable
                  columns={["Job", "Tries", "Won", "Earned"]}
                  rows={sortedCrimes.map((c) => [
                    c.crimeType,
                    c.attempts.toLocaleString("en-GB"),
                    `${c.successes.toLocaleString("en-GB")} (${pct(c.successes, c.attempts)})`,
                    gbp(c.cashEarned)
                  ])}
                />
              )}

              <StatGroup title="Totals" />
              <StatRow label="Total crimes" value={attempts.toLocaleString("en-GB")} />
              <StatRow label="Success percentage" value={pct(succeeded, attempts)} />
              <StatRow
                label="Average per successful job"
                value={gbp(succeeded > 0 ? Math.round(cashEarned / succeeded) : 0)}
              />

              <StatGroup title="Recent jobs" />
              {localCrimes.length === 0 ? (
                <StatRow label="No jobs logged yet" value="—" />
              ) : (
                localCrimes.map((c, i) => (
                  <StatRow
                    key={i}
                    label={`${new Date(c.createdAt).toLocaleTimeString("en-GB", {
                      timeZone: "Europe/London",
                      hour: "2-digit",
                      minute: "2-digit"
                    })} · ${c.crimeType}`}
                    value={c.success ? `+${gbp(c.cashChange)}` : "Failed"}
                    tone={c.success ? "good" : "bad"}
                  />
                ))
              )}
            </>
          )}

          {statsCategory === "Economy" && (
            <>
              <StatGroup title="Money" />
              <StatRow label="Cash on hand" value={gbp(money)} />
              <StatRow label="In bank" value={gbp(bank)} />
              <StatRow label="Cash and bank total" value={gbp(money + bank)} />
              <StatRow label="Gold" value={player.gold.toLocaleString("en-GB")} />

              <StatGroup title="Earnings" />
              <StatRow label="Cash earned from crimes" value={gbp(cashEarned)} />
            </>
          )}

          {statsCategory === "Casino" && (
            <>
              <StatGroup title="Totals" />
              <StatRow label="Games played" value={casinoPlays.toLocaleString("en-GB")} />
              <StatRow label="Total wagered" value={gbp(casinoWagered)} />
              <StatRow label="Total returned" value={gbp(casinoReturned)} />
              <StatRow
                label="Net result"
                value={`${casinoNet < 0 ? "-" : casinoNet > 0 ? "+" : ""}${gbp(Math.abs(casinoNet))}`}
                tone={casinoNet > 0 ? "good" : casinoNet < 0 ? "bad" : undefined}
              />
              <StatRow label="Biggest single payout" value={gbp(casinoBiggest)} />

              <StatGroup title="By game" />
              {stats.casinoByGame.length === 0 ? (
                <StatRow label="No casino games played yet" value="—" />
              ) : (
                <StatTable
                  columns={["Game", "Plays", "Wagered", "Returned"]}
                  rows={stats.casinoByGame.map((g) => [
                    g.game,
                    g.plays.toLocaleString("en-GB"),
                    gbp(g.wagered),
                    gbp(g.returned)
                  ])}
                />
              )}
            </>
          )}

          {statsCategory === "Social" && (
            <>
              <StatGroup title="Forums" />
              <StatRow label="Topics started" value={stats.forumTopics.toLocaleString("en-GB")} />
              <StatRow label="Posts written" value={stats.forumPosts.toLocaleString("en-GB")} />

              <StatGroup title="Account" />
              <StatRow label="Username" value={player.username} />
              <StatRow
                label="Member since"
                value={
                  stats.joinedAt
                    ? new Date(stats.joinedAt).toLocaleDateString("en-GB", {
                        timeZone: "Europe/London",
                        day: "numeric",
                        month: "long",
                        year: "numeric"
                      })
                    : "—"
                }
              />
            </>
          )}
        </div>
      </div>
    );
  }

  const availableCrimes = useMemo(
    () => CRIMES.filter((c) => c.minRankLevel <= rankLevel + 1),
    [rankLevel]
  );

  return (
    <div className="game">
      {/* TOP BAR */}
      <header
        className="topbar"
        style={{
          minHeight: 62,
          height: "auto",
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "nowrap",
          background: "linear-gradient(180deg, #242019, #171512)",
          borderBottom: "1px solid #55452e"
        }}
      >
        {/* CASH, BANK AND GOLD — TOP LEFT */}
        <div
          aria-label="Player money"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            minWidth: 0,
            color: "#ead9b8",
            fontSize: 13,
            lineHeight: 1.25
          }}
        >
          <strong
            style={{
              fontSize: 15,
              whiteSpace: "nowrap"
            }}
          >
            Cash £{money.toLocaleString("en-GB")}
          </strong>

          <span
            style={{
              color: "#b9a783",
              whiteSpace: "nowrap"
            }}
          >
            Bank £{bank.toLocaleString("en-GB")}
          </span>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              whiteSpace: "nowrap"
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                color: "#e4c04d"
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle at 35% 30%, #fff2a8, #e4b822 55%, #9a7410)",
                  border: "1px solid #7a5a0c",
                  boxShadow: "inset 0 0 0 2px rgba(255, 240, 160, 0.35)",
                  flexShrink: 0
                }}
              />
              Gold {player.gold.toLocaleString("en-GB")}
            </span>

            <span
              aria-label={`Health ${player.health}%`}
              title={`Health ${player.health}%`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                color: "#b9a783"
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  width: 34,
                  height: 7,
                  background: "#2a1a17",
                  border: "1px solid #55452e"
                }}
              >
                <span
                  style={{
                    display: "block",
                    height: "100%",
                    width: `${Math.max(0, Math.min(100, player.health))}%`,
                    background:
                      player.health > 50
                        ? "#4caf50"
                        : player.health > 25
                          ? "#d9a441"
                          : "#c0392b"
                  }}
                />
              </span>
              {player.health}%
            </span>
          </div>
        </div>

        {/* MESSAGE, JAIL AND MENU — TOP RIGHT */}
        <nav
          aria-label="Game shortcuts"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 7,
            flexShrink: 0,
            marginLeft: "auto"
          }}
        >
          <button
            type="button"
            aria-label="Messages"
            title="Messages"
            onClick={() => navigate("Mailbox")}
            style={{
              width: 38,
              height: 38,
              display: "grid",
              placeItems: "center",
              padding: 0,
              border: "1px solid #65543b",
              borderRadius: 3,
              background: "linear-gradient(180deg, #393126, #211c16)",
              color: "#e8d7b6",
              fontSize: 21,
              cursor: "pointer"
            }}
          >
            ✉
          </button>

          <button
            type="button"
            aria-label="Jail"
            title="Jail"
            onClick={() => navigate("Jail")}
            style={{
              width: 38,
              height: 38,
              display: "grid",
              placeItems: "center",
              padding: 0,
              border: "1px solid #65543b",
              borderRadius: 3,
              background: "linear-gradient(180deg, #393126, #211c16)",
              color: "#e8d7b6",
              fontSize: 21,
              cursor: "pointer"
            }}
          >
            ▥
          </button>

          <button
            type="button"
            className="mobile-menu-toggle"
            aria-label="Menu"
            aria-pressed={menuOpen}
            onClick={toggleMenu}
            style={{
              minWidth: 70,
              height: 38,
              padding: "0 12px",
              marginLeft: 1,
              border: "1px solid #a88b5b",
              borderRadius: 3,
              background: "linear-gradient(180deg, #4a3b28, #292117)",
              color: "#f0dfc0",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Menu
          </button>
        </nav>
      </header>

      {/* LOCATION AND TIME — ONLY WHILE THE MENU IS OPEN */}
      {menuOpen && (
        <>
        <div
          className="city-strip"
          style={{
            minHeight: 58,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "nowrap",
            gap: 8,
            padding: "7px 13px",
            background: "#1b1814",
            borderBottom: "1px solid #55452e"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              minWidth: 0
            }}
          >
            <div
              className="city-location"
              style={{ flexShrink: 0 }}
            >
              <strong>{currentCity}</strong>
              <span>
                {currentCity === "London"
                  ? "Greater London"
                  : "Britain"}
              </span>
            </div>

            <div
              className="city-weather"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                whiteSpace: "nowrap",
                fontSize: 12
              }}
            >
              <span aria-hidden="true">☁</span>
              <span>Overcast</span>
            </div>
          </div>

          <div
            className="city-era"
            style={{
              width: "auto",
              marginLeft: "auto",
              flexShrink: 0,
              textAlign: "right",
              lineHeight: 1.25
            }}
          >
            <strong style={{ fontSize: 15 }}>
              {ukClock}
            </strong>
            <span style={{ fontSize: 10 }}>
              {ukDate} · UK TIME
            </span>
          </div>
        </div>
        </>
      )}

      <div className="game-layout">
        <main className="main-content">
          {/* MENU SCREEN */}
          {menuOpen && (
            <div className="menu-screen">
              {menuGroup === "" ? (
                <>
                  <p className="side-heading">MENU</p>

                  <div className="category-grid">
                    {menuGroups.map((group) => (
                      <button
                        key={group.title}
                        type="button"
                        className="nav-category"
                        onClick={() => setMenuGroup(group.title)}
                      >
                        {group.title}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="category-content">
                  <button
                    type="button"
                    className="category-back"
                    onClick={() => setMenuGroup("")}
                  >
                    « {menuGroup}
                  </button>

                  <div className="nav-buttons">
                    {menuGroups
                      .find((g) => g.title === menuGroup)
                      ?.items.map((item) => (
                        <button
                          key={item}
                          type="button"
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

              {/* STATUS INDICATORS — COMPACT, GREEN AND CLICKABLE */}
              <div
                className="game-status-strip"
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 4,
                  marginTop: 12,
                  padding: "4px 8px",
                  background: "#151310",
                  borderTop: "0",
                  borderBottom: "1px solid #494033"
                }}
              >
                {[
                  { label: "Bank", status: "Ready", target: "Local Bank" },
                  { label: "Jail", status: "Free", target: "Jail" },
                  {
                    label: "Organised Crime",
                    status: "Ready",
                    target: "Organised Crime"
                  },
                  { label: "Rackets", status: "Not active", target: "Rackets" }
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    aria-label={`${item.label}: ${item.status}`}
                    title={`Go to ${item.label}`}
                    onClick={() => navigate(item.target)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      flex: "0 0 auto",
                      padding: "2px 7px",
                      border: "1px solid #3f8a4d",
                      borderRadius: 3,
                      background: "#1e3a22",
                      color: "#7fe08f",
                      fontSize: 10,
                      lineHeight: 1.3,
                      textAlign: "center",
                      cursor: "pointer"
                    }}
                  >
                    <span
                      style={{
                        display: "inline",
                        margin: 0,
                        color: "#a9e8b3"
                      }}
                    >
                      {item.label}
                    </span>
                    <strong style={{ color: "#7fe08f", fontWeight: 600 }}>
                      {item.status}
                    </strong>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!menuOpen && (
          <>
          {(section === "Home" || section === "Statistics") &&
            renderStatistics()}

          {section === "Crimes" && (
            <div style={{ width: "100%", minWidth: 0 }}>
              <TitleBar>Crimes</TitleBar>

              <div style={{ border: "1px solid #3a342c", borderBottom: 0 }}>
                <StatRow label="Rank" value={rank} />
                <StatRow
                  label="Energy"
                  value={`${energy} / ${player.maxEnergy}`}
                />
                <StatRow
                  label="Streak"
                  value={
                    streak > 0
                      ? `${streak}/${MAX_STREAK} · +${Math.round(streakBonusFor(streak) * 100)}% payout`
                      : "None — land a job to start one"
                  }
                  tone={streak > 0 ? "good" : undefined}
                />
              </div>

              {crimeCooldown > 0 && (
                <div className="cooldown-banner">
                  Cooldown: {crimeCooldown}s remaining before the next job.
                </div>
              )}

              {outcome && (
                <div
                  style={{
                    margin: "8px 0",
                    border: `1px solid ${TIER_COLOURS[outcome.tier] ?? "#65543b"}`,
                    background: "#171410"
                  }}
                >
                  <div
                    style={{
                      ...titleBarStyle,
                      color: TIER_COLOURS[outcome.tier] ?? "#f0dfc0"
                    }}
                  >
                    {outcome.label}
                  </div>

                  <div style={{ padding: "8px 10px" }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#b9a783",
                        textTransform: "uppercase",
                        letterSpacing: 0.5
                      }}
                    >
                      {outcome.crimeName} · {outcome.sceneTitle}
                    </div>

                    {outcome.setup && (
                      <p
                        style={{
                          margin: "6px 0",
                          fontStyle: "italic",
                          color: "#c7bba7",
                          lineHeight: 1.45
                        }}
                      >
                        {outcome.setup}
                      </p>
                    )}

                    <p
                      style={{
                        margin: "6px 0",
                        color: "#ead9b8",
                        lineHeight: 1.45
                      }}
                    >
                      {outcome.result}
                    </p>
                  </div>

                  <StatRow
                    label={
                      outcome.cashChange < 0
                        ? "Fined"
                        : outcome.success
                          ? "Payout"
                          : "Payout"
                    }
                    value={
                      outcome.cashChange < 0
                        ? `-${gbp(Math.abs(outcome.cashChange))}`
                        : gbp(outcome.cashChange)
                    }
                    tone={
                      outcome.cashChange > 0
                        ? "good"
                        : outcome.cashChange < 0
                          ? "bad"
                          : undefined
                    }
                  />
                  <StatRow label="Experience" value={`+${outcome.xpGained} XP`} />
                  {outcome.success && outcome.streakBonus > 0 && (
                    <StatRow
                      label="Streak bonus"
                      value={`+${Math.round(outcome.streakBonus * 100)}%`}
                      tone="good"
                    />
                  )}
                  <StatRow
                    label="Next streak"
                    value={
                      outcome.streak > 0
                        ? `${outcome.streak}/${MAX_STREAK}`
                        : "Broken"
                    }
                    tone={outcome.streak > 0 ? "good" : "bad"}
                  />
                </div>
              )}

              {notice && <p className="notice">{notice}</p>}

              <div
                style={{
                  marginTop: 8,
                  border: "1px solid #3a342c",
                  borderBottom: 0
                }}
              >
                {availableCrimes.map((crime) => {
                  const locked = rankLevel < crime.minRankLevel;
                  const pay = crimePayRange(crime, rankLevel);
                  const chance = Math.round(
                    successChance(crime, rankLevel) * 100
                  );
                  const xp = Math.round(
                    crime.xpSuccess * xpScale(crime, rankLevel)
                  );
                  const needsEnergy = energy < crime.energyCost;

                  return (
                    <div
                      key={crime.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        padding: "8px",
                        background: locked ? "#12100d" : "#171410",
                        borderBottom: "1px solid #2e2820",
                        opacity: locked ? 0.7 : 1
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <b style={{ color: "#ead9b8", fontSize: 14 }}>
                          {locked ? `🔒 ${crime.name}` : crime.name}
                        </b>

                        {locked ? (
                          <div style={{ fontSize: 12, color: "#b9a783" }}>
                            Unlocks at rank{" "}
                            {rankForLevel(crime.minRankLevel)} (level{" "}
                            {crime.minRankLevel})
                          </div>
                        ) : (
                          <>
                            <div
                              style={{
                                fontSize: 12,
                                color: "#a99c85",
                                lineHeight: 1.35,
                                overflowWrap: "anywhere"
                              }}
                            >
                              {crime.description}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: "#c7bba7",
                                lineHeight: 1.4
                              }}
                            >
                              {gbp(pay.min)}–{gbp(pay.max)} · +{xp} XP ·{" "}
                              {chance}% · {crime.energyCost} energy
                            </div>
                          </>
                        )}
                      </div>

                      <button
                        className="button"
                        style={{ flexShrink: 0, padding: "8px 12px" }}
                        disabled={
                          busy ||
                          locked ||
                          crimeCooldown > 0 ||
                          needsEnergy
                        }
                        onClick={() => commitCrime(crime.id)}
                      >
                        {locked
                          ? "Locked"
                          : busy
                            ? "Working…"
                            : needsEnergy
                              ? "No energy"
                              : "Attempt"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
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
            <CasinoSection
              game="Keno"
              cash={money}
              onCash={setMoney}
            />
          )}

          {section === "Slot Machines" && (
            <CasinoSection
              game="Slots"
              cash={money}
              onCash={setMoney}
            />
          )}

          {section === "Blackjack" && (
            <p className="flavour">
              Blackjack tables are being prepared.
            </p>
          )}

          {section === "Roulette" && (
            <p className="flavour">
              European roulette wheel is under construction.
            </p>
          )}

          {section === "Auto Theft" && (
            <AutoTheftSection
              rankLevel={rankLevel}
              energy={energy}
              currentCity={currentCity}
              onCash={setMoney}
              onResult={(r) => {
                setEnergy(r.energy);
                setMoney(r.money);
                setExperience(r.experience);
                setRank(r.rank);
                setRankLevel(r.rankLevel);
              }}
            />
          )}

          {section === "Bootlegging" && (
            <p className="flavour">
              Run spirits between the cities. How many crates you can carry depends on your car&apos;s boot. Coming soon.
            </p>
          )}

          {section === "Organised Crime" && (
            <p className="flavour">
              Four-player jobs with invitations and a 100% payout split.
            </p>
          )}

          {section === "Whack" && (
            <p className="flavour">
              Player combat. Weapons, bullets and protection.
            </p>
          )}

          {section === "Hitlist" && (
            <p className="flavour">
              View and manage your targets.
            </p>
          )}

          {section === "Rackets" && (
            <p className="flavour">
              Own and protect criminal rackets for passive income.
            </p>
          )}

          {section === "Marketplace" && (
            <p className="flavour">
              Buy and sell goods with other players.
            </p>
          )}

          {section === "Railway" && (
            <TravelSection onArrive={(city) => setCurrentCity(city)} />
          )}

          {section === "Garage" && <GarageSection />}

          {section === "Gun Shop" && (
            <BulletFactorySection
              onCash={setMoney}
              onBullets={setBullets}
            />
          )}

          {section === "Escrow" && (
            <p className="flavour">
              Secure player-to-player trading.
            </p>
          )}

          {section === "Jail" && (
            <p className="flavour">
              You are currently free.
            </p>
          )}

          {section === "Hospital" && (
            <p className="flavour">
              Your health is currently {player.health}%.
            </p>
          )}

          {section === "Graveyard" && (
            <p className="flavour">
              Remember those who have fallen.
            </p>
          )}

          {section === "Gymnasium" && (
            <p className="flavour">
              Train strength, stamina and accuracy. Coming later.
            </p>
          )}

          {section === "Search" && (
            <p className="flavour">
              Search the city for opportunities.
            </p>
          )}

          {section === "Updates" && (
            <p className="flavour">
              Development updates will be posted here.
            </p>
          )}

          {section === "Cities" && (
            <CitiesSection onGo={(target) => navigate(target)} />
          )}

          {section === "Find Player" && (
            <p className="flavour">
              Search for another player by name.
            </p>
          )}

          {section === "Mailbox" && (
            <p className="flavour">
              Your incoming messages.
            </p>
          )}

          {section === "Send Letter" && (
            <p className="flavour">
              Write a letter to another player.
            </p>
          )}

          {section === "Saved Mail" && (
            <p className="flavour">
              Your saved messages.
            </p>
          )}

          {section === "Classifieds" && (
            <p className="flavour">
              Player advertisements and listings.
            </p>
          )}

          {section === "Off Topic" && (
            <p className="flavour">
              General conversation away from the game.
            </p>
          )}

          {section === "Crew" && (
            <p className="flavour">
              Your crew and criminal associates.
            </p>
          )}

          {section === "Gold" && (
            <p className="flavour">
              Premium currency. Not yet active.
            </p>
          )}

          {section === "Store" && (
            <p className="flavour">
              The Rumrunners store.
            </p>
          )}

          {section === "Pawn Shop" && (
            <p className="flavour">
              Buy and sell items at the pawn shop.
            </p>
          )}

          {section === "Stock Market" && (
            <p className="flavour">
              Investments and the stock market.
            </p>
          )}

          {section === "Brothel" && (
            <p className="flavour">
              Visit the city&apos;s establishments.
            </p>
          )}

          {section === "Lottery" && (
            <p className="flavour">
              The city lottery. Coming soon.
            </p>
          )}

          {section === "Poker Run" && (
            <p className="flavour">
              Poker Run tables are being prepared.
            </p>
          )}

          {section === "Race Track" && (
            <p className="flavour">
              Race Track betting will open later.
            </p>
          )}

          {section === "Jacks or Better" && (
            <p className="flavour">
              Video poker. Coming soon.
            </p>
          )}

          {section === "Sports Betting" && (
            <p className="flavour">
              Sports books are not yet open.
            </p>
          )}

          {section === "Rumrunners Live" && (
            <p className="flavour">
              Live news from the underworld.
            </p>
          )}

          {section === "Wiki" && (
            <p className="flavour">
              The Rumrunners game guide.
            </p>
          )}

          {section === "Terms of Service" && (
            <p className="flavour">
              Game rules and terms of service.
            </p>
          )}

          {section === "Help Desk" && (
            <p className="flavour">
              Help and support for players.
            </p>
          )}

          {section === "Suggestion Box" && (
            <p className="flavour">
              Send suggestions for future improvements.
            </p>
          )}

          {section === "Full Site" && (
            <p className="flavour">
              You are viewing the full Rumrunners game.
            </p>
          )}

          {section === "Profile" && (
            <p className="flavour">
              Your player profile.
            </p>
          )}

          {section === "Game" && (
            <p className="flavour">
              Game discussion board.
            </p>
          )}

          {section !== "Home" &&
            section !== "Crimes" &&
            section !== "Local Bank" &&
            notice && (
              <p className="notice">{notice}</p>
            )}
          </>
          )}
        </main>

        {/* MENU */}
        <aside
          className="sidebar"
        >
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

      <footer className="footer">
        RUMRUNNERS · A CITY WITH ITS OWN RULES
      </footer>
    </div>
  );
}
