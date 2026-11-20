// Crews (gangs). Only a few can exist at once, so a place in one is worth having.
export const MAX_CREWS = 10;
export const MAX_MEMBERS = 24;
export const CREW_COST = 50000;
export const MAX_QUESTIONS = 5;
export const MAX_QUESTION_LENGTH = 120;
export const MAX_ANSWER_LENGTH = 300;
export const MAX_MOTTO_LENGTH = 500;

const NAME = /^[A-Za-z0-9][A-Za-z0-9 '&.\-]{1,22}[A-Za-z0-9.]$/;

// The colours a crew can pick. The colour is the crew's banner on every member's profile.
export const CREW_COLOURS = [
  "#7a0f0f", "#b01818", "#d83a2e", "#e8704a",
  "#8a4b12", "#c98a1e", "#d9c24a", "#7a8a1e",
  "#2f6b2a", "#1f8a6a", "#1f6f8a", "#2a4fa0",
  "#4a2f8a", "#8a2f8a", "#b0306a", "#555555"
];

export function cleanCrewName(raw: unknown): string | null {
  const name = String(raw ?? "").replace(/\s+/g, " ").trim();
  return NAME.test(name) ? name : null;
}

export function isCrewColour(raw: unknown): raw is string {
  return typeof raw === "string" && CREW_COLOURS.includes(raw);
}

export function cleanQuestions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((q) => String(q ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_QUESTION_LENGTH))
    .filter((q) => q.length > 0)
    .slice(0, MAX_QUESTIONS);
}

export function questionsOf(stored: unknown): string[] {
  return Array.isArray(stored) ? stored.map((q) => String(q)) : [];
}
