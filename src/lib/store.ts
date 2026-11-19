// The Store catalogue. Pure data, shared by the server and the browser.

export type StoreKind = "gun" | "protection" | "garage";

export type StoreItem = {
  key: string;
  kind: StoreKind;
  name: string;
  note: string;
  price: number;
  // Guns: attack rating. Protection: protection points. Garage: extra car spaces.
  value: number;
  detail?: string;
  // Guns: the Strength level needed to hold it.
  strength?: number;
};

export const PROTECTION_CAP = 100;
export const GARAGE_CAP = 60;

export const GUNS: StoreItem[] = [
  { key: "webley", kind: "gun", name: "Webley Mk VI Revolver", note: "The old army sidearm, still carried by many.", price: 50, value: 5, detail: ".455", strength: 0 },
  { key: "enfield", kind: "gun", name: "Enfield No. 2 Mk I Revolver", note: "Adopted by the army in 1932.", price: 90, value: 8, detail: ".38", strength: 3 },
  { key: "colt", kind: "gun", name: "Colt M1911", note: "American automatic pistol, smuggled in from across the Atlantic.", price: 200, value: 12, detail: ".45 ACP", strength: 5 },
  { key: "mauser", kind: "gun", name: "Mauser C96 'Broomhandle'", note: "The long-barrelled German pistol with a wooden holster stock.", price: 350, value: 16, detail: "7.63mm", strength: 8 },
  { key: "greener", kind: "gun", name: "Greener Police Shotgun", note: "A Birmingham-made shotgun, used by police and gangs alike.", price: 500, value: 20, detail: "12-bore", strength: 11 },
  { key: "lee_enfield", kind: "gun", name: "Short Magazine Lee-Enfield", note: "The army rifle of two wars.", price: 800, value: 28, detail: ".303", strength: 15 },
  { key: "thompson", kind: "gun", name: "Thompson Submachine Gun", note: "The 'Tommy gun'. Rare and feared.", price: 2_500, value: 50, detail: ".45 ACP", strength: 20 }
];

export const PROTECTION: StoreItem[] = [
  { key: "guard_dog", kind: "protection", name: "Guard Dog", note: "An Alsatian that doesn't like strangers.", price: 100, value: 5 },
  { key: "steel_hat", kind: "protection", name: "Steel-lined Bowler Hat", note: "Looks respectable. Stops a cosh.", price: 150, value: 5 },
  { key: "plated_jacket", kind: "protection", name: "Steel-plated Jacket", note: "Heavy, hot and worth it.", price: 400, value: 10 },
  { key: "iron_door", kind: "protection", name: "Reinforced Front Door", note: "Oak and iron. Nobody kicks this in.", price: 600, value: 10 },
  { key: "bodyguard", kind: "protection", name: "Hired Heavy", note: "A former boxer who works for beer and wages.", price: 1_000, value: 15 },
  { key: "vest", kind: "protection", name: "Experimental Bulletproof Vest", note: "Silk and steel. Heavy, but it works.", price: 2_500, value: 20 },
  { key: "limousine", kind: "protection", name: "Armoured Limousine", note: "A bank van in a dinner jacket.", price: 6_000, value: 25 }
];

export const GARAGES: StoreItem[] = [
  { key: "lockup", kind: "garage", name: "Lock-up Under the Arches", note: "A damp railway arch with a padlock.", price: 500, value: 3 },
  { key: "yard", kind: "garage", name: "Scrapyard", note: "Nobody asks what's under the tarpaulin.", price: 1_500, value: 6 },
  { key: "warehouse", kind: "garage", name: "Dockside Warehouse", note: "Plenty of room and a night watchman on the payroll.", price: 5_000, value: 12 },
  { key: "depot", kind: "garage", name: "Old Tram Depot", note: "Room for a small army of motors.", price: 15_000, value: 20 }
];

export const CATALOGUE: StoreItem[] = [...GUNS, ...PROTECTION, ...GARAGES];

export const itemKey = (item: { kind: StoreKind; key: string }) => `${item.kind}:${item.key}`;

export function findItem(kind: string, key: string): StoreItem | undefined {
  return CATALOGUE.find((i) => i.kind === kind && i.key === key);
}

// Equipment slots on the Character screen.
export type SlotKey = "hat" | "body" | "guard" | "home" | "motor" | "primary" | "sidearm";

export const SLOTS: { key: SlotKey; label: string; side: "left" | "right" }[] = [
  { key: "hat", label: "Hat", side: "left" },
  { key: "body", label: "Body", side: "left" },
  { key: "guard", label: "Guard", side: "left" },
  { key: "home", label: "Home", side: "left" },
  { key: "motor", label: "Motor", side: "left" },
  { key: "primary", label: "Primary Gun", side: "right" },
  { key: "sidearm", label: "Sidearm", side: "right" }
];

const SLOT_OF: Record<string, SlotKey> = {
  "gun:webley": "sidearm",
  "gun:enfield": "sidearm",
  "gun:colt": "sidearm",
  "gun:mauser": "sidearm",
  "gun:greener": "primary",
  "gun:lee_enfield": "primary",
  "gun:thompson": "primary",
  "protection:steel_hat": "hat",
  "protection:plated_jacket": "body",
  "protection:vest": "body",
  "protection:guard_dog": "guard",
  "protection:bodyguard": "guard",
  "protection:iron_door": "home",
  "protection:limousine": "motor"
};

// Garages are not worn or carried, so they have no slot.
export function slotOf(typeKey: string): SlotKey | null {
  return SLOT_OF[typeKey] ?? null;
}

export function findByType(typeKey: string): StoreItem | undefined {
  return CATALOGUE.find((i) => itemKey(i) === typeKey);
}

export type Equipped = Partial<Record<SlotKey, string>>;

// Firepower = the guns in hand. Defence = protection from everything equipped.
// A gun only counts if the player is strong enough to hold it (strengthLevel given).
export function canWield(item: StoreItem, strengthLevel: number): boolean {
  return item.kind !== "gun" || strengthLevel >= (item.strength ?? 0);
}

export function equipmentStats(
  equipped: Equipped,
  strengthLevel: number = Number.POSITIVE_INFINITY
): { firepower: number; protection: number } {
  let firepower = 0;
  let protection = 0;
  for (const typeKey of Object.values(equipped)) {
    if (!typeKey) continue;
    const item = findByType(typeKey);
    if (!item) continue;
    if (item.kind === "gun" && canWield(item, strengthLevel)) firepower += item.value;
    if (item.kind === "protection") protection += item.value;
  }
  return { firepower, protection: Math.min(PROTECTION_CAP, protection) };
}

export function cleanEquipped(raw: unknown): Equipped {
  const out: Equipped = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [slot, typeKey] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof typeKey === "string" && slotOf(typeKey) === slot) out[slot as SlotKey] = typeKey;
  }
  return out;
}
