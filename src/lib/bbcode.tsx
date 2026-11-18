import type { ReactNode } from "react";

// A small, safe BB code renderer: [b] [i] [u] [center]. Anything else is shown as plain text.
const TAGS = ["b", "i", "u", "center"] as const;

function parse(text: string, pos: { i: number }, closing: string | null, key: { n: number }): ReactNode[] {
  const out: ReactNode[] = [];
  let buf = "";

  const flush = () => {
    if (buf) {
      out.push(buf);
      buf = "";
    }
  };

  while (pos.i < text.length) {
    const rest = text.slice(pos.i);
    const close = rest.match(/^\[\/(b|i|u|center)\]/i);
    if (close) {
      if (closing && close[1].toLowerCase() === closing) {
        flush();
        pos.i += close[0].length;
        return out;
      }
      // A stray closing tag: show nothing.
      pos.i += close[0].length;
      continue;
    }

    const open = rest.match(/^\[(b|i|u|center)\]/i);
    if (open) {
      flush();
      pos.i += open[0].length;
      const tag = open[1].toLowerCase() as (typeof TAGS)[number];
      const inner = parse(text, pos, tag, key);
      const k = key.n++;
      if (tag === "b") out.push(<strong key={k}>{inner}</strong>);
      else if (tag === "i") out.push(<em key={k}>{inner}</em>);
      else if (tag === "u") out.push(<u key={k}>{inner}</u>);
      else out.push(<div key={k} style={{ textAlign: "center" }}>{inner}</div>);
      continue;
    }

    buf += text[pos.i];
    pos.i++;
  }

  flush();
  return out;
}

export function renderBB(text: string): ReactNode {
  return <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{parse(text, { i: 0 }, null, { n: 0 })}</span>;
}
