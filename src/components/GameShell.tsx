
"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode
} from "react";
import { rankForLevel } from "@/lib/ranks";
import BootleggingSection from "@/components/Bootlegging";
import AutoTheftSection from "@/components/AutoTheft";
import JailSection from "@/components/Jail";
import MailboxSection from "@/components/Mailbox";
import ForumBoard from "@/components/ForumBoard";
import SendLetterSection from "@/components/SendLetter";
import OrganisedCrimeSection from "@/components/OrganisedCrime";
import { clock, useActionStatus } from "@/components/EnergyBar";
import { GarageSection, TravelSection } from "@/components/Travel";
import { BulletFactorySection, CasinoSection, CitiesSection } from "@/components/Venues";
import StoreSection from "@/components/Store";
import LotterySection from "@/components/Lottery";
import FindPlayerSection from "@/components/FindPlayer";
import CharacterPanel from "@/components/CharacterPanel";
import WhackSection from "@/components/WhackSection";
import HospitalSection from "@/components/HospitalSection";
import { wealthStatus } from "@/lib/wealth";
import {
  CRIMES,
  MAX_STREAK,
  streakFromLogs,
  xpForLevel
} from "@/lib/game";

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
  jailSeconds: number;
};

const TIER_COLOURS: Record<string, string> = {
  perfect: "#e4c04d",
  clean: "#7fe08f",
  messy: "#d9a441",
  backed_off: "#b7ad93",
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
  theftWins: number;
  theftFails: number;
  boozeBought: number;
  boozeSold: number;
  boozeSpent: number;
  boozeEarned: number;
  ocsDone: number;
  ocsLed: number;
  ocEarned: number;
  joinedAt: string | null;
};

const EMPTY_STATS: PlayerStats = {
  crimeByType: [],
  casinoByGame: [],
  forumTopics: 0,
  forumPosts: 0,
  theftWins: 0,
  theftFails: 0,
  boozeBought: 0,
  boozeSold: 0,
  boozeSpent: 0,
  boozeEarned: 0,
  ocsDone: 0,
  ocsLed: 0,
  ocEarned: 0,
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
  padding: "6px 8px",
  textAlign: "center",
  fontSize: 15,
  fontWeight: 400,
  fontFamily: "Georgia, serif",
  letterSpacing: 0.3,
  color: "#f7efdb",
  background: "linear-gradient(180deg, #8a7038 0%, #4d3d1c 100%)",
  borderTop: "1px solid #b0904a",
  borderBottom: "1px solid #b0904a",
  textShadow: "0 1px 2px #000"
};

function TitleBar({ children }: { children: ReactNode }) {
  return <div style={titleBarStyle}>{children}</div>;
}

function StatGroup({ title }: { title: string }) {
  return (
    <div
      style={{
        padding: "2px 8px",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        color: "#d9b45f",
        background: "#26322c",
        borderBottom: "1px solid #6b5d3a"
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
        gap: 10,
        padding: "3px 8px",
        fontSize: 12,
        lineHeight: 1.3,
        background: "#17201c",
        borderBottom: "1px solid #2b3630"
      }}
    >
      <span style={{ color: "#d4cab2", minWidth: 0, overflowWrap: "anywhere" }}>
        {label}
      </span>
      <span
        style={{
          color:
            tone === "good"
              ? "#7fe08f"
              : tone === "bad"
                ? "#e08f7f"
                : "#f1e8d3",
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
          color: "#b7ad93",
          background: "#161d19",
          borderBottom: "1px solid #6b5d3a"
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
            padding: "3px 8px",
            fontSize: 12,
            lineHeight: 1.3,
            color: "#f1e8d3",
            background: "#17201c",
            borderBottom: "1px solid #2b3630"
          }}
        >
          {row.map((value, i) => (
            <span
              key={i}
              style={{
                ...cell(i),
                color: i === 0 ? "#d4cab2" : "#f1e8d3",
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

// Anything that acts on the game world is shut while you are in jail.
const JAIL_BLOCKED = new Set([
  "Crimes", "Auto Theft", "Bootlegging", "Whack", "Hitlist", "Organised Crime",
  "Rackets", "Search", "Shooting Range", "Railway", "Bullet Factory", "Store",
  "Blackjack", "Keno", "Lottery", "Roulette", "Slot Machines", "War"
]);

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
      "Bullet Factory", "Store", "Escrow", "Gold",
      "Marketplace", "Hospital", "Jail", "Local Bank",
      "Pawn Shop", "Stock Market", "Railway", "Garage", "Brothel"
    ]
  },
  {
    title: "Casino",
    items: [
      "Blackjack", "Keno", "Lottery",
      "Roulette", "Slot Machines", "War"
    ]
  }
];

export default function GameShell({
  player,
  isAdmin = false,
  playerId,
  recentCrimes = [],
  stats = EMPTY_STATS,
  composeTo = ""
}: {
  player: Player;
  isAdmin?: boolean;
  playerId: string;
  recentCrimes?: CrimeLog[];
  stats?: PlayerStats;
  composeTo?: string;
}) {
  const [section, setSection] = useState(composeTo ? "Send Letter" : "Home");
  const [letterTo, setLetterTo] = useState(composeTo);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [characterOpen, setCharacterOpen] = useState(false);
  const [menuGroup, setMenuGroup] = useState("");
  const [notice, setNotice] = useState("");
  const status = useActionStatus({
    energy: player.energy,
    maxEnergy: player.maxEnergy
  });
  const energy = status.energy;
  const setEnergy = status.setEnergy;
  const [money, setMoney] = useState(player.money);
  const [bullets, setBullets] = useState(player.bullets);
  const [bank, setBank] = useState(player.bank);
  const [rank, setRank] = useState(player.rank);
  const [rankLevel, setRankLevel] = useState(player.rankLevel);
  const [experience, setExperience] = useState(player.experience);
  const [busy, setBusy] = useState(false);
  const [currentCity, setCurrentCity] = useState(player.currentCity || "London");
  const [ukClock, setUkClock] = useState("--:--:--");
  const [ukDate, setUkDate] = useState("Loading UK time");
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
            `You can't pull that job again yet. Wait ${data.remaining ?? "a few"} seconds.`
          );
          status.refresh();
        } else if (data.error === "JAILED") {
          setNotice("You're locked up. Wait out your sentence or try to break out.");
          status.refresh();
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
      status.refresh();

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
        rank: data.rank,
        jailSeconds: data.jailSeconds ?? 0
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

  function openLetter(name: string) {
    navigate("Send Letter");
    setLetterTo(name);
  }

  function navigate(item: string) {
    setLetterTo("");
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

    const theftTotal = stats.theftWins + stats.theftFails;
    const boozeProfit = stats.boozeEarned - stats.boozeSpent;
    const signed = (n: number) => `${n < 0 ? "-" : n > 0 ? "+" : ""}${gbp(Math.abs(n))}`;

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

        <div style={{ padding: "4px 0", background: "#101612" }}>
          <select
            aria-label="Statistics category"
            value={statsCategory}
            onChange={(e) => setStatsCategory(e.target.value)}
            style={{
              display: "block",
              width: "100%",
              height: 32,
              padding: "0 8px",
              border: "1px solid #a08340",
              borderRadius: 0,
              background: "#161d19",
              color: "#f1e8d3",
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

        <div style={{ border: "1px solid #6b5d3a", borderBottom: 0 }}>
          {statsCategory === "Current" && (
            <>
              <StatGroup title="Crimes" />
              <StatRow label="Crimes succeeded" value={succeeded.toLocaleString("en-GB")} />
              <StatRow label="Success percentage" value={pct(succeeded, attempts)} />
              <StatRow label="Crimes failed" value={failed.toLocaleString("en-GB")} />
              <StatRow label="Total crimes" value={attempts.toLocaleString("en-GB")} />
              <StatRow label="Cash earned" value={gbp(cashEarned)} />

              <StatGroup title="Auto theft" />
              <StatRow label="Cars stolen" value={stats.theftWins.toLocaleString("en-GB")} />
              <StatRow label="Thefts failed" value={stats.theftFails.toLocaleString("en-GB")} />
              <StatRow label="Success percentage" value={pct(stats.theftWins, theftTotal)} />

              <StatGroup title="Bootlegging" />
              <StatRow label="Crates bought" value={stats.boozeBought.toLocaleString("en-GB")} />
              <StatRow label="Crates sold" value={stats.boozeSold.toLocaleString("en-GB")} />
              <StatRow label="Booze profit" value={signed(boozeProfit)} tone={boozeProfit > 0 ? "good" : boozeProfit < 0 ? "bad" : undefined} />

              <StatGroup title="Organised crime" />
              <StatRow label="Jobs completed" value={stats.ocsDone.toLocaleString("en-GB")} />
              <StatRow label="Jobs led" value={stats.ocsLed.toLocaleString("en-GB")} />
              <StatRow label="Earned from jobs" value={gbp(stats.ocEarned)} />

              <StatGroup title="Character" />
              <StatRow label="Rank" value={rank} />
              <StatRow label="Level" value={rankLevel} />
              <StatRow label="Wealth" value={wealthStatus(money, bank)} />
              <StatRow
                label="Experience"
                value={`${xpCurrent.toLocaleString("en-GB")} / ${xpNext.toLocaleString("en-GB")}`}
              />
              <StatRow label="Level progress" value={`${xpProgress}%`} />
              <StatRow label="Energy" value={`${energy} / ${status.maxEnergy}`} />
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

              <StatGroup title="Auto theft" />
              <StatRow label="Cars stolen" value={stats.theftWins.toLocaleString("en-GB")} />
              <StatRow label="Thefts failed" value={stats.theftFails.toLocaleString("en-GB")} />
              <StatRow label="Total attempts" value={theftTotal.toLocaleString("en-GB")} />
              <StatRow label="Success percentage" value={pct(stats.theftWins, theftTotal)} />

              <StatGroup title="Bootlegging" />
              <StatRow label="Crates bought" value={stats.boozeBought.toLocaleString("en-GB")} />
              <StatRow label="Crates sold" value={stats.boozeSold.toLocaleString("en-GB")} />
              <StatRow label="Total spent" value={gbp(stats.boozeSpent)} />
              <StatRow label="Total earned" value={gbp(stats.boozeEarned)} />
              <StatRow label="Profit" value={signed(boozeProfit)} tone={boozeProfit > 0 ? "good" : boozeProfit < 0 ? "bad" : undefined} />

              <StatGroup title="Organised crime" />
              <StatRow label="Jobs completed" value={stats.ocsDone.toLocaleString("en-GB")} />
              <StatRow label="Jobs led" value={stats.ocsLed.toLocaleString("en-GB")} />
              <StatRow label="Earned from jobs" value={gbp(stats.ocEarned)} />

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
              <StatRow label="Wealth status" value={wealthStatus(money, bank)} />
              <StatRow label="Gold" value={player.gold.toLocaleString("en-GB")} />

              <StatGroup title="Earnings" />
              <StatRow label="Cash earned from crimes" value={gbp(cashEarned)} />
              <StatRow label="Earned from selling booze" value={gbp(stats.boozeEarned)} />
              <StatRow label="Earned from organised crime" value={gbp(stats.ocEarned)} />
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

  // Every crime you can do, plus the next one up shown greyed out.
  const availableCrimes = useMemo(() => {
    const open = CRIMES.filter((c) => c.minRankLevel <= rankLevel);
    const locked = CRIMES.filter((c) => c.minRankLevel > rankLevel);
    const nextLevel = locked.length
      ? Math.min(...locked.map((c) => c.minRankLevel))
      : 0;

    return [...open, ...locked.filter((c) => c.minRankLevel === nextLevel).slice(0, 1)];
  }, [rankLevel]);

  return (
    <div className="game">
      {/* TOP BAR */}
      <header
        className="topbar"
        style={{
          minHeight: 0,
          height: "auto",
          padding: "6px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "nowrap",
          background: "#0b0f0d",
          borderBottom: "1px solid #2a3a30"
        }}
      >
        {/* CHARACTER BUTTON AND CASH, BANK AND GOLD — TOP LEFT */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <button
          type="button"
          aria-label="Character"
          title="Character"
          onClick={() => setCharacterOpen(true)}
          style={{
            width: 44,
            height: 54,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            padding: 0,
            border: "1px solid #a08340",
            borderRadius: 3,
            background: "linear-gradient(180deg, #393126, #211c16)",
            color: "#e8d7b6",
            fontSize: 9,
            cursor: "pointer"
          }}
        >
          <svg viewBox="0 0 40 44" width="26" height="28" aria-hidden="true">
            <ellipse cx="20" cy="8" rx="12" ry="2.5" fill="#cbb98a" />
            <rect x="13" y="1" width="14" height="8" rx="2" fill="#e8d7b6" />
            <circle cx="20" cy="16" r="6" fill="#c9b48a" />
            <path d="M6 42 Q8 26 20 24 Q32 26 34 42 Z" fill="#8a7a58" />
          </svg>
          Character
        </button>
        <div
          aria-label="Player money"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            minWidth: 0,
            color: "#f1e8d3",
            fontSize: 12,
            lineHeight: 1.2
          }}
        >
          <span
            aria-label={`Cash £${money.toLocaleString("en-GB")}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap"
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: 20,
                height: 12,
                borderRadius: 2,
                border: "1px solid #3f8a4d",
                background: "linear-gradient(135deg, #4f9a5a, #2a5c34)",
                boxShadow: "inset 0 0 0 2px rgba(200, 245, 205, 0.25)",
                flexShrink: 0
              }}
            />
            <strong
              style={{
                fontFamily: "Georgia, serif",
                fontSize: 17,
                fontWeight: 700,
                letterSpacing: 0.3,
                color: "#9be39f",
                textShadow: "0 1px 2px #000"
              }}
            >
              £{money.toLocaleString("en-GB")}
            </strong>
          </span>

          <span
            style={{
              color: "#b7ad93",
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
                color: "#b7ad93"
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

          <div
            aria-label={`Energy ${energy} of ${status.maxEnergy}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
              fontSize: 11,
              color: "#e4c04d"
            }}
          >
            <span>⚡ {energy}/{status.maxEnergy}</span>
            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: 74,
                height: 8,
                background: "#101612",
                border: "1px solid #6b5d3a"
              }}
            >
              <span
                style={{
                  display: "block",
                  height: "100%",
                  width: `${Math.max(0, Math.min(100, (energy / Math.max(1, status.maxEnergy)) * 100))}%`,
                  background: "linear-gradient(180deg, #e0c35a, #a8872a)",
                  transition: "width 0.4s"
                }}
              />
            </span>
            <span style={{ color: "#b7ad93" }}>
              {status.nextEnergyIn > 0 ? "+10 / 40s" : "Full"}
            </span>
          </div>
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
              position: "relative",
              width: 32,
              height: 32,
              display: "grid",
              placeItems: "center",
              padding: 0,
              border: "1px solid #a08340",
              borderRadius: 3,
              background: "linear-gradient(180deg, #393126, #211c16)",
              color: "#e8d7b6",
              fontSize: 17,
              cursor: "pointer"
            }}
          >
            ✉
            {status.unreadMail > 0 && (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: -5,
                  right: -5,
                  minWidth: 15,
                  height: 15,
                  padding: "0 3px",
                  borderRadius: 8,
                  background: "#c0392b",
                  color: "#fff",
                  fontSize: 10,
                  lineHeight: "15px",
                  fontWeight: 700,
                  textAlign: "center"
                }}
              >
                {status.unreadMail > 9 ? "9+" : status.unreadMail}
              </span>
            )}
          </button>

          <button
            type="button"
            aria-label="Jail"
            title="Jail"
            onClick={() => navigate("Jail")}
            style={{
              width: 32,
              height: 32,
              display: "grid",
              placeItems: "center",
              padding: 0,
              border: "1px solid #a08340",
              borderRadius: 3,
              background: "linear-gradient(180deg, #393126, #211c16)",
              color: "#e8d7b6",
              fontSize: 17,
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
              minWidth: 58,
              height: 32,
              padding: "0 10px",
              marginLeft: 1,
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
        </nav>
      </header>

      {characterOpen && <CharacterPanel onClose={() => setCharacterOpen(false)} />}

      {/* LOCATION AND TIME — ONLY WHILE THE MENU IS OPEN */}
      {menuOpen && (
        <>
        <div
          className="city-strip"
          style={{
            minHeight: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "nowrap",
            gap: 8,
            padding: "4px 10px",
            background: "#161d19",
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
                  background: "#000000",
                  borderTop: "0",
                  borderBottom: "1px solid #494033"
                }}
              >
                {[
                  {
                    label: "Jail",
                    status: status.jailLeft > 0 ? clock(status.jailLeft) : "Free",
                    target: "Jail"
                  },
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
          {status.jailLeft > 0 && JAIL_BLOCKED.has(section) ? (
            <JailSection onChanged={status.refresh} />
          ) : (
          <>
          {(section === "Home" || section === "Statistics") &&
            renderStatistics()}

          {section === "Crimes" && (
            <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
              <div
                style={{
                  ...titleBarStyle,
                  fontSize: 16,
                  padding: "6px 8px"
                }}
              >
                Crimes
              </div>

              <div style={{ border: "1px solid #6b5d3a", borderTop: 0 }}>
                <div
                  style={{
                    padding: "4px 10px",
                    fontSize: 12,
                    color: streak > 0 ? "#7fe08f" : "#b7ad93",
                    background: "#17201c"
                  }}
                >
                  {streak > 0
                    ? `Streak ${streak}/${MAX_STREAK}`
                    : "No streak. Land a job to start one."}
                </div>
              </div>

              {status.jailLeft > 0 && (
                <p className="notice">
                  You are in jail for another {clock(status.jailLeft)}.{" "}
                  <button
                    type="button"
                    onClick={() => navigate("Jail")}
                    style={{ background: "none", border: 0, color: "#e4c04d", textDecoration: "underline", cursor: "pointer", fontSize: 12 }}
                  >
                    Go to the prison
                  </button>
                </p>
              )}

              {outcome && (
                <div
                  style={{
                    margin: "8px 0",
                    border: `1px solid ${TIER_COLOURS[outcome.tier] ?? "#a08340"}`,
                    background: "#17201c"
                  }}
                >
                  <div
                    style={{
                      ...titleBarStyle,
                      fontSize: 15,
                      padding: "5px 8px",
                      color: TIER_COLOURS[outcome.tier] ?? "#f7efdb"
                    }}
                  >
                    {outcome.label}
                  </div>

                  {outcome.leveledUp && (
                    <div
                      style={{
                        padding: "6px 10px",
                        textAlign: "center",
                        fontFamily: "Georgia, serif",
                        fontSize: 15,
                        color: "#1b1405",
                        background: "linear-gradient(180deg, #f0d878, #c9a23a)",
                        borderBottom: "1px solid #7a5a0c"
                      }}
                    >
                      ★ Promoted to {outcome.rank}! ★
                      <div style={{ fontFamily: "inherit", fontSize: 11, marginTop: 1 }}>
                        Check the Crimes list. New jobs may have opened up.
                      </div>
                    </div>
                  )}

                  <div style={{ padding: "6px 10px", fontSize: 13 }}>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#b7ad93",
                        textTransform: "uppercase",
                        letterSpacing: 0.5
                      }}
                    >
                      {outcome.crimeName} · {outcome.sceneTitle}
                    </div>

                    {outcome.setup && (
                      <p
                        style={{
                          margin: "4px 0",
                          fontStyle: "italic",
                          color: "#d4cab2",
                          lineHeight: 1.4
                        }}
                      >
                        {outcome.setup}
                      </p>
                    )}

                    <p style={{ margin: "4px 0", color: "#f1e8d3", lineHeight: 1.4 }}>
                      {outcome.result}
                    </p>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "2px 14px",
                        marginTop: 6,
                        fontWeight: 600
                      }}
                    >
                      {(outcome.success || outcome.cashChange !== 0) && (
                      <span
                        style={{
                          color:
                            outcome.cashChange > 0
                              ? "#7fe08f"
                              : outcome.cashChange < 0
                                ? "#e08f7f"
                                : "#f1e8d3"
                        }}
                      >
                        {outcome.cashChange < 0
                          ? `Fined -${gbp(Math.abs(outcome.cashChange))}`
                          : `+${gbp(outcome.cashChange)}`}
                      </span>
                      )}
                      <span>+{outcome.xpGained} XP</span>
                      {outcome.jailSeconds > 0 && (
                        <span style={{ color: "#e08f7f" }}>
                          Jailed {outcome.jailSeconds >= 60 ? `${Math.ceil(outcome.jailSeconds / 60)} min` : `${outcome.jailSeconds} sec`}
                        </span>
                      )}
                      {outcome.success && outcome.streakBonus > 0 && (
                        <span style={{ color: "#7fe08f" }}>
                          Streak +{Math.round(outcome.streakBonus * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {notice && <p className="notice">{notice}</p>}

              <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
                {availableCrimes.map((crime) => {
                  if (crime.minRankLevel > rankLevel) {
                    return (
                      <div
                        key={crime.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "5px 8px",
                          border: "1px solid #3a3a30",
                          background: "#161b18",
                          opacity: 0.6
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "Georgia, serif", fontSize: 14, color: "#8a8470" }}>
                            {crime.name}
                          </div>
                          <div style={{ fontSize: 11, color: "#8a8470" }}>
                            Unlocks at {rankForLevel(crime.minRankLevel)}
                          </div>
                        </div>
                        <button
                          className="button"
                          style={{ flexShrink: 0, width: 70, padding: "5px 0", fontSize: 12, opacity: 0.55 }}
                          disabled
                        >
                          Locked
                        </button>
                      </div>
                    );
                  }

                  const wait = status.crimeLeft(crime.id);
                  const needsEnergy = energy < crime.energyCost;
                  const disabled = busy || wait > 0 || needsEnergy || status.jailLeft > 0;

                  return (
                    <div
                      key={crime.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "5px 8px",
                        border: "1px solid #6b5d3a",
                        background: "#1f2a25",
                        opacity: wait > 0 ? 0.75 : 1
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "Georgia, serif", fontSize: 14, color: "#f7efdb" }}>
                          {crime.name}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#b7ad93",
                            lineHeight: 1.25,
                            overflow: "hidden",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical"
                          }}
                        >
                          {crime.description}
                        </div>
                      </div>

                      <span
                        title="Energy cost"
                        style={{
                          flexShrink: 0,
                          fontSize: 12,
                          color: needsEnergy ? "#e08f7f" : "#e4c04d"
                        }}
                      >
                        ⚡{crime.energyCost}
                      </span>

                      <button
                        className="button"
                        style={{
                          flexShrink: 0,
                          width: 70,
                          padding: "5px 0",
                          fontSize: 12,
                          opacity: disabled ? 0.55 : 1
                        }}
                        disabled={disabled}
                        onClick={() => commitCrime(crime.id)}
                      >
                        {status.jailLeft > 0
                          ? "Jailed"
                          : wait > 0
                          ? clock(wait)
                          : needsEnergy
                            ? "Tired"
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
            <CasinoSection game="Blackjack" cash={money} onCash={setMoney} />
          )}

          {section === "Roulette" && (
            <CasinoSection game="Roulette" cash={money} onCash={setMoney} />
          )}

          {section === "War" && (
            <CasinoSection game="War" cash={money} onCash={setMoney} />
          )}

          {section === "Auto Theft" && (
            <AutoTheftSection
              rankLevel={rankLevel}
              energy={energy}
              theftLeft={status.theftLeft}
              onActed={status.refresh}
              jailLeft={status.jailLeft}
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

          {section === "Bootlegging" && <BootleggingSection onCash={setMoney} />}

          {section === "Organised Crime" && <OrganisedCrimeSection />}

          {section === "Whack" && <WhackSection onCash={setMoney} />}

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

          {section === "Bullet Factory" && (
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
            <JailSection onChanged={status.refresh} />
          )}

          {section === "Hospital" && <HospitalSection onCash={setMoney} />}

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

          {section === "Find Player" && <FindPlayerSection />}

          {section === "Mailbox" && (
            <MailboxSection
              onOpenOc={() => navigate("Organised Crime")}
              onReply={openLetter}
              onChanged={status.refresh}
            />
          )}

          {section === "Send Letter" && (
            <SendLetterSection key={letterTo} initialTo={letterTo} />
          )}

          {section === "Saved Mail" && (
            <p className="flavour">
              Your saved messages.
            </p>
          )}

          {section === "Classifieds" && (
            <ForumBoard
              key="CLASSIFIEDS"
              category="CLASSIFIEDS"
              title="Classifieds"
              isAdmin={isAdmin}
              playerId={playerId}
            />
          )}

          {section === "Off Topic" && (
            <ForumBoard
              key="OFF_TOPIC"
              category="OFF_TOPIC"
              title="Off Topic"
              isAdmin={isAdmin}
              playerId={playerId}
            />
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

          {section === "Store" && <StoreSection onCash={setMoney} />}

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

          {section === "Lottery" && <LotterySection onCash={setMoney} />}

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

          {section === "Forums" && (
            <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", display: "grid", gap: 6 }}>
              <div style={{ ...titleBarStyle, fontSize: 16, padding: "6px 8px" }}>Forums</div>
              {[
                { name: "Game", note: "Talk about the game, news and updates." },
                { name: "Classifieds", note: "Buy, sell and trade with other players." },
                { name: "Off Topic", note: "The public house. Anything beyond the game." }
              ].map((f) => (
                <button
                  key={f.name}
                  type="button"
                  className="nav-item"
                  onClick={() => navigate(f.name)}
                  style={{ width: "100%" }}
                >
                  <strong style={{ display: "block", fontSize: 14 }}>{f.name}</strong>
                  <span style={{ fontSize: 11, color: "#b7ad93", fontFamily: "inherit" }}>{f.note}</span>
                </button>
              ))}
            </div>
          )}

          {section === "Game" && (
            <ForumBoard
              key="OFFICIAL"
              category="OFFICIAL"
              title="Game"
              isAdmin={isAdmin}
              playerId={playerId}
            />
          )}

          {section !== "Home" &&
            section !== "Crimes" &&
            section !== "Local Bank" &&
            notice && (
              <p className="notice">{notice}</p>
            )}
          </>
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
