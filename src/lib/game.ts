
export const CRIME_COOLDOWN_SECONDS = 120;
export const CRIME_ENERGY_COST = 1;

export function energyAfterRegen(
  current: number,
  maximum: number,
  lastAt: Date,
  now = new Date()
) {
  // Initial development setting: one energy every 5 minutes.
  const intervals = Math.floor(
    (now.getTime() - lastAt.getTime()) / 300_000
  );

  const gained = Math.min(
    maximum - current,
    Math.max(0, intervals)
  );

  return {
    energy: current + gained,
    lastEnergyAt:
      gained > 0
        ? new Date(lastAt.getTime() + gained * 300_000)
        : lastAt
  };
}

export function rollCrime() {
  const success = Math.random() < 0.72;
  const cash = success
    ? 80 + Math.floor(Math.random() * 121)
    : 0;

  return { success, cash };
}
