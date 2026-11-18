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
};

export const PROTECTION_CAP = 100;
export const GARAGE_CAP = 60;

export const GUNS: StoreItem[] = [
  { key: "webley", kind: "gun", name: "Webley Mk VI Revolver", note: "The old army sidearm, still carried by many.", price: 500, value: 5, detail: ".455" },
  { key: "enfield", kind: "gun", name: "Enfield No. 2 Mk I Revolver", note: "Adopted by the army in 1932.", price: 900, value: 8, detail: ".38" },
  { key: "colt", kind: "gun", name: "Colt M1911", note: "American automatic pistol, smuggled in from across the Atlantic.", price: 2_000, value: 12, detail: ".45 ACP" },
  { key: "mauser", kind: "gun", name: "Mauser C96 'Broomhandle'", note: "The long-barrelled German pistol with a wooden holster stock.", price: 3_500, value: 16, detail: "7.63mm" },
  { key: "greener", kind: "gun", name: "Greener Police Shotgun", note: "A Birmingham-made shotgun, used by police and gangs alike.", price: 5_000, value: 20, detail: "12-bore" },
  { key: "lee_enfield", kind: "gun", name: "Short Magazine Lee-Enfield", note: "The army rifle of two wars.", price: 8_000, value: 28, detail: ".303" },
  { key: "thompson", kind: "gun", name: "Thompson Submachine Gun", note: "The 'Tommy gun'. Rare and feared.", price: 25_000, value: 50, detail: ".45 ACP" }
];

export const PROTECTION: StoreItem[] = [
  { key: "guard_dog", kind: "protection", name: "Guard Dog", note: "An Alsatian that doesn't like strangers.", price: 1_000, value: 5 },
  { key: "steel_hat", kind: "protection", name: "Steel-lined Bowler Hat", note: "Looks respectable. Stops a cosh.", price: 1_500, value: 5 },
  { key: "plated_jacket", kind: "protection", name: "Steel-plated Jacket", note: "Heavy, hot and worth it.", price: 4_000, value: 10 },
  { key: "iron_door", kind: "protection", name: "Reinforced Front Door", note: "Oak and iron. Nobody kicks this in.", price: 6_000, value: 10 },
  { key: "bodyguard", kind: "protection", name: "Hired Heavy", note: "A former boxer who works for beer and wages.", price: 10_000, value: 15 },
  { key: "vest", kind: "protection", name: "Experimental Bulletproof Vest", note: "Silk and steel. Heavy, but it works.", price: 25_000, value: 20 },
  { key: "limousine", kind: "protection", name: "Armoured Limousine", note: "A bank van in a dinner jacket.", price: 60_000, value: 25 }
];

export const GARAGES: StoreItem[] = [
  { key: "lockup", kind: "garage", name: "Lock-up Under the Arches", note: "A damp railway arch with a padlock.", price: 5_000, value: 3 },
  { key: "yard", kind: "garage", name: "Scrapyard", note: "Nobody asks what's under the tarpaulin.", price: 15_000, value: 6 },
  { key: "warehouse", kind: "garage", name: "Dockside Warehouse", note: "Plenty of room and a night watchman on the payroll.", price: 50_000, value: 12 },
  { key: "depot", kind: "garage", name: "Old Tram Depot", note: "Room for a small army of motors.", price: 150_000, value: 20 }
];

export const CATALOGUE: StoreItem[] = [...GUNS, ...PROTECTION, ...GARAGES];

export const itemKey = (item: { kind: StoreKind; key: string }) => `${item.kind}:${item.key}`;

export function findItem(kind: string, key: string): StoreItem | undefined {
  return CATALOGUE.find((i) => i.kind === kind && i.key === key);
}
