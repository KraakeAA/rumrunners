import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(
    await req.json().catch(() => null)
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter your email and password." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
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
      { error: "Email or password is incorrect." },
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
