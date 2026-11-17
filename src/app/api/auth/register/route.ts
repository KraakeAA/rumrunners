
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";

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

  const { email, username, password } = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { email }
  });

  const nameTaken = await prisma.player.findUnique({
    where: { username }
  });

  if (existing || nameTaken) {
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
        create: { username }
      }
    }
  });

  await createSession(user.id);

  return NextResponse.json({ ok: true });
}
