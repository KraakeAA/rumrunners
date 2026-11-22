import { prisma } from "@/lib/prisma";
import { levelOf } from "@/lib/training";

type UserReader = { user: { findUnique: (args: { where: { id: string }; select: { isAdmin: true } }) => Promise<{ isAdmin: boolean } | null> } };

// Admins skip every timer and stat requirement, so they can try anything in the game.
export async function isAdminUser(userId: string, client?: unknown): Promise<boolean> {
  const db = (client ?? prisma) as UserReader;
  const u = await db.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
  return !!u?.isAdmin;
}

// Strength used for gun and kit checks. Admins count as strong enough for anything.
export const strengthFor = (admin: boolean, points: number) =>
  admin ? Number.POSITIVE_INFINITY : levelOf(points);
