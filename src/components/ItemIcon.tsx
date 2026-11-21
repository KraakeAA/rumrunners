"use client";

import { useState, type ReactNode } from "react";

// Item pictures live in public/images/items/guns/ and public/images/items/protection/
// (or loose in public/images/items/). Garages have no picture.
const GUN_ART: Record<string, string> = {
  webley: "webley-mk-vi",
  enfield: "enfield-no-2-mk-i",
  colt: "colt-m1911",
  mauser: "mauser-c96",
  greener: "greener-police-shotgun",
  lee_enfield: "short-magazine-lee-enfield",
  thompson: "thompson-submachine-gun"
};

const PROTECTION_ART: Record<string, string> = {
  guard_dog: "guard-dog",
  steel_hat: "steel-lined-bowler-hat",
  plated_jacket: "steel-plated-jacket",
  iron_door: "reinforced-front-door",
  bodyguard: "hired-heavy",
  vest: "experimental-bulletproof-vest",
  limousine: "armoured-limousine"
};

function itemPaths(kind: string, key: string): string[] {
  const slug = kind === "gun" ? GUN_ART[key] : kind === "protection" ? PROTECTION_ART[key] : undefined;
  if (!slug) return [];
  const folder = kind === "gun" ? "guns" : "protection";
  return [`/images/items/${folder}/${slug}.png`, `/images/items/${slug}.png`];
}

// A small picture of a store item. Pass either kind + itemKey ("gun", "webley")
// or a full type key like "gun:webley". Shows `fallback` if there is no picture.
export default function ItemIcon({
  kind,
  itemKey,
  typeKey,
  size,
  fallback = null
}: {
  kind?: string;
  itemKey?: string;
  typeKey?: string;
  size: number;
  fallback?: ReactNode;
}) {
  let k = kind ?? "";
  let key = itemKey ?? "";
  if (typeKey) {
    const at = typeKey.indexOf(":");
    k = typeKey.slice(0, at);
    key = typeKey.slice(at + 1);
  }
  const paths = itemPaths(k, key);
  const id = `${k}:${key}`;
  const [state, setState] = useState({ id, attempt: 0 });
  const attempt = state.id === id ? state.attempt : 0;

  if (attempt >= paths.length) return <>{fallback}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={paths[attempt]}
      alt=""
      width={size}
      height={size}
      onError={() => setState({ id, attempt: attempt + 1 })}
      style={{ display: "block", width: size, height: size, flexShrink: 0, objectFit: "contain", borderRadius: 3 }}
    />
  );
}
