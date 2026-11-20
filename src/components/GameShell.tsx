"use client";

import {
  useCallback,
  useRef,
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
import SearchSection from "@/components/SearchSection";
import { crimeForCity } from "@/lib/city-crimes";
import CrimePopup from "@/components/CrimePopup";
import { Banner, JobCard, slugify } from "@/components/GameImage";
import HospitalSection from "@/components/HospitalSection";
import HitlistSection from "@/components/HitlistSection";
import GoldMarketplace from "@/components/GoldMarketplace";
import GymnasiumSection from "@/components/Gymnasium";
import EscrowSection from "@/components/EscrowSection";
import { energyCostFor } from "@/lib/training";
import GraveyardSection from "@/components/GraveyardSection";
import BankSection from "@/components/BankSection";
import { wealthStatus } from "@/lib/wealth";
import {
  CRIMES,
  crimeCooldownSeconds,
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
  displayName?: string;
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
  kills: number;
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
  kills: 0,
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
// Pages that get a wide picture across the top. The picture file is
// public/images/banners/<page-name>.jpg, for example banners/local-bank.jpg
const BANNER_PAGES = new Set([
  "Local Bank",
  "Bootlegging", "Organised Crime", "Whack", "Rackets",
  "Marketplace", "Railway", "Garage", "Bullet Factory", "Escrow", "Jail",
  "Hospital", "Graveyard", "Cities", "Store", "Lottery", "Gold",
  "Pawn Shop", "Stock Market", "Brothel", "Crew", "Find Player"
]);

const JAIL_BLOCKED = new Set([
  "Crimes", "Auto Theft", "Bootlegging", "Whack", "Hitlist", "Organised Crime",
  "Rackets", "Search", "Gymnasium", "Railway", "Bullet Factory", "Store",
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
      "Organised Crime", "Rackets", "Search"
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
  training,
  composeTo = "",
  startSection = ""
}: {
  player: Player;
  isAdmin?: boolean;
  playerId: string;
  recentCrimes?: CrimeLog[];
  stats?: PlayerStats;
  training?: { strength: number; stamina: number; agility: number };
  composeTo?: string;
  startSection?: string;
}) {
  const [section, setSection] = useState(
    composeTo
      ? "Send Letter"
      : menuGroups.some((g) => g.items.includes(startSection))
        ? startSection
        : "Home"
  );
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
  const [gold, setGold] = useState(player.gold);
  const [staminaLevel, setStaminaLevel] = useState(training?.stamina ?? 0);
  const onTrainingLevels = useCallback(
    (l: { strength: number; stamina: number; agility: number }) => setStaminaLevel(l.stamina),
    []
  );
  // Other people's actions change your cash (a gambler at your casino, a gold
  // sale), so check the balance every few seconds while the page is showing.
  const [liveUnread, setLiveUnread] = useState<number | null>(null);
  const [latestMailId, setLatestMailId] = useState("");
  const checkBalanceRef = useRef<() => void>(() => {});
  useEffect(() => {
    let alive = true;
    let inFlight = false;
    async function check() {
      if (inFlight || document.hidden) return;
      inFlight = true;
      try {
        const r = await fetch("/api/balance", { cache: "no-store" });
        if (!r.ok || !alive) return;
        const d = await r.json();
        if (typeof d.money === "number") setMoney(d.money);
        if (typeof d.bank === "number") setBank(d.bank);
        if (typeof d.gold === "number") setGold(d.gold);
        if (typeof d.bullets === "number") setBullets(d.bullets);
        if (typeof d.unreadMail === "number") setLiveUnread(d.unreadMail);
        if (typeof d.latestMailId === "string") setLatestMailId(d.latestMailId);
      } catch {
        /* try again next time */
      } finally {
        inFlight = false;
      }
    }
    checkBalanceRef.current = check;
    check();
    const t = window.setInterval(check, 4000);
    document.addEventListener("visibilitychange", check);
    return () => {
      alive = false;
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
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
  const [crimeTier, setCrimeTier] = useState(-1);

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
        displayName: data.displayName ?? data.crimeName,
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
      window.location.href = "/profile-edit";
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
              <StatRow label="Kills" value={stats.kills.toLocaleString("en-GB")} />
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
              <StatRow label="Gold" value={gold.toLocaleString("en-GB")} />

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

  // Crimes come in tiers of four. Every crime is listed; the ones above
  // your rank are greyed out with the rank that unlocks them.
  const crimeTiers = useMemo(() => {
    const out: (typeof CRIMES)[number][][] = [];
    for (let i = 0; i < CRIMES.length; i += 4) out.push(CRIMES.slice(i, i + 4));
    return out;
  }, []);
  const topOpenTier = Math.max(
    0,
    crimeTiers.reduce((n, t, i) => (t[0].minRankLevel <= rankLevel ? i : n), 0)
  );
  const activeTier = crimeTier === -1 ? topOpenTier : Math.min(crimeTier, crimeTiers.length - 1);

  return (
    <div className="game">
      {/* TOP BAR */}
      <header
        className="topbar"
        style={{
          position: "relative",
          overflow: "hidden",
          minHeight: 0,
          height: "auto",
          padding: "6px 8px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "nowrap",
          background: "linear-gradient(180deg, #1a1620 0%, #3a2a2e 55%, #7a5a48 100%)",
          borderBottom: "1px solid #a08340"
        }}
      >
        {/* City skyline behind the bar */}
        <svg
          aria-hidden="true"
          viewBox="0 0 400 40"
          preserveAspectRatio="none"
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, width: "100%", height: 38, pointerEvents: "none" }}
        >
          <path
            d="M0 40 V26 H10 V18 H18 V26 H26 V12 H34 V8 H40 V12 H46 V22 H56 V14 H64 V24 H74 V16 H80 V6 H84 V16 H92 V26 H104 V20 H112 V10 H120 V20 H130 V28 H142 V18 H150 V24 H160 V14 H168 V10 H174 V14 H182 V26 H194 V20 H204 V12 H212 V22 H222 V28 H234 V16 H242 V8 H246 V16 H254 V24 H266 V18 H274 V26 H286 V14 H294 V20 H304 V10 H312 V18 H322 V26 H334 V20 H342 V12 H350 V22 H360 V16 H368 V26 H380 V18 H390 V24 H400 V40 Z"
            fill="#0b0f0d"
            opacity="0.85"
          />
        </svg>
        {/* CHARACTER TILE AND CASH, GOLD AND ENERGY — TOP LEFT */}
        <div style={{ position: "relative", display: "flex", alignItems: "stretch", gap: 8, minWidth: 0, flex: 1 }}>
          <button
            type="button"
            aria-label="Character"
            title="Character"
            onClick={() => setCharacterOpen(true)}
            style={{
              position: "relative",
              width: 54,
              height: 62,
              flexShrink: 0,
              padding: 0,
              overflow: "hidden",
              border: "1px solid #a08340",
              borderRadius: 3,
              background: "linear-gradient(180deg, #393126, #211c16)",
              cursor: "pointer"
            }}
          >
            <svg viewBox="0 0 40 44" width="34" height="38" aria-hidden="true" style={{ display: "block", margin: "4px auto 0" }}>
              <ellipse cx="20" cy="8" rx="12" ry="2.5" fill="#cbb98a" />
              <rect x="13" y="1" width="14" height="8" rx="2" fill="#e8d7b6" />
              <circle cx="20" cy="16" r="6" fill="#c9b48a" />
              <path d="M6 42 Q8 26 20 24 Q32 26 34 42 Z" fill="#8a7a58" />
            </svg>
            <span
              aria-label={`Health ${player.health}%`}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: 15,
                background: "#1a1410",
                borderTop: "1px solid #55452e"
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${Math.max(0, Math.min(100, player.health))}%`,
                  background:
                    player.health > 50 ? "#3f9a46" : player.health > 25 ? "#c9923a" : "#b3342a"
                }}
              />
              <span
                style={{
                  position: "relative",
                  display: "block",
                  textAlign: "center",
                  fontSize: 10,
                  lineHeight: "14px",
                  fontWeight: 700,
                  color: "#fff",
                  textShadow: "0 1px 1px #000"
                }}
              >
                {player.health}%
              </span>
            </span>
          </button>

          <div
            aria-label="Player money"
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: 3,
              minWidth: 0,
              maxWidth: 200,
              flex: 1,
              padding: "4px 7px",
              background: "rgba(0, 0, 0, 0.6)",
              border: "1px solid #3d3a34",
              color: "#f1e8d3"
            }}
          >
            <span
              aria-label={`Cash £${money.toLocaleString("en-GB")}`}
              style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 20,
                  height: 12,
                  borderRadius: 2,
                  border: "1px solid #3f8a4d",
                  background: "linear-gradient(135deg, #4f9a5a, #2a5c34)",
                  flexShrink: 0
                }}
              />
              <strong
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: 16,
                  color: "#9be39f",
                  textShadow: "0 1px 2px #000",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }}
              >
                £{money.toLocaleString("en-GB")}
              </strong>
            </span>

            <span style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", fontSize: 12 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: "50%",
                  background: "radial-gradient(circle at 35% 30%, #fff2a8, #e4b822 55%, #9a7410)",
                  border: "1px solid #7a5a0c",
                  flexShrink: 0
                }}
              />
              <strong style={{ color: "#e4c04d" }}>{gold.toLocaleString("en-GB")}</strong>
              <span style={{ color: "#8f8a76", overflow: "hidden", textOverflow: "ellipsis" }}>
                · Bank £{bank.toLocaleString("en-GB")}
              </span>
            </span>

            <div
              aria-label={`Energy ${energy} of ${status.maxEnergy}`}
              title={status.nextEnergyIn > 0 ? "Energy: +10 every 40 seconds" : "Energy is full"}
              style={{
                position: "relative",
                height: 18,
                background: "#101612",
                border: "1px solid #6b5d3a",
                borderRadius: 3,
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${Math.max(0, Math.min(100, (energy / Math.max(1, status.maxEnergy)) * 100))}%`,
                  background: "linear-gradient(180deg, #b8962f, #6e5714)",
                  transition: "width 0.4s"
                }}
              />
              <div
                style={{
                  position: "relative",
                  textAlign: "center",
                  fontSize: 12,
                  lineHeight: "16px",
                  fontWeight: 700,
                  color: "#fff",
                  textShadow: "0 1px 2px #000"
                }}
              >
                ⚡ {energy} / {status.maxEnergy}
              </div>
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
            marginLeft: "auto",
            position: "relative"
          }}
        >
          <button
            type="button"
            aria-label="Messages"
            title="Messages"
            onClick={() => navigate("Mailbox")}
            style={{
              position: "relative",
              width: 44,
              height: 44,
              display: "grid",
              placeItems: "center",
              padding: 0,
              border: "1px solid #a08340",
              borderRadius: 3,
              background: "linear-gradient(180deg, #4a4338, #1c1813)",
              color: "#e8d7b6",
              fontSize: 22,
              cursor: "pointer"
            }}
          >
            ✉
            {(liveUnread ?? status.unreadMail) > 0 && (
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
                {(liveUnread ?? status.unreadMail) > 9 ? "9+" : (liveUnread ?? status.unreadMail)}
              </span>
            )}
          </button>

          <button
            type="button"
            aria-label="Jail"
            title="Jail"
            onClick={() => navigate("Jail")}
            style={{
              width: 44,
              height: 44,
              display: "grid",
              placeItems: "center",
              padding: 0,
              border: "1px solid #a08340",
              borderRadius: 3,
              background: "linear-gradient(180deg, #4a4338, #1c1813)",
              color: "#e8d7b6",
              fontSize: 22,
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
              minWidth: 54,
              height: 44,
              padding: "0 8px",
              marginLeft: 1,
              border: "1px solid #c3a870",
              borderRadius: 3,
              background: "linear-gradient(180deg, #5a4a32, #2a2117)",
              color: "#f7efdb",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Menu
          </button>
        </nav>
      </header>

      {characterOpen && <CharacterPanel onClose={() => setCharacterOpen(false)} />}

      {/* Shown over whatever page you are on, so a failed job that sends you to
          jail still tells you what happened, and never turns up late. */}
      {outcome && <CrimePopup outcome={outcome} onClose={() => setOutcome(null)} />}

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
          {BANNER_PAGES.has(section) && <Banner slot={`banners/${slugify(section)}`} />}
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

              {notice && <p className="notice">{notice}</p>}

              <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                {crimeTiers.map((t, i) => {
                  const open = t[0].minRankLevel <= rankLevel;
                  const on = i === activeTier;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCrimeTier(i)}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        padding: "8px 0",
                        fontSize: 15,
                        border: on ? "1px solid #f0dfa8" : "1px solid #6b5d3a",
                        background: on ? "#8f8668" : "#4a4640",
                        color: open ? "#f7efdb" : "#9a9382",
                        cursor: "pointer"
                      }}
                    >
                      {i + 1}
                      {!open && <span style={{ fontSize: 11 }}> 🔒</span>}
                    </button>
                  );
                })}
              </div>

              <div style={{ margin: "4px 0 6px", fontSize: 12, color: "#b7ad93", textAlign: "center" }}>
                {crimeTiers[activeTier][0].minRankLevel <= rankLevel
                  ? `Tier ${activeTier + 1} · unlocked`
                  : `Tier ${activeTier + 1} unlocks at ${rankForLevel(crimeTiers[activeTier][0].minRankLevel)}`}
              </div>

              <div style={{ display: "grid", gap: 4 }}>
                {crimeTiers[activeTier].map((baseCrime) => {
                  const crime = crimeForCity(baseCrime, currentCity);
                  if (crime.minRankLevel > rankLevel) {
                    return (
                      <JobCard
                        key={crime.id}
                        slot={`crimes/${crime.id}`}
                        title={crime.name}
                        description={crime.description}
                        meters={[]}
                        locked
                        lockedText={`Unlocks at ${rankForLevel(crime.minRankLevel)}`}
                        buttonLabel="Locked"
                      />
                    );
                  }

                  const wait = status.crimeLeft(crime.id);
                  const crimeEnergy = energyCostFor(crime.energyCost, staminaLevel);
                  const needsEnergy = energy < crimeEnergy;
                  const disabled = busy || wait > 0 || needsEnergy || status.jailLeft > 0;

                  return (
                    <JobCard
                      key={crime.id}
                      slot={`crimes/${crime.id}`}
                      title={crime.name}
                      description={crime.description}
                      meters={[]}
                      seconds={crimeCooldownSeconds(crime.energyCost)}
                      hideTime
                      energy={crimeEnergy}
                      tired={needsEnergy}
                      waiting={wait > 0}
                      waitLeft={wait}
                      disabled={disabled}
                      buttonLabel={
                        status.jailLeft > 0 ? "Jailed" : wait > 0 ? clock(wait) : needsEnergy ? "Tired" : "Commit!"
                      }
                      onClick={() => commitCrime(crime.id)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {section === "Local Bank" && (
            <BankSection money={money} bank={bank} onMoney={setMoney} onBank={setBank} />
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
