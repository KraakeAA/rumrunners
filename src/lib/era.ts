// Period detail for Rumrunners: Britain, 1933. Pure data, safe for server and browser.
// Speeds and boot sizes are game ratings loosely based on period figures,
// not exact specifications. One crate = one case of spirits.

export type CarModel = {
  key: string;
  name: string;
  maker: string;
  year: string; // years on sale
  speed: number; // top speed in mph
  boot: number; // crates of spirits it can carry
  price: number; // what it is worth, £
  minutes: number; // wait before you can travel again after driving it
  tier: 1 | 2 | 3 | 4; // how hard it is to steal (4 = hardest)
  scrap: number; // bullets from melting it down (worked out from scrapPct)
  scrapPct?: number; // percent of the car's price given as bullets when melted
  note: string;
};

const CAR_DATA: (Omit<CarModel, "scrap"> & { scrapPct: number })[] = [
  { key: "austin_seven", name: "Austin Seven", maker: "Austin", year: "1922-39", speed: 50, boot: 3, price: 150, minutes: 60, tier: 1, scrapPct: 5, note: "Britain's people's car. Slow, tiny and everywhere." },
  { key: "ford_model_y", name: "Ford Model Y", maker: "Ford (Dagenham)", year: "1932-37", speed: 58, boot: 5, price: 250, minutes: 55, tier: 1, scrapPct: 5, note: "Cheap, tidy and built in England." },
  { key: "morris_eight", name: "Morris Eight", maker: "Morris", year: "1935-39", speed: 60, boot: 6, price: 350, minutes: 50, tier: 1, scrapPct: 5, note: "The family saloon nobody looks at twice." },
  { key: "morris_commercial_van", name: "Morris-Commercial Van", maker: "Morris-Commercial", year: "1924-39", speed: 45, boot: 18, price: 550, minutes: 60, tier: 1, scrapPct: 5, note: "A baker's van with a false floor." },
  { key: "wolseley_hornet", name: "Wolseley Hornet", maker: "Wolseley", year: "1930-36", speed: 68, boot: 4, price: 600, minutes: 45, tier: 2, scrapPct: 5.5, note: "A small six that punches above its weight." },
  { key: "riley_nine", name: "Riley Nine", maker: "Riley", year: "1926-38", speed: 70, boot: 5, price: 700, minutes: 42, tier: 2, scrapPct: 5.5, note: "Light, quick and handles beautifully." },
  { key: "bedford_wlg", name: "Bedford WLG Lorry", maker: "Bedford (Vauxhall)", year: "1931-39", speed: 38, boot: 40, price: 900, minutes: 60, tier: 2, scrapPct: 5.5, note: "Two tons of crates. Not built for getting away." },
  { key: "ss1", name: "SS1 Coupé", maker: "SS Cars (Swallow)", year: "1932-36", speed: 75, boot: 2, price: 1_200, minutes: 35, tier: 3, scrapPct: 6, note: "Long, low and flashy. Hardly any room for cargo." },
  { key: "humber_snipe", name: "Humber Snipe", maker: "Humber", year: "1930-39", speed: 75, boot: 12, price: 1_400, minutes: 38, tier: 3, scrapPct: 6, note: "Big, solid saloon favoured by the well-to-do." },
  { key: "ford_v8", name: "Ford V8 Saloon", maker: "Ford", year: "1932-39", speed: 80, boot: 10, price: 1_800, minutes: 32, tier: 3, scrapPct: 6, note: "The fast, roomy car the gangs on both sides of the Atlantic love." },
  { key: "bentley_35", name: "Bentley 3½ Litre", maker: "Bentley (Rolls-Royce)", year: "1933-39", speed: 90, boot: 6, price: 6_000, minutes: 25, tier: 4, scrapPct: 6.5, note: "The Silent Sports Car. Quick and quiet." },
  { key: "bentley_blower", name: "Bentley 4½ Litre Supercharged", maker: "Bentley", year: "1929-31", speed: 100, boot: 3, price: 8_000, minutes: 20, tier: 4, scrapPct: 6.5, note: "The Blower. Fastest thing on the road, with room for little else." },
  { key: "rolls_phantom_ii", name: "Rolls-Royce Phantom II", maker: "Rolls-Royce", year: "1929-35", speed: 90, boot: 16, price: 12_000, minutes: 28, tier: 4, scrapPct: 6.5, note: "Fast, enormous and nobody dares stop it." }
];

// Melting a car gives a percentage of what it is worth in bullets, so cheap cars
// give very few and the best give more. Never fewer than 7.
export const MIN_SCRAP = 7;
export const CARS: CarModel[] = CAR_DATA.map((c) => ({
  ...c,
  scrap: Math.max(MIN_SCRAP, Math.floor((c.price * c.scrapPct) / 100))
}));

// Bullets a car gives when melted: its full amount if undamaged, less the more
// it is knocked about (damage runs 0 to 50, so a wreck gives about half). Never under 7.
export function scrapFor(car: CarModel, damage: number): number {
  const d = Math.max(0, Math.min(100, damage));
  return Math.max(MIN_SCRAP, Math.floor((car.scrap * (100 - d)) / 100));
}

export function carModel(key: string): CarModel | undefined {
  return CARS.find((c) => c.key === key);
}

// Travel is by railway only and is instant; after a journey you must wait
// RAIL_MINUTES before travelling again. Cars are never driven: they are kept
// in the garage and melted down for bullets (or used by a driver in a crew job).
export const RAIL_MINUTES = 60;
export const BASE_GARAGE_SLOTS = 5;

export function travelMinutes(car: CarModel | undefined): number {
  return car ? car.minutes : RAIL_MINUTES;
}

// Heat: how much the police want a car.
export const MAX_HEAT = 100;
// Heat only ever rises with time. From green it reaches amber after one day and red after
// three days. (Plating resets a car to green; shipping a car back to where it was stolen
// makes it red at once.)
export const AMBER_AFTER_MINUTES = 24 * 60;
export const RED_AFTER_MINUTES = 3 * 24 * 60;
const AMBER_AT = 34;
const RED_AT = 67;

function heatToMinutes(heat: number): number {
  if (heat <= 0) return 0;
  if (heat < AMBER_AT) return (heat / AMBER_AT) * AMBER_AFTER_MINUTES;
  if (heat < RED_AT) {
    return AMBER_AFTER_MINUTES + ((heat - AMBER_AT) / (RED_AT - AMBER_AT)) * (RED_AFTER_MINUTES - AMBER_AFTER_MINUTES);
  }
  return RED_AFTER_MINUTES + ((heat - RED_AT) / (MAX_HEAT - RED_AT)) * (RED_AFTER_MINUTES - AMBER_AFTER_MINUTES);
}
function minutesToHeat(m: number): number {
  if (m <= 0) return 0;
  if (m < AMBER_AFTER_MINUTES) return (m / AMBER_AFTER_MINUTES) * AMBER_AT;
  if (m < RED_AFTER_MINUTES) {
    return AMBER_AT + ((m - AMBER_AFTER_MINUTES) / (RED_AFTER_MINUTES - AMBER_AFTER_MINUTES)) * (RED_AT - AMBER_AT);
  }
  return Math.min(
    MAX_HEAT,
    RED_AT + ((m - RED_AFTER_MINUTES) / (RED_AFTER_MINUTES - AMBER_AFTER_MINUTES)) * (MAX_HEAT - RED_AT)
  );
}

export function currentHeat(heat: number, heatAt: Date | string, now = Date.now()): number {
  const elapsed = Math.max(0, (now - new Date(heatAt).getTime()) / 60_000);
  return Math.round(minutesToHeat(heatToMinutes(heat) + elapsed));
}

// Three heat zones: green is quiet, amber is watched, red is hunted.
export type HeatZone = "green" | "amber" | "red";
export function heatZone(heat: number): HeatZone {
  return heat >= 67 ? "red" : heat >= 34 ? "amber" : "green";
}
export const STOLEN_HEAT = 100; // every stolen car starts red
export const EXPOSURE_MINUTES = 5; // how long a car can sit on its original plates
export const SWEEP_MINUTES = 120; // police check the streets this often
export const MAX_SWEEPS = 100;
export const HEAT_RULES_FROM = Date.parse("2026-11-28T00:00:00Z"); // cars older than this keep the old rules

// Chance per police check that a car is found. Shipped cars are harder to trace.
export function sweepChance(heat: number, shipped: boolean): number {
  const z = heatZone(heat);
  const base = z === "red" ? 0.12 : z === "amber" ? 0.05 : 0;
  return shipped ? base / 2 : base;
}

// Auto theft: four levels unlocked by rank. The better the level, the better the cars,
// and the special cars of level 4 are only for the top rank.
export type TheftLevel = {
  level: 1 | 2 | 3 | 4;
  name: string;
  minRank: number;
  blurb: string;
  energy: number;
  baseChance: number; // chance at the rank that unlocks the level
  weights: [number, number, number, number]; // how often tier 1..4 cars turn up
  xp: number; // XP for a successful theft (plus a little more for harder cars)
  fine: number; // paid if you are caught
  heat: [number, number, number, number]; // heat on a stolen car by tier
};

export const GODFATHER_RANK = 13; // top rank: Legendary Crime Baron

export const THEFT_LEVELS: TheftLevel[] = [
  { level: 1, name: "Back-Street Opportunist", minRank: 3, blurb: "Try the doors of motors left on the street.", energy: 20, baseChance: 0.3, weights: [75, 22, 3, 0], xp: 14, fine: 3, heat: [25, 35, 50, 65] },
  { level: 2, name: "Hot-Wire Job", minRank: 5, blurb: "Work the ignition on cars parked outside pubs and shops.", energy: 30, baseChance: 0.25, weights: [40, 42, 18, 0], xp: 30, fine: 8, heat: [30, 40, 55, 70] },
  { level: 3, name: "Garage Break-In", minRank: 7, blurb: "Break into lock-ups and private garages after dark.", energy: 40, baseChance: 0.2, weights: [15, 40, 45, 0], xp: 52, fine: 20, heat: [35, 45, 60, 75] },
  { level: 4, name: "Special Cars", minRank: GODFATHER_RANK, blurb: "The grandest motors in Britain, from outside the finest houses and hotels.", energy: 50, baseChance: 0.15, weights: [0, 0, 10, 90], xp: 80, fine: 50, heat: [40, 50, 65, 80] }
];

// Number plates: two letters and up to four digits, in the style of the 1930s.
const PLATE_CODES: Record<string, string[]> = {
  London: ["LC", "LD", "LF", "YX"],
  Birmingham: ["OA", "OC", "OF"],
  Manchester: ["NA", "NB", "NC"],
  Liverpool: ["KA", "KB", "KD"],
  Glasgow: ["GA", "GB", "GE"]
};

export function makePlate(city: string): string {
  const codes = PLATE_CODES[city] ?? PLATE_CODES.London;
  const code = codes[Math.floor(Math.random() * codes.length)];
  const digits = 100 + Math.floor(Math.random() * 9900);
  return `${code} ${digits}`;
}

// Which city a plate belongs to, read from its two letters.
export function plateCity(plate: string): string | null {
  const code = plate.slice(0, 2);
  for (const [city, codes] of Object.entries(PLATE_CODES)) {
    if (codes.includes(code)) return city;
  }
  return null;
}

// A false plate: from any city except the one the car was stolen in.
export function makeFalsePlate(originCity: string, current: string): string {
  const cities = Object.keys(PLATE_CODES).filter((c) => c !== originCity);
  for (let i = 0; i < 20; i++) {
    const plate = makePlate(cities[Math.floor(Math.random() * cities.length)]);
    if (plate !== current) return plate;
  }
  return makePlate(cities[0]);
}

// Shipping a car to another city by rail freight.
export const SHIP_CITIES = ["London", "Birmingham", "Manchester", "Liverpool", "Glasgow"];
export function shipCost(price: number): number {
  return Math.max(25, Math.round(price * 0.05));
}

export const SHIP_MINUTES = 10; // how long rail freight takes to arrive

// Plates and repairs can only be done away from the city the car was stolen in, with the
// player standing in the car's city, once any rail journey has finished.
export type WorkBlock = "IN_TRANSIT" | "AT_ORIGIN" | "NOT_HERE" | null;
export function workBlock(
  car: { city: string; originCity: string; shipArrivesAt: Date | string | null },
  playerCity: string,
  now = Date.now()
): WorkBlock {
  if (car.shipArrivesAt && new Date(car.shipArrivesAt).getTime() > now) return "IN_TRANSIT";
  if (car.city === car.originCity) return "AT_ORIGIN";
  if (car.city !== playerCity) return "NOT_HERE";
  return null;
}

export const AMBER_HEAT = 50; // a car that has just been shipped is amber

export const PLATE_COST = 20; // £ to fit a new plate
export const PLATE_HEAT_DROP = 50; // heat removed by a new plate
export const MAX_DAMAGE = 50; // worst damage on a freshly stolen car

// Repairs cost more for finer cars.
export function repairCost(damage: number, tier: number): number {
  return Math.round(damage * (10 + tier * 5) * 0.1);
}

// A knocked-about car is slower: up to +50% on the wait between journeys.
export function effectiveMinutes(car: CarModel | undefined, damage: number): number {
  return Math.round(travelMinutes(car) * (car ? 1 + damage / 100 : 1));
}

// Each level has its own wait, and the harder the job the longer it is.
export const THEFT_COOLDOWNS: Record<number, number> = {
  1: 180, // 3 minutes
  2: 600, // 10 minutes
  3: 1800, // 30 minutes
  4: 7200 // 2 hours
};

export const MAX_THEFT_CHANCE = 0.5; // no job is ever better than 50%

// Chance of pulling a job off: it starts at the level's base chance and improves by
// 2% for every rank you hold above the one that unlocks it, up to the 50% cap.
export function theftChance(level: TheftLevel, rankLevel: number): number {
  const above = Math.max(0, rankLevel - level.minRank);
  return Math.min(MAX_THEFT_CHANCE, level.baseChance + above * 0.02);
}

export type CityStory = { welcome: string; history: string };

export const CITY_STORIES: Record<string, CityStory> = {
  London: {
    welcome: "Welcome to London",
    history:
      "The capital of the Empire. Soho clubs, the docks at Wapping and Limehouse, and racecourse gangs run by Italian and Jewish bosses. The Metropolitan Police are always watching."
  },
  Birmingham: {
    welcome: "Welcome to Birmingham",
    history:
      "The city of a thousand trades. Gun makers like Webley & Scott and BSA work here, and the Brummagem Boys have long fought London's gangs for the racecourses."
  },
  Manchester: {
    welcome: "Welcome to Manchester",
    history:
      "Cotton mills, the Ship Canal docks at Salford and crowded back-to-back streets. Dockside warehouses make good hiding places for spirits."
  },
  Liverpool: {
    welcome: "Welcome to Liverpool",
    history:
      "Britain's great Atlantic port. Liners sail from the Mersey to New York, and spirits bound for America's Prohibition sail with them."
  },
  Glasgow: {
    welcome: "Welcome to Glasgow",
    history:
      "Shipyards on the Clyde, the Gorbals tenements and razor-wielding gangs such as the Billy Boys and the Beehive Boys. Rough, loyal and quick to anger."
  }
};

// Weapons in circulation in 1930s Britain. Calibres of the bullets made at the factories.
export type Arm = { name: string; maker: string; calibre: string; note: string };

export const ARMS: Arm[] = [
  { name: "Webley Mk VI Revolver", maker: "Webley & Scott", calibre: ".455", note: "The old army sidearm, still carried by many." },
  { name: "Enfield No. 2 Mk I Revolver", maker: "Royal Small Arms Factory", calibre: ".38", note: "Adopted by the army in 1932." },
  { name: "Colt M1911", maker: "Colt", calibre: ".45 ACP", note: "American automatic pistol, smuggled in from across the Atlantic." },
  { name: "Mauser C96 'Broomhandle'", maker: "Mauser", calibre: "7.63mm", note: "The long-barrelled German pistol with a wooden holster stock." },
  { name: "Greener Police Shotgun", maker: "W.W. Greener", calibre: ".303", note: "PLACEHOLDER" }
];
