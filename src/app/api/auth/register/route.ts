
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { clientIp, tooMany } from "@/lib/ratelimit";

const schema = z.object({
  email: z.string().email().max(254),
  username: z.string().trim().min(3).max(18)
    .regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(10).max(128)
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(
    await req.json().catch(() => null)
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid email, username and password of at least 10 characters." },
      { status: 400 }
    );
  }

  const { username, password } = parsed.data;
  const email = parsed.data.email.trim().toLowerCase();

  if (tooMany(`register:${clientIp(req)}`, 5, 60 * 60_000)) {
    return NextResponse.json({ error: "Too many sign-ups from here. Try again later." }, { status: 429 });
  }

  // Emails and names are compared ignoring capitals, so "Ben" and "ben" can't both exist.
  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } }
  });

  const nameTaken = await prisma.player.findFirst({
    where: { username: { equals: username, mode: "insensitive" } }
  });

  const ghostName = await prisma.pastLife.findFirst({
    where: { username: { equals: username, mode: "insensitive" } }
  });

  if (existing || nameTaken || ghostName) {
    return NextResponse.json(
      { error: "That email or username is already registered." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      player: {
        create: {
          username,
          shieldUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      }
    }
  });

  await createSession(user.id);

  return NextResponse.json({ ok: true });
}
