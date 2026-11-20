// A small in-memory limiter: "no more than `max` tries per `windowMs` for this key".
// It is kept in the server's memory, so it resets when the server restarts, which is fine for
// slowing down password guessing and sign-up floods.
const hits = new Map<string, number[]>();

export function tooMany(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
  }
  return false;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0] : req.headers.get("x-real-ip") ?? "unknown").trim();
}
