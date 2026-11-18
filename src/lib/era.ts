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
  scrap: number; // bullets from melting it down
  note: string;
};

export const CARS: CarModel[] = [
  { key: "austin_seven", name: "Austin Seven", maker: "Austin", year: "1922-39", speed: 50, boot: 3, price: 1_500, minutes: 60, tier: 1, scrap: 150, note: "Britain's people's car. Slow, tiny and everywhere." },
  { key: "ford_model_y", name: "Ford Model Y", maker: "Ford (Dagenham)", year: "1932-37", speed: 58, boot: 5, price: 2_500, minutes: 55, tier: 1, scrap: 200, note: "Cheap, tidy and built in England." },
  { key: "morris_eight", name: "Morris Eight", maker: "Morris", year: "1935-39", speed: 60, boot: 6, price: 3_500, minutes: 50, tier: 1, scrap: 250, note: "The family saloon nobody looks at twice." },
  { key: "morris_commercial_van", name: "Morris-Commercial Van", maker: "Morris-Commercial", year: "1924-39", speed: 45, boot: 18, price: 5_500, minutes: 60, tier: 1, scrap: 300, note: "A baker's van with a false floor." },
  { key: "wolseley_hornet", name: "Wolseley Hornet", maker: "Wolseley", year: "1930-36", speed: 68, boot: 4, price: 6_000, minutes: 45, tier: 2, scrap: 220, note: "A small six that punches above its weight." },
  { key: "riley_nine", name: "Riley Nine", maker: "Riley", year: "1926-38", speed: 70, boot: 5, price: 7_000, minutes: 42, tier: 2, scrap: 250, note: "Light, quick and handles beautifully." },
  { key: "bedford_wlg", name: "Bedford WLG Lorry", maker: "Bedford (Vauxhall)", year: "1931-39", speed: 38, boot: 40, price: 9_000, minutes: 60, tier: 2, scrap: 900, note: "Two tons of crates. Not built for getting away." },
  { key: "ss1", name: "SS1 Coupé", maker: "SS Cars (Swallow)", year: "1932-36", speed: 75, boot: 2, price: 12_000, minutes: 35, tier: 3, scrap: 300, note: "Long, low and flashy. Hardly any room for cargo." },
  { key: "humber_snipe", name: "Humber Snipe", maker: "Humber", year: "1930-39", speed: 75, boot: 12, price: 14_000, minutes: 38, tier: 3, scrap: 400, note: "Big, solid saloon favoured by the well-to-do." },
  { key: "ford_v8", name: "Ford V8 Saloon", maker: "Ford", year: "1932-39", speed: 80, boot: 10, price: 18_000, minutes: 32, tier: 3, scrap: 450, note: "The fast, roomy car the gangs on both sides of the Atlantic love." },
  { key: "bentley_35", name: "Bentley 3½ Litre", maker: "Bentley (Rolls-Royce)", year: "1933-39", speed: 90, boot: 6, price: 60_000, minutes: 25, tier: 4, scrap: 600, note: "The Silent Sports Car. Quick and quiet." },
  { key: "bentley_blower", name: "Bentley 4½ Litre Supercharged", maker: "Bentley", year: "1929-31", speed: 100, boot: 3, price: 80_000, minutes: 20, tier: 4, scrap: 700, note: "The Blower. Fastest thing on the road, with room for little else." },
  { key: "rolls_phantom_ii", name: "Rolls-Royce Phantom II", maker: "Rolls-Royce", year: "1929-35", speed: 90, boot: 16, price: 120_000, minutes: 28, tier: 4, scrap: 1_000, note: "Fast, enormous and nobody dares stop it." }
];

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

// Heat: how much the police want a car. Cools down while it sits unused.
export const MAX_HEAT = 100;
export const HEAT_COOL_MINUTES = 5; // one point of heat lost every 5 minutes
export const DRIVE_HEAT = 8; // heat added by each journey

export function currentHeat(heat: number, heatAt: Date | string, now = Date.now()): number {
  const lost = Math.floor((now - new Date(heatAt).getTime()) / (HEAT_COOL_MINUTES * 60_000));
  return Math.max(0, Math.min(MAX_HEAT, heat - Math.max(0, lost)));
}

// Auto theft: four levels unlocked by rank. Every car can turn up at every
// level, but the better cars are far harder to take at the earlier levels.
export type TheftLevel = {
  level: 1 | 2 | 3 | 4;
  name: string;
  minRank: number;
  blurb: string;
  energy: number;
  baseChance: number; // chance against an easy car
  weights: [number, number, number, number]; // how often tier 1..4 cars turn up
  xp: number; // XP for a successful theft (plus a little more for harder cars)
  fine: number; // paid if you are caught
  heat: [number, number, number, number]; // heat on a stolen car by tier
};

export const THEFT_LEVELS: TheftLevel[] = [
  { level: 1, name: "Back-Street Opportunist", minRank: 3, blurb: "Try the doors of motors left on the street.", energy: 20, baseChance: 0.75, weights: [70, 25, 4, 1], xp: 14, fine: 30, heat: [25, 35, 50, 65] },
  { level: 2, name: "Hot-Wire Job", minRank: 5, blurb: "Work the ignition on cars parked outside pubs and shops.", energy: 30, baseChance: 0.78, weights: [40, 40, 16, 4], xp: 30, fine: 80, heat: [30, 40, 55, 70] },
  { level: 3, name: "Garage Break-In", minRank: 7, blurb: "Break into lock-ups and private garages after dark.", energy: 40, baseChance: 0.8, weights: [15, 35, 35, 15], xp: 52, fine: 200, heat: [35, 45, 60, 75] },
  { level: 4, name: "Society Motor Snatch", minRank: 9, blurb: "Take the grandest cars from outside the finest houses and hotels.", energy: 50, baseChance: 0.82, weights: [5, 20, 35, 40], xp: 80, fine: 500, heat: [40, 50, 65, 80] }
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

export const PLATE_COST = 200; // £ to fit a new plate
export const PLATE_HEAT_DROP = 50; // heat removed by a new plate
export const MAX_DAMAGE = 50; // worst damage on a freshly stolen car

// Repairs cost more for finer cars.
export function repairCost(damage: number, tier: number): number {
  return damage * (10 + tier * 5);
}

// A knocked-about car is slower: up to +50% on the wait between journeys.
export function effectiveMinutes(car: CarModel | undefined, damage: number): number {
  return Math.round(travelMinutes(car) * (car ? 1 + damage / 100 : 1));
}

// Each theft level has its own cooldown.
export const THEFT_COOLDOWNS: Record<number, number> = { 1: 30, 2: 45, 3: 60, 4: 90 };

export function theftChance(level: TheftLevel, tier: number): number {
  const gap = Math.max(0, tier - level.level);
  const chance = level.baseChance - gap * 0.2 - (tier - 1) * 0.04;
  return Math.max(0.03, Math.min(0.92, chance));
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
  { name: "Greener Police Shotgun", maker: "W.W. Greener", calibre: ".303".replace(".303", "12-bore"), note: "A Birmingham-made shotgun, used by police and gangs alike." },
  { name: "Short Magazine Lee-Enfield", maker: "Enfield", calibre: ".303", note: "The army rifle of two wars." },
  { name: "Thompson Submachine Gun", maker: "Auto-Ordnance", calibre: ".45 ACP", note: "The 'Tommy gun'. Rare and feared, and the IRA bought some." }
];
