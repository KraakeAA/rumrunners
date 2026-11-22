import { levelOf } from "@/lib/training";
import { isAdminUser, strengthFor } from "@/lib/admin-bypass";
import { denyIfDead } from "@/lib/alive";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import {
  SLOTS,
  cleanEquipped,
  equipmentStats,
  canWield,
  findByType,
  slotOf,
  type Equipped
} from "@/lib/store";

async function view(playerId: string) {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  const owned = await prisma.inventoryItem.findMany({ where: { playerId } });
  if (!player) return null;

  const ownedKeys = new Set(owned.filter((o) => o.quantity > 0).map((o) => o.itemType));
  const adminView = await isAdminUser(player.userId);
  const strength = strengthFor(adminView, player.strengthPts);
  let equipped: Equipped = cleanEquipped(player.equipped);

  // Players who bought kit before slots existed: put their best item in each empty slot, once.
  if (player.equipped === null) {
    const best: Equipped = {};
    for (const typeKey of ownedKeys) {
      const slot = slotOf(typeKey);
      const item = findByType(typeKey);
      if (!slot || !item || !canWield(item, strength)) continue;
      const current = best[slot] ? findByType(best[slot]!) : undefined;
      if (!current || item.value > current.value) best[slot] = typeKey;
    }
    equipped = best;
    await prisma.player.update({
      where: { id: playerId },
      data: { equipped: JSON.parse(JSON.stringify(equipped)), protection: equipmentStats(best, strength).protection }
    });
  }

  const stats = equipmentStats(equipped, strength);

  const kit = [...ownedKeys]
    .map((typeKey) => {
      const item = findByType(typeKey);
      const slot = slotOf(typeKey);
      if (!item || !slot) return null;
      return {
        type: typeKey,
        slot,
        name: item.name,
        note: item.note,
        kind: item.kind,
        value: item.value,
        detail: item.detail ?? null,
        strength: item.strength ?? 0,
        canWield: canWield(item, strength),
        equipped: equipped[slot] === typeKey
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return {
    name: player.username,
    rank: player.rank,
    health: player.health,
    money: player.money,
    gold: player.gold,
    bullets: player.bullets,
    strengthLevel: adminView ? 30 : strength,
    staminaLevel: levelOf(player.staminaPts),
    agilityLevel: levelOf(player.agilityPts),
    firepower: stats.firepower,
    protection: stats.protection,
    slots: SLOTS.map((s) => {
      const typeKey = equipped[s.key];
      const item = typeKey ? findByType(typeKey) : undefined;
      return {
        key: s.key,
        label: s.label,
        side: s.side,
        item: item && typeKey ? { type: typeKey, name: item.name, kind: item.kind, value: item.value } : null
      };
    }),
    kit
  };
}

export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

    const me = await prisma.player.findUnique({ where: { userId }, select: { id: true } });
    if (!me) return NextResponse.json({ error: "Player not found." }, { status: 404 });

    return NextResponse.json(await view(me.id));
  } catch (error) {
    console.error("Character load failed:", error);
    return NextResponse.json({ error: "Your character could not be loaded." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const __dead = await denyIfDead();
  if (__dead) return __dead;

  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");
    const typeKey = String(body.type ?? "");

    const me = await prisma.player.findUnique({ where: { userId } });
    if (!me) return NextResponse.json({ error: "Player not found." }, { status: 404 });

    const equipped = cleanEquipped(me.equipped);
    const slot = slotOf(typeKey);
    const item = findByType(typeKey);
    if (!slot || !item) return NextResponse.json({ error: "That can't be equipped." }, { status: 400 });

    if (action === "equip") {
      const have = await prisma.inventoryItem.findUnique({
        where: { playerId_itemType: { playerId: me.id, itemType: typeKey } }
      });
      if (!have || have.quantity < 1) {
        return NextResponse.json({ error: "You don't own that." }, { status: 400 });
      }
      const adminUser = await isAdminUser(userId);
      if (!adminUser && !canWield(item, levelOf(me.strengthPts))) {
        return NextResponse.json(
          { error: `You need Strength ${item.strength} to hold that. Train at the Gymnasium.` },
          { status: 400 }
        );
      }
      equipped[slot] = typeKey;
    } else if (action === "unequip") {
      if (equipped[slot] === typeKey) delete equipped[slot];
    } else {
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    await prisma.player.update({
      where: { id: me.id },
      data: { equipped: JSON.parse(JSON.stringify(equipped)), protection: equipmentStats(equipped, strengthFor(await isAdminUser(userId), me.strengthPts)).protection }
    });

    return NextResponse.json({
      ok: true,
      message: action === "equip" ? `${item.name} equipped.` : `${item.name} put away.`,
      ...(await view(me.id))
    });
  } catch (error) {
    console.error("Character update failed:", error);
    return NextResponse.json({ error: "That could not be completed." }, { status: 500 });
  }
}
