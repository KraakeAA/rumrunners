import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const secret = process.env.SESSION_SECRET;

if (!secret || secret.length < 32) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be at least 32 characters.");
  }
}

const key = new TextEncoder().encode(
  secret || "development-only-secret-change-this-now"
);

export async function createSession(userId: string) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);

  const jar = await cookies();

  jar.set("rr_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
}

export async function getSessionUserId(): Promise<string | null> {
  const token = (await cookies()).get("rr_session")?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, key);

    if (typeof payload.userId !== "string") return null;

    // A banned account counts as signed out.
    const account = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { banned: true }
    });
    if (!account || account.banned) return null;

    return payload.userId;
  } catch {
    return null;
  }
}

export async function destroySession() {
  (await cookies()).delete("rr_session");
}
