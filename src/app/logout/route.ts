import { NextResponse } from "next/server";
import { destroySession } from "@/lib/session";

export async function GET(req: Request) {
  // Browsers and Next.js can fetch links ahead of time. That must never
  // sign someone out, so ignore anything that is only a prefetch.
  const h = req.headers;
  const prefetch =
    h.get("next-router-prefetch") !== null ||
    h.get("purpose") === "prefetch" ||
    (h.get("sec-purpose") ?? "").includes("prefetch") ||
    h.get("x-middleware-prefetch") !== null ||
    h.get("rsc") !== null;

  if (prefetch) {
    return new NextResponse(null, { status: 204 });
  }

  await destroySession();

  // A relative address keeps the player on whichever site address they are using
  // (the server itself only knows its own internal name, not rumrunners.uk).
  return new NextResponse(null, { status: 303, headers: { Location: "/login" } });
}
