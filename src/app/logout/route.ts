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

  // Stay on whichever address the player is using, so the redirect does not
  // hop between rumrunners.uk and www.rumrunners.uk.
  return NextResponse.redirect(new URL("/", req.url));
}
