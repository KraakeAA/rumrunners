// Staff levels: 0 player, 1 helper (tickets), 2 moderator (tickets, bans, reports), 3 admin (everything).
export function staffLevel(user: { isAdmin: boolean; staffRole?: string | null } | null | undefined): number {
  if (!user) return 0;
  if (user.isAdmin) return 3;
  if (user.staffRole === "MODERATOR") return 2;
  if (user.staffRole === "HELPER") return 1;
  return 0;
}

export const STAFF_NAMES = ["", "Helper", "Moderator", "Admin"];

// Help ticket categories. minLevel is the lowest staff level that can see tickets in it.
export const TICKET_CATEGORIES: { key: string; label: string; minLevel: number }[] = [
  { key: "auto_theft", label: "Auto Theft", minLevel: 1 },
  { key: "bank", label: "Bank", minLevel: 1 },
  { key: "bootlegging", label: "Bootlegging / Booze Runs", minLevel: 1 },
  { key: "casino", label: "Casino", minLevel: 1 },
  { key: "crimes", label: "Crimes", minLevel: 1 },
  { key: "escrow", label: "Escrow", minLevel: 1 },
  { key: "gold", label: "Gold / Marketplace", minLevel: 2 },
  { key: "oc", label: "Organised Crime", minLevel: 1 },
  { key: "crew", label: "Crew Issues", minLevel: 2 },
  { key: "report", label: "Report a Player", minLevel: 2 },
  { key: "bug", label: "Bug or Exploit", minLevel: 3 },
  { key: "other", label: "Other", minLevel: 1 }
];

// Admins and moderators can't be searched for, hunted, or put on the hitlist, and so can't be killed.
export function isHiddenStaff(user: { isAdmin: boolean; staffRole?: string | null } | null | undefined): boolean {
  return staffLevel(user) >= 2;
}

// Prisma filter for player queries that should leave admins and moderators out.
export const NOT_HIDDEN_STAFF = {
  isAdmin: false,
  OR: [{ staffRole: null }, { staffRole: { not: "MODERATOR" } }]
};
