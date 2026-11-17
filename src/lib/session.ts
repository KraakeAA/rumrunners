
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

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

    return typeof payload.userId === "string"
      ? payload.userId
      : null;
  } catch {
    return null;
  }
}

export async function destroySession() {
  (await cookies()).delete("rr_session");
}
