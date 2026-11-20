// Shared by the top bar on the non-game pages (SiteMenuBar).

// The header sky follows UK time: night, dawn, day, dusk, and back round.
// Each point is [minute of the day, top, middle, bottom, how lit the windows are].
export const SKY_POINTS: [number, string, string, string, number][] = [
  [0, "#070a14", "#0e1424", "#1a2236", 1],
  [300, "#070a14", "#0e1424", "#1a2236", 1],
  [390, "#2a2440", "#8a5a5a", "#e0a070", 0.4],
  [510, "#44546a", "#6c7c8c", "#a9b3b7", 0],
  [960, "#44546a", "#6c7c8c", "#a9b3b7", 0],
  [1080, "#1a1620", "#4a2f30", "#9a6240", 0.6],
  [1200, "#0b0f1c", "#141a2c", "#222a3e", 1],
  [1440, "#070a14", "#0e1424", "#1a2236", 1]
];

function mixHex(a: string, b: string, t: number) {
  const n = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const c = (i: number) => Math.round(n(a, i) + (n(b, i) - n(a, i)) * t);
  return `rgb(${c(0)}, ${c(1)}, ${c(2)})`;
}

export function skyFor(clockText: string) {
  const m = /^(\d{1,2}):(\d{2})/.exec(clockText);
  const mins = m ? Number(m[1]) * 60 + Number(m[2]) : 1080;
  let i = 0;
  while (i < SKY_POINTS.length - 2 && mins >= SKY_POINTS[i + 1][0]) i++;
  const [t0, a1, a2, a3, l0] = SKY_POINTS[i];
  const [t1, b1, b2, b3, l1] = SKY_POINTS[i + 1];
  const t = t1 > t0 ? Math.min(1, Math.max(0, (mins - t0) / (t1 - t0))) : 0;
  return {
    background: `linear-gradient(180deg, ${mixHex(a1, b1, t)} 0%, ${mixHex(a2, b2, t)} 55%, ${mixHex(a3, b3, t)} 100%)`,
    lights: l0 + (l1 - l0) * t
  };
}

// A dense, thin-building skyline made once: the outline, plus a few windows.
export const SKYLINE = (() => {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  let x = 0;
  let d = "M0 20";
  const windows: [number, number][] = [];
  while (x < 400) {
    const w = 2 + Math.floor(rnd() * 4);
    const h = 4 + Math.floor(rnd() * 11);
    const top = 20 - h;
    d += ` V${top} H${Math.min(400, x + w)}`;
    if (w >= 3 && rnd() < 0.4) windows.push([x + 1, top + 2 + Math.floor(rnd() * 2)]);
    x += w;
  }
  d += " V20 Z";
  return { d, windows };
})();
