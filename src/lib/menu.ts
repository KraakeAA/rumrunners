// The game menu, used by the menu bar on the pages that sit outside the game
// screen (profiles, users online).
export const MENU_GROUPS = [
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

// Where a menu item goes when you pick it from outside the game screen.
export function menuHref(item: string): string {
  if (item === "Logout") return "/logout";
  if (item === "Profile") return "/profile-edit";
  if (item === "Users Online") return "/users-online";
  if (item === "Full Site" || item === "Home") return "/";
  return `/?go=${encodeURIComponent(item)}`;
}
