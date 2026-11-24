// System letters mention players with a tag like [[u:Ben]]. The mailbox turns each tag
// into a bold name that links to that player's profile. Letters written by players are
// never read for tags, so nobody can fake a link.

export const SYSTEM_SENDERS = [
  "The Underworld",
  "The Detective Agency",
  "The Bank",
  "Escrow Agent",
  "The Evening Standard",
  "Help Desk",
  "A Witness",
  "The Lottery",
  "The Casino"
];

export const userTag = (name: string) => `[[u:${name}]]`;

export const USER_TAG = /\[\[u:([^\]]+)\]\]/g;
