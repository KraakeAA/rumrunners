import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { clientIp, tooMany } from "@/lib/ratelimit";

// Players can sign in with their username or their email address.
const schema = z.object({
  login: z.string().trim().min(1).max(254).optional(),
  email: z.string().trim().min(1).max(254).optional(),
  password: z.string().min(1).max(128)
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(
    await req.json().catch(() => null)
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter your username and password." },
      { status: 400 }
    );
  }

  // Slow down password guessing: 8 tries per 15 minutes for one email, 30 for one address.
  const who = (parsed.data.login ?? parsed.data.email ?? "").trim();
  if (!who) {
    return NextResponse.json(
      { error: "Enter your username and password." },
      { status: 400 }
    );
  }
  if (tooMany(`login:e:${who.toLowerCase()}`, 8, 15 * 60_000) || tooMany(`login:ip:${clientIp(req)}`, 30, 15 * 60_000)) {
    return NextResponse.json({ error: "Too many tries. Wait a few minutes and try again." }, { status: 429 });
  }

  const user = await prisma.user.findFirst({
    where: who.includes("@")
      ? { email: { equals: who, mode: "insensitive" } }
      : { player: { is: { username: { equals: who, mode: "insensitive" } } } },
    include: { player: true }
  });

  if (
    !user ||
    !(await bcrypt.compare(
      parsed.data.password,
      user.passwordHash
    ))
  ) {
    return NextResponse.json(
      { error: "Username or password is incorrect." },
      { status: 401 }
    );
  }

  if (user.banned) {
    return NextResponse.json(
      {
        error: user.banReason
          ? `This account has been banned: ${user.banReason}`
          : "This account has been banned."
      },
      { status: 403 }
    );
  }

  await createSession(user.id);

  return NextResponse.json({ ok: true });
}
