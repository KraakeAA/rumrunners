
export const RANKS = [
  "Scum",
  "Mug",
  "Thug",
  "Crook",
  "Villain",
  "Gunman",
  "Gangster",
  "Boss",
  "Respected Boss",
  "Crime Boss",
  "Notorious Boss",
  "Crime Baron",
  "Legendary Crime Baron"
] as const;

export function rankForLevel(level: number) {
  return RANKS[
    Math.max(0, Math.min(RANKS.length - 1, level - 1))
  ];
}
