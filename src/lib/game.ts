// Money is scarce: every crime payout (and fine) is multiplied by this.
export const MONEY_SCALE = 0.1;

// Energy: 10 points every 40 seconds, so one point every 4 seconds.
export const ENERGY_REGEN_MS = 4_000;
// Job costs are written in energy points; one "unit" of effort is 10 points.
export const ENERGY_UNIT = 10;

// Everyone starts with 400 energy, and every rank adds 50 more.
export function maxEnergyFor(rankLevel: number): number {
  return 400 + Math.max(0, rankLevel - 1) * 50;
}

// Each job has its own cooldown. Bigger jobs take longer to recover from.
export function crimeCooldownSeconds(energyCost: number): number {
  return 10 + (energyCost / ENERGY_UNIT) * 10;
}

export type CrimeScene = {
  title: string;
  setup: string;
  win: string;
  messy: string;
  fail: string;
  risk: number; // added to the success chance (negative = harder)
  pay: number; // payout multiplier for this scene
};

export type CrimeDef = {
  id: string;
  name: string;
  description: string;
  energyCost: number;
  minRankLevel: number;
  baseSuccess: number;
  minCash: number;
  maxCash: number;
  xpSuccess: number;
  xpFail: number;
  heat: number;
  scenes: CrimeScene[];
};

export const CRIMES: CrimeDef[] = [
  {
    id: "pickpocket",
    name: "Pickpocket",
    description: "Lift a wallet from a distracted mark in the crowd.",
    energyCost: 10,
    minRankLevel: 1,
    baseSuccess: 0.82,
    minCash: 25,
    maxCash: 70,
    xpSuccess: 5,
    xpFail: 1,
    heat: 1,
    scenes: [
      {
        title: "A tourist with a map at King's Cross",
        setup: "A tourist squints at a map outside King's Cross, handbag swinging open.",
        win: "You bump her, apologise, and the purse is already up your sleeve.",
        messy: "The clasp snags. You tear the purse free, but coins scatter and you keep only a handful.",
        fail: "A porter shouts and points your way.",
        risk: 0.04,
        pay: 0.9
      },
      {
        title: "A drunk outside the Rose & Crown",
        setup: "A drunk sways outside the Rose & Crown, a week's wages bulging in his coat.",
        win: "You prop him up like an old friend and lift the lot.",
        messy: "He lurches and half the notes flutter into the gutter. You grab what you can.",
        fail: "He swings round, suddenly sober.",
        risk: 0.06,
        pay: 0.85
      },
      {
        title: "A banker on the platform at Victoria",
        setup: "A man in a bowler hat is buried in his newspaper on the platform at Victoria.",
        win: "A tap on the shoulder, a mumbled sorry, and his wallet is yours.",
        messy: "His watch chain snaps. You get the wallet, but the watch falls onto the tracks.",
        fail: "A guard blows his whistle and heads your way.",
        risk: -0.05,
        pay: 1.35
      }
    ]
  },
  {
    id: "street_robbery",
    name: "Street Robbery",
    description: "A quick stick-up on a quiet side street. Fast money, some risk.",
    energyCost: 10,
    minRankLevel: 1,
    baseSuccess: 0.72,
    minCash: 80,
    maxCash: 200,
    xpSuccess: 10,
    xpFail: 2,
    heat: 2,
    scenes: [
      {
        title: "A gambler leaving the betting shop",
        setup: "A gambler steps out of the betting shop, whistling, pockets heavy with winnings.",
        win: "One look at the cosh and he empties his pockets without a word.",
        messy: "He fights back. You get his winnings, but a few notes are lost in the scuffle.",
        fail: "He bellows for help and a crowd turns the corner.",
        risk: 0.03,
        pay: 0.9
      },
      {
        title: "A clerk with the day's takings",
        setup: "A clerk hurries home through the back streets, clutching a leather satchel.",
        win: "You step from the doorway; he hands over the satchel and runs.",
        messy: "The satchel splits as you wrestle it. Notes fly everywhere; you grab a fistful.",
        fail: "A constable's whistle rings out two streets away.",
        risk: 0,
        pay: 1
      },
      {
        title: "A swell leaving a Soho club",
        setup: "A well-dressed swell stumbles out of a Soho club with a roll of notes in his pocket.",
        win: "He's too drunk to argue. His roll and his cufflinks are yours.",
        messy: "His chauffeur appears, but you take the roll and run before he can act.",
        fail: "His chauffeur steps out of the car, built like a wardrobe.",
        risk: -0.06,
        pay: 1.35
      }
    ]
  },
  {
    id: "shop_job",
    name: "Shop Job",
    description: "Hit a small corner store after hours. Better pay, tighter window.",
    energyCost: 20,
    minRankLevel: 2,
    baseSuccess: 0.65,
    minCash: 180,
    maxCash: 420,
    xpSuccess: 28,
    xpFail: 4,
    heat: 3,
    scenes: [
      {
        title: "A grocer's after closing",
        setup: "The grocer has locked up for the night, but the till is still full.",
        win: "A quick lever on the back window and the till is empty before you count to a hundred.",
        messy: "The window slams on your sleeve. You get the till but leave a scrap of cloth behind.",
        fail: "A dog starts barking in the yard behind.",
        risk: 0.05,
        pay: 0.9
      },
      {
        title: "A tobacconist on Cable Street",
        setup: "A tobacconist's shutters are down, but the lock is old and the stock is worth a fortune.",
        win: "The lock gives with a click. Cigarettes and cash, bagged up and gone.",
        messy: "You set off the bell. You grab half the stock and run.",
        fail: "Lights flicker on in the flat above the shop.",
        risk: 0,
        pay: 1
      },
      {
        title: "A pawnbroker with a safe in the back",
        setup: "The pawnbroker's safe is old and heavy, and he always forgets to set the alarm.",
        win: "You crack it and walk out with the best tickets in the shop.",
        messy: "The safe door jams. You take what you can reach and leave the rest.",
        fail: "A night watchman rattles the front door.",
        risk: -0.06,
        pay: 1.35
      }
    ]
  },
  {
    id: "car_breakin",
    name: "Car Break-In",
    description: "Pop a parked motor and see what the owner left behind.",
    energyCost: 20,
    minRankLevel: 3,
    baseSuccess: 0.62,
    minCash: 260,
    maxCash: 600,
    xpSuccess: 36,
    xpFail: 6,
    heat: 3,
    scenes: [
      {
        title: "A Morris outside the theatre",
        setup: "A Morris is parked outside the theatre, a coat and a cigar case on the back seat.",
        win: "One quick wrist, a gloved hand, and the coat and cigar case are yours.",
        messy: "The window cracks loudly. You snatch the coat and run before anyone turns.",
        fail: "A doorman glances down the street.",
        risk: 0.05,
        pay: 0.9
      },
      {
        title: "A doctor's Austin in a quiet mews",
        setup: "A doctor's Austin sits in a quiet mews, his black bag visible on the seat.",
        win: "The bag opens to cash, a gold watch, and a very fine pair of cufflinks.",
        messy: "A bell rattles on the dashboard. You grab the bag and go.",
        fail: "A curtain twitches in the window opposite.",
        risk: 0,
        pay: 1
      },
      {
        title: "A Rolls-Royce outside the Savoy",
        setup: "A Rolls-Royce waits outside the Savoy, its driver gone for a smoke.",
        win: "The glove box holds a fat envelope. You're away before he lights his second cigarette.",
        messy: "The driver returns early. You get the envelope but lose your cap.",
        fail: "The driver strolls back with a constable at his side.",
        risk: -0.07,
        pay: 1.5
      }
    ]
  },
  {
    id: "warehouse",
    name: "Warehouse Score",
    description: "Break into a goods warehouse on the docks. Serious cash if you get clean.",
    energyCost: 30,
    minRankLevel: 4,
    baseSuccess: 0.55,
    minCash: 400,
    maxCash: 950,
    xpSuccess: 44,
    xpFail: 8,
    heat: 5,
    scenes: [
      {
        title: "A tea warehouse on the docks",
        setup: "Tea chests are stacked to the roof in a Wapping warehouse, and the watchman likes his pint.",
        win: "You wheel the best chests out the back and sell them before dawn.",
        messy: "A chest splits open and the smell gives you away. You get half the haul clear.",
        fail: "The watchman's pint is shorter than usual tonight.",
        risk: 0.04,
        pay: 0.9
      },
      {
        title: "A tobacco store in Bermondsey",
        setup: "A bonded store in Bermondsey holds more tobacco than anyone will ever count.",
        win: "You load the van in silence and drive off with the lot.",
        messy: "The van's engine coughs loudly. You leave a third of the load behind.",
        fail: "A lamp swings across the yard.",
        risk: 0,
        pay: 1
      },
      {
        title: "A clothing wholesaler by the canal",
        setup: "A wholesaler by the canal keeps the week's takings in an office above the stockroom.",
        win: "The office door yields. The takings and a few good coats are yours.",
        messy: "The stairs creak. You take the cash tin and skip the coats.",
        fail: "Someone is whistling in the yard below.",
        risk: -0.06,
        pay: 1.35
      }
    ]
  },
  {
    id: "pub_shakedown",
    name: "Pub Shakedown",
    description: "Lean on a landlord who'd rather not see the law.",
    energyCost: 30,
    minRankLevel: 5,
    baseSuccess: 0.56,
    minCash: 600,
    maxCash: 1300,
    xpSuccess: 48,
    xpFail: 9,
    heat: 5,
    scenes: [
      {
        title: "The Crown & Anchor's landlord",
        setup: "The landlord of the Crown & Anchor has been watering the beer and thinks nobody knows.",
        win: "A quiet word and a gentle reminder, and he pays what he owes plus a bit extra.",
        messy: "He pays, but spills half the sum across the bar before you can count it.",
        fail: "He reaches under the bar for something heavy.",
        risk: 0.03,
        pay: 0.9
      },
      {
        title: "An unlicensed drinking den",
        setup: "A back-room drinking den off the Commercial Road is doing a roaring trade without a licence.",
        win: "You mention the police, he mentions a fee, and you both smile.",
        messy: "He pays, but his heavies see you out with a few bruises.",
        fail: "His doorman recognises your face.",
        risk: 0,
        pay: 1
      },
      {
        title: "A bookmaker's runner",
        setup: "A bookmaker's runner is collecting bets across three pubs, carrying a thick wallet.",
        win: "You offer protection for a fee, and he's glad to be protected.",
        messy: "He says yes, then 'forgets' half the money in the next pub.",
        fail: "He's brought two friends who don't look friendly.",
        risk: -0.06,
        pay: 1.35
      }
    ]
  },
  {
    id: "lorry_hijack",
    name: "Lorry Hijack",
    description: "Stop a delivery lorry and drive off with the cargo.",
    energyCost: 30,
    minRankLevel: 6,
    baseSuccess: 0.52,
    minCash: 750,
    maxCash: 1700,
    xpSuccess: 52,
    xpFail: 11,
    heat: 6,
    scenes: [
      {
        title: "A brewery lorry on the Old Kent Road",
        setup: "A brewery lorry rumbles up the Old Kent Road, barrels roped high on the back.",
        win: "You flag it down with a badge and a smile. The driver wisely keeps walking.",
        messy: "The driver bolts and the barrels shift. You get the lorry but lose some cargo.",
        fail: "A policeman steps out in the lane ahead.",
        risk: 0.03,
        pay: 0.9
      },
      {
        title: "A cigarette delivery at dawn",
        setup: "A cigarette lorry crawls through the dawn mist with a lone driver at the wheel.",
        win: "The lorry vanishes into a lock-up with its cargo untouched.",
        messy: "A back tyre bursts on the way. You unload half the cargo to a pal.",
        fail: "The driver spots your headlights in his mirror.",
        risk: 0,
        pay: 1
      },
      {
        title: "A cloth lorry on a country road",
        setup: "A cloth lorry heads north on a lonely country road, the driver singing to himself.",
        win: "A fallen branch stops him, and the rest is simple.",
        messy: "He fights back and you lose a couple of rolls in the ditch.",
        fail: "A farm lad on a bicycle sees everything.",
        risk: -0.06,
        pay: 1.4
      }
    ]
  },
  {
    id: "armoured",
    name: "Armoured Van",
    description: "Intercept a cash run. High reward, high chance of heat.",
    energyCost: 40,
    minRankLevel: 7,
    baseSuccess: 0.46,
    minCash: 1100,
    maxCash: 2600,
    xpSuccess: 51,
    xpFail: 13,
    heat: 8,
    scenes: [
      {
        title: "The payroll van outside the mill",
        setup: "A payroll van idles outside the mill at the end of the week.",
        win: "Smoke across the road, a quick shot at the lock, and the van is yours.",
        messy: "Gunfire echoes. You drag out two bags and leave the rest.",
        fail: "The guards are quicker than expected.",
        risk: 0.03,
        pay: 0.9
      },
      {
        title: "A bank run through narrow streets",
        setup: "A bank van crawls through narrow streets, guards peering out of the slit.",
        win: "A cart across the lane stops it dead, and the bags are yours.",
        messy: "The back door jams. You pry it open, but the bags take a beating.",
        fail: "An alarm starts ringing.",
        risk: 0,
        pay: 1
      },
      {
        title: "The racecourse takings van",
        setup: "The racecourse takings van heads out after the last race, loaded with cash.",
        win: "Crowds, confusion, and a van with an open door. You walk away rich.",
        messy: "A flying bottle breaks your plan. You grab a few bags and bolt.",
        fail: "A mounted policeman is watching the gate.",
        risk: -0.06,
        pay: 1.4
      }
    ]
  },
  {
    id: "jewellery",
    name: "Jewellery Heist",
    description: "Diamonds, pearls and a very quiet exit.",
    energyCost: 40,
    minRankLevel: 8,
    baseSuccess: 0.44,
    minCash: 2200,
    maxCash: 4800,
    xpSuccess: 56,
    xpFail: 14,
    heat: 10,
    scenes: [
      {
        title: "A Hatton Garden shop at midnight",
        setup: "A shop in Hatton Garden has a new safe and an old lock.",
        win: "The safe opens and the velvet trays are all yours.",
        messy: "A tray hits the floor and stones spill. You collect what you can in the dark.",
        fail: "A beat copper tests the shop door.",
        risk: 0.03,
        pay: 0.9
      },
      {
        title: "A society lady's townhouse",
        setup: "A society lady is dining out; her townhouse and her pearls sit unguarded.",
        win: "The pearls slip into your pocket like they were always yours.",
        messy: "The maid returns early. You take a bracelet and a brooch and slip out.",
        fail: "A bell rings in the servants' hall.",
        risk: 0,
        pay: 1
      },
      {
        title: "A diamond dealer's hotel room",
        setup: "A travelling diamond dealer keeps a locked case under his bed in a Mayfair hotel.",
        win: "The case clicks open. You walk past the night porter with a smile.",
        messy: "You drop a stone on the stairs and scramble for it.",
        fail: "The night porter is watching you now.",
        risk: -0.06,
        pay: 1.4
      }
    ]
  },
  {
    id: "dockside_run",
    name: "Dockside Smuggling Run",
    description: "Move contraband past the customs men.",
    energyCost: 40,
    minRankLevel: 9,
    baseSuccess: 0.42,
    minCash: 3500,
    maxCash: 7500,
    xpSuccess: 60,
    xpFail: 15,
    heat: 11,
    scenes: [
      {
        title: "Contraband rum off a coaster at Wapping",
        setup: "A coaster at Wapping is unloading rum under a false bill of lading.",
        win: "The customs man looks the other way, and the crates vanish before sunrise.",
        messy: "A crate falls and shatters. You rush the rest through the shed.",
        fail: "A customs launch cuts across the water.",
        risk: 0.03,
        pay: 0.9
      },
      {
        title: "Whisky through the customs shed",
        setup: "A customs shed holds a hundred crates of whisky waiting to be 'inspected'.",
        win: "Papers stamped, crates lifted, everyone paid.",
        messy: "A clerk asks for more money, and your margin takes a hit.",
        fail: "A new inspector appears from nowhere.",
        risk: 0,
        pay: 1
      },
      {
        title: "A night ferry with a false hold",
        setup: "A night ferry has a false hold the customs men have never found.",
        win: "The ferry docks, the hold opens, and the haul is yours.",
        messy: "A rope snaps. Some cargo hits the water; you save most of it.",
        fail: "A searchlight sweeps the quay.",
        risk: -0.06,
        pay: 1.4
      }
    ]
  },
  {
    id: "bank_job",
    name: "Bank Job",
    description: "Vaults, tunnels and a getaway car with the engine running.",
    energyCost: 50,
    minRankLevel: 10,
    baseSuccess: 0.4,
    minCash: 5500,
    maxCash: 12000,
    xpSuccess: 64,
    xpFail: 16,
    heat: 13,
    scenes: [
      {
        title: "A provincial branch with a weak lock",
        setup: "A small-town branch has a famously weak lock and a manager who sleeps heavily.",
        win: "The vault door swings open. By dawn you're two counties away.",
        messy: "The vault door sticks. You empty one drawer and leave the rest.",
        fail: "A night watchman checks his round early.",
        risk: 0.03,
        pay: 0.9
      },
      {
        title: "A vault beneath a merchant bank",
        setup: "A merchant bank in the City keeps its vault below a respectable shop.",
        win: "You tunnel up into the vault and fill your bags with banknotes.",
        messy: "The tunnel floods. You grab what you can and wade out.",
        fail: "A murmur of voices drifts through the wall.",
        risk: 0,
        pay: 1
      },
      {
        title: "The Saturday cash delivery",
        setup: "A bank takes its Saturday delivery by van, with a guard and a driver.",
        win: "The van is emptied and you're on your way before the guard stops talking.",
        messy: "The guard fires a shot into the air. You grab one bag and run.",
        fail: "A police car happens to be parked nearby.",
        risk: -0.06,
        pay: 1.4
      }
    ]
  },
  {
    id: "train_robbery",
    name: "Train Robbery",
    description: "Stop a train in the dark and take what's in the van.",
    energyCost: 50,
    minRankLevel: 11,
    baseSuccess: 0.38,
    minCash: 9000,
    maxCash: 19000,
    xpSuccess: 68,
    xpFail: 17,
    heat: 15,
    scenes: [
      {
        title: "The night mail train",
        setup: "The night mail train thunders north with sacks of banknotes in the guard's van.",
        win: "A signal turns red, the guard is tied up, and the sacks go out the door.",
        messy: "The train lurches. You throw out half the sacks and jump after them.",
        fail: "A second guard wakes in the next carriage.",
        risk: 0.03,
        pay: 0.9
      },
      {
        title: "A payroll carriage out of Euston",
        setup: "A payroll carriage leaves Euston with a mountain of wage packets.",
        win: "The coupling slips and the carriage rolls into a siding, quiet as you like.",
        messy: "A coupling jams and the carriage stops short. You carry off what you can.",
        fail: "A signalman picks up his telephone.",
        risk: 0,
        pay: 1
      },
      {
        title: "The boat train's bullion carriage",
        setup: "The boat train carries a bullion carriage, locked and lightly guarded.",
        win: "The padlock gives and the bars are yours.",
        messy: "The train brakes hard. A bar drops to the tracks and you have to leave it.",
        fail: "A steward is moving through the train.",
        risk: -0.06,
        pay: 1.4
      }
    ]
  },
  {
    id: "casino_heist",
    name: "Casino Heist",
    description: "Where the money flows, so can you.",
    energyCost: 60,
    minRankLevel: 12,
    baseSuccess: 0.36,
    minCash: 14000,
    maxCash: 31000,
    xpSuccess: 72,
    xpFail: 18,
    heat: 17,
    scenes: [
      {
        title: "A Mayfair gaming club",
        setup: "A Mayfair gaming club is packed, and the cashier's cage is overflowing.",
        win: "A well-timed fire alarm clears the room, and the cage door opens.",
        messy: "The crowd surges back sooner than planned. You grab what you can.",
        fail: "The doorman counts the chips twice.",
        risk: 0.03,
        pay: 0.9
      },
      {
        title: "A floating casino on the Thames",
        setup: "A floating casino on the Thames keeps a week's takings in a locked cabin.",
        win: "A rowing boat, a ladder, a gentle word with the cabin lock. All done.",
        messy: "The boat rocks and some cash lands in the river.",
        fail: "A lantern appears on the upper deck.",
        risk: 0,
        pay: 1
      },
      {
        title: "An aristocrats' private card game",
        setup: "A private card game in a country house is being played for silly stakes.",
        win: "You slip a card, take the pot, and leave before anyone checks.",
        messy: "A wrong card turns over and you run with half the pot.",
        fail: "A duke leans across the table, squinting at you.",
        risk: -0.06,
        pay: 1.4
      }
    ]
  },
  {
    id: "bullion_heist",
    name: "Gold Bullion Heist",
    description: "The biggest score in Britain. Don't get greedy.",
    energyCost: 60,
    minRankLevel: 13,
    baseSuccess: 0.33,
    minCash: 22000,
    maxCash: 50000,
    xpSuccess: 78,
    xpFail: 19,
    heat: 20,
    scenes: [
      {
        title: "A bullion convoy bound for the Bank",
        setup: "A bullion convoy, escorted and armoured, rolls through the City at dawn.",
        win: "A blocked road, a swapped van, and a fortune in gold.",
        messy: "A guard fires back. You take a single crate and vanish.",
        fail: "The police escort is two minutes early.",
        risk: 0.03,
        pay: 0.9
      },
      {
        title: "A private vault in the City",
        setup: "A private vault under a City firm holds a dead millionaire's gold.",
        win: "The combination was in the will. The gold is out in a day.",
        messy: "The floor gives way. You carry out what you can lift.",
        fail: "A cleaner arrives early.",
        risk: 0,
        pay: 1
      },
      {
        title: "A gold shipment at the docks",
        setup: "A gold shipment sits on the quay, waiting for a ship that hasn't arrived.",
        win: "The crates are marked and moved before the ship appears.",
        messy: "A crane swings the wrong way and one crate slides into the Thames.",
        fail: "A harbour launch begins to circle.",
        risk: -0.06,
        pay: 1.4
      }
    ]
  }
];

export type CrimeTier =
  | "perfect"
  | "clean"
  | "messy"
  | "backed_off"
  | "got_away"
  | "caught";

export type CrimeOutcome = {
  success: boolean;
  tier: CrimeTier;
  label: string;
  cash: number; // payout (0 when the crime fails)
  xp: number;
  heat: number;
  sceneTitle: string;
  setup: string;
  result: string;
  streakBonus: number;
};

export const MAX_STREAK = 5;
const STREAK_STEP = 0.04; // +4% payout per consecutive success
const PERFECT_CHANCE = 0.07;
const MESSY_CHANCE = 0.2;
const CAUGHT_SHARE = 0.35; // share of failures that are "caught"
const BACKED_OFF_SHARE = 0.25; // share of failures where you bail out

const PERFECT_LINES = [
  "Perfect score. Not a single thing went wrong, and there's a bonus on top.",
  "Flawless. You walk away with more than you dreamed of.",
  "A perfect job. They'll be talking about this one in the pubs."
];

const BACKED_OFF_LINES = [
  "You called it off and slipped away.",
  "Your nerve went and you walked away."
];

const GOT_AWAY_LINES = [
  "You ran for it and got clear with nothing.",
  "You scrambled over a wall and lost them in the back streets."
];

export function streakBonusFor(streak: number) {
  return Math.min(MAX_STREAK, Math.max(0, streak)) * STREAK_STEP;
}

// Logs must be newest first. Counts consecutive successes, up to MAX_STREAK.
export function streakFromLogs(logs: { success: boolean }[]) {
  let streak = 0;

  for (const log of logs) {
    if (!log.success || streak >= MAX_STREAK) break;
    streak++;
  }

  return streak;
}

export function levelsAbove(crime: CrimeDef, rankLevel: number) {
  return Math.max(0, rankLevel - crime.minRankLevel);
}

export function successChance(
  crime: CrimeDef,
  rankLevel: number,
  risk = 0
) {
  return Math.max(
    0.15,
    Math.min(
      0.92,
      crime.baseSuccess + risk + levelsAbove(crime, rankLevel) * 0.015
    )
  );
}

export function payScale(crime: CrimeDef, rankLevel: number) {
  return 1 + Math.min(0.3, levelsAbove(crime, rankLevel) * 0.03);
}

export function xpScale(crime: CrimeDef, rankLevel: number) {
  return Math.max(0.35, 1 - levelsAbove(crime, rankLevel) * 0.12);
}

export function crimePayRange(crime: CrimeDef, rankLevel: number) {
  const scale = payScale(crime, rankLevel);

  return {
    min: Math.max(1, Math.round(crime.minCash * scale * MONEY_SCALE)),
    max: Math.max(1, Math.round(crime.maxCash * scale * MONEY_SCALE))
  };
}

function pick<T>(items: T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)];
}

function tidy(amount: number) {
  return amount >= 100 ? Math.round(amount / 5) * 5 : Math.round(amount);
}

export function playCrime(
  crime: CrimeDef,
  rankLevel: number,
  streak: number,
  cashOnHand: number,
  rng: () => number = Math.random
): CrimeOutcome {
  const scene = pick(crime.scenes, rng);
  const chance = successChance(crime, rankLevel, scene.risk);
  const xpFactor = xpScale(crime, rankLevel);
  const streakBonus = streakBonusFor(streak);

  const base = {
    heat: crime.heat,
    sceneTitle: scene.title,
    setup: scene.setup,
    streakBonus
  };

  if (rng() < chance) {
    const roll = rng();
    const tier: CrimeTier =
      roll < PERFECT_CHANCE
        ? "perfect"
        : roll < PERFECT_CHANCE + MESSY_CHANCE
          ? "messy"
          : "clean";

    const tierPay = tier === "perfect" ? 2 : tier === "messy" ? 0.55 : 1;
    const tierXp = tier === "perfect" ? 1.5 : tier === "messy" ? 0.75 : 1;

    // Average of two rolls makes middling payouts the most common.
    const spread = (rng() + rng()) / 2;
    const raw =
      (crime.minCash + spread * (crime.maxCash - crime.minCash)) *
      scene.pay *
      payScale(crime, rankLevel) *
      MONEY_SCALE *
      tierPay *
      (1 + streakBonus);

    const result =
      tier === "perfect"
        ? `${scene.win} ${pick(PERFECT_LINES, rng)}`
        : tier === "messy"
          ? scene.messy
          : scene.win;

    return {
      ...base,
      success: true,
      tier,
      label:
        tier === "perfect"
          ? "Perfect score"
          : tier === "messy"
            ? "Messy score"
            : "Clean job",
      cash: Math.max(1, tidy(raw)),
      xp: Math.max(1, Math.round(crime.xpSuccess * tierXp * xpFactor)),
      result
    };
  }

  const xp = Math.max(1, Math.round(crime.xpFail * xpFactor));
  const roll = rng();

  if (roll < BACKED_OFF_SHARE) {
    return {
      ...base,
      success: false,
      tier: "backed_off",
      label: "Backed off",
      cash: 0,
      xp,
      result: `${scene.fail} ${pick(BACKED_OFF_LINES, rng)}`
    };
  }

  if (roll > 1 - CAUGHT_SHARE) {
    return {
      ...base,
      success: false,
      tier: "caught",
      label: "Caught",
      cash: 0,
      xp,
      result: `${scene.fail} The law caught up with you.`
    };
  }

  return {
    ...base,
    success: false,
    tier: "got_away",
    label: "Got away",
    cash: 0,
    xp,
    result: `${scene.fail} ${pick(GOT_AWAY_LINES, rng)}`
  };
}

export function energyAfterRegen(
  current: number,
  maximum: number,
  lastAt: Date,
  now = new Date()
) {
  const intervals = Math.floor(
    (now.getTime() - lastAt.getTime()) / ENERGY_REGEN_MS
  );

  const gained = Math.min(
    maximum - current,
    Math.max(0, intervals)
  );

  return {
    energy: current + gained,
    lastEnergyAt:
      gained > 0
        ? new Date(lastAt.getTime() + gained * ENERGY_REGEN_MS)
        : lastAt
  };
}

export function rollCrime(crime: CrimeDef, rankLevel: number) {
  const successChance = Math.min(
    0.92,
    crime.baseSuccess + Math.max(0, rankLevel - crime.minRankLevel) * 0.015
  );

  const success = Math.random() < successChance;
  const cash = success
    ? Math.max(
        1,
        Math.round(
          (crime.minCash +
            Math.floor(Math.random() * (crime.maxCash - crime.minCash + 1))) *
            MONEY_SCALE
        )
      )
    : 0;

  return {
    success,
    cash,
    xp: success ? crime.xpSuccess : crime.xpFail,
    heat: success ? crime.heat : Math.ceil(crime.heat / 2)
  };
}

// Levels 1-5 are quick so new players feel progress straight away.
// After that every level costs LEVEL_GAP_GROWTH times the previous one, so the
// top ranks take weeks of play and need XP from every activity, not just crimes.
export const MAX_LEVEL = 13;
const FAST_LEVELS = 5;
const LEVEL_GAP_GROWTH = 1.8;

// Ranks are slow to earn: every level needs three times the XP it used to.
const XP_SLOWDOWN = 3;

export function xpForLevel(level: number): number {
  return Math.floor(baseXpForLevel(level) * XP_SLOWDOWN);
}

function baseXpForLevel(level: number): number {
  if (level <= 1) return 0;

  const capped = Math.min(level, MAX_LEVEL);

  if (capped <= FAST_LEVELS) {
    return Math.floor(40 * capped * (capped - 1) * 0.7);
  }

  let total = Math.floor(40 * FAST_LEVELS * (FAST_LEVELS - 1) * 0.7);
  let gap = 56 * FAST_LEVELS;

  for (let l = FAST_LEVELS + 1; l <= capped; l++) {
    total += gap;
    gap = Math.round(gap * LEVEL_GAP_GROWTH);
  }

  return total;
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) {
    level++;
  }
  return level;
}
