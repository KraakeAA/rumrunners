"use client";

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";

export type ForumCategory = "OFFICIAL" | "CLASSIFIEDS" | "OFF_TOPIC" | "SUGGESTIONS";

type Post = {
  id: string;
  body: string;
  createdAt: string;
  author: { username: string };
};

type Topic = {
  id: string;
  authorId: string;
  category: ForumCategory;
  title: string;
  body: string;
  pinned: boolean;
  locked: boolean;
  createdAt: string;
  updatedAt: string;
  author: { username: string };
  posts: Post[];
  _count: { posts: number };
};

const PER_PAGE = 15;
const POSTS_PER_PAGE = 20;

// Text sizes, copied from the Bootleggers forum. Change a number here and it
// changes everywhere on the forums.
const SIZE = { bar: 14, row: 11, name: 12, body: 12, small: 10, input: 16 };

const bar: CSSProperties = {
  position: "relative",
  padding: "5px 8px",
  textAlign: "center",
  fontFamily: "Georgia, serif",
  fontSize: SIZE.bar,
  lineHeight: 1.25,
  color: "#f7efdb",
  background: "linear-gradient(180deg, #8a7038, #4d3d1c)",
  border: "1px solid #b0904a",
  textShadow: "0 1px 2px #000"
};

const panel: CSSProperties = {
  border: "1px solid #6b5d3a",
  borderTop: 0,
  background: "#1f2a25",
  padding: 6
};

const field: CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: "6px 8px",
  border: "1px solid #a08340",
  borderRadius: 0,
  background: "#0e1411",
  color: "#f7efdb",
  fontSize: SIZE.input,
  fontFamily: "inherit"
};

// The big white reply box, rounded like Bootleggers.
const whiteBox: CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  minHeight: 100,
  padding: "8px 10px",
  border: 0,
  borderRadius: 8,
  background: "#fff",
  color: "#111",
  fontSize: SIZE.input,
  fontFamily: "inherit",
  resize: "vertical"
};

const blueButton: CSSProperties = {
  padding: "3px 18px",
  border: "2px solid #4aa3ff",
  borderRadius: 14,
  background: "#0a6cf0",
  color: "#fff",
  fontSize: 13,
  fontFamily: "inherit",
  cursor: "pointer"
};

const linkButton: CSSProperties = {
  background: "none",
  border: 0,
  padding: 0,
  color: "#e4c04d",
  textDecoration: "underline",
  fontSize: "inherit",
  fontFamily: "inherit",
  cursor: "pointer"
};

const EMOTICONS = ["😀", "🙁", "😮", "😛", "😕", "🤓", "😁", "🙂", "😎", "😆", "👍", "👎"];

const nth = (n: number) => {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10 > 3 ? 0 : n % 10]}`;
};

// "Nov 20th, 2026 10:41:51 AM", UK time.
const stamp = (value: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/London",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).formatToParts(new Date(value));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${g("month")} ${nth(Number(g("day")))}, ${g("year")} ${g("hour")}:${g("minute")}:${g("second")} ${g("dayPeriod")}`;
};

// Turns "[Name wrote]\n...text...\n\n" (what the (Q) button adds) into speech bubbles.
function renderBody(text: string) {
  const out: ReactNode[] = [];
  const re = /\[([^\]\n]{1,40}) wrote\]\n([\s\S]*?)(?:\n\n|$)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(<span key={k++}>{text.slice(last, m.index)}</span>);
    out.push(
      <div key={k++} style={{ margin: "2px 0 10px" }}>
        <div
          style={{
            padding: "7px 11px",
            borderRadius: 14,
            background: "linear-gradient(180deg, #f2f2f2, #c9c9c9)",
            color: "#1d1d1d",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word"
          }}
        >
          {m[2]}
        </div>
        <div style={{ textAlign: "right", fontSize: SIZE.row, color: "#cfc6ad", padding: "2px 10px 0" }}>{m[1]} said</div>
      </div>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(<span key={k++}>{text.slice(last)}</span>);
  return out;
}

export default function ForumBoard({
  category,
  title,
  isAdmin,
  playerId
}: {
  category: ForumCategory;
  title: string;
  isAdmin: boolean;
  playerId: string;
}) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selected, setSelected] = useState<Topic | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");
  const [postPage, setPostPage] = useState(0);

  const loadTopics = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/forum?category=${category}`, { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not load the forum.");
      setTopics(d.topics ?? []);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the forum.");
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  async function openTopic(id: string) {
    setError("");
    try {
      const r = await fetch(`/api/forum/topic/${id}`, { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not open that topic.");
      setSelected(d.topic);
      setPostPage(0);
      setReply("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open that topic.");
    }
  }

  async function createTopic() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/forum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, title: subject, body })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error || "Could not add the topic.");
        return;
      }
      setSubject("");
      setBody("");
      setShowNew(false);
      setPage(0);
      await loadTopics();
      if (d.topic?.id) await openTopic(d.topic.id);
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/forum/${selected.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error || "Could not add the reply.");
        return;
      }
      setReply("");
      await openTopic(selected.id);
      await loadTopics();
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function moderate(values: { pinned?: boolean; locked?: boolean }) {
    if (!selected) return;
    setError("");
    try {
      const r = await fetch(`/api/forum/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error || "That did not work.");
        return;
      }
      setSelected({ ...selected, ...d.topic });
      await loadTopics();
    } catch {
      setError("Unable to connect. Please try again.");
    }
  }

  async function deleteTopic() {
    if (!selected) return;
    if (!window.confirm("Delete this topic and all its replies?")) return;
    setError("");
    try {
      const r = await fetch(`/api/forum/${selected.id}`, { method: "DELETE" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error || "Could not delete the topic.");
        return;
      }
      setSelected(null);
      await loadTopics();
    } catch {
      setError("Unable to connect. Please try again.");
    }
  }

  const quote = (author: string, text: string) => {
    const short = text.length > 300 ? text.slice(0, 300) + "…" : text;
    setReply((cur) => `${cur}${cur ? "\n" : ""}[${author} wrote]\n${short}\n\n`);
  };

  const shown = topics.filter((t) =>
    search ? t.title.toLowerCase().includes(search.toLowerCase()) : true
  );
  const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE));
  const pageNo = Math.min(page, pages - 1);
  const rows = shown.slice(pageNo * PER_PAGE, pageNo * PER_PAGE + PER_PAGE);

  const postCard = (key: string, n: number, author: string, text: string, when: string) => (
    <div key={key} style={{ border: "1px solid #6b5d3a", background: "#1f2a25", marginBottom: 8 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          padding: "3px 6px",
          fontSize: SIZE.name,
          background: "#2a382f",
          borderBottom: "1px solid #6b5d3a"
        }}
      >
        <span>
          <a href={`/profile/${encodeURIComponent(author)}`} style={{ color: "#f7efdb", fontWeight: 700, textDecoration: "none" }}>
            {author}
          </a>{" "}
          <button
            type="button"
            aria-label={`Quote ${author}`}
            title="Quote"
            onClick={() => quote(author, text)}
            style={{ ...linkButton, textDecoration: "none", color: "#b7ad93" }}
          >
            (Q)
          </button>
        </span>
        <span style={{ fontStyle: "italic", color: "#8f8873" }}>#{n}</span>
      </div>
      <div style={{ padding: "7px 8px", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: SIZE.body, lineHeight: 1.35, color: "#e8dfc8" }}>
        {renderBody(text)}
      </div>
      <div style={{ margin: "0 4px 4px", padding: "5px 8px", textAlign: "right", fontSize: SIZE.small, color: "#9a937d", background: "#17201c" }}>
        {when}
      </div>
    </div>
  );

  // Newest reply first, the original post last (#1), as on Bootleggers.
  const thread = selected
    ? [
        ...selected.posts.map((p, i) => ({ id: p.id, n: i + 2, author: p.author.username, text: p.body, at: p.createdAt })),
        { id: "op", n: 1, author: selected.author.username, text: selected.body, at: selected.createdAt }
      ].reverse()
    : [];
  const postPages = Math.max(1, Math.ceil(thread.length / POSTS_PER_PAGE));
  const postPageNo = Math.min(postPage, postPages - 1);
  const postRows = thread.slice(postPageNo * POSTS_PER_PAGE, postPageNo * POSTS_PER_PAGE + POSTS_PER_PAGE);

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0, fontSize: SIZE.row }}>
      {error && (
        <p className="notice" style={{ margin: "0 0 6px", color: "#f09a8c" }}>
          {error}
        </p>
      )}

      {/* ---------- A TOPIC ---------- */}
      {selected && (
        <>
          <div style={bar}>
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setError("");
              }}
              style={{ ...linkButton, position: "absolute", left: 8, top: 6, fontSize: SIZE.name, color: "#f7efdb", textDecoration: "none" }}
            >
              « Topics
            </button>
            <span style={{ display: "block", padding: "0 60px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {selected.pinned ? "★ " : ""}
              {selected.title}
              {selected.locked ? " 🔒" : ""}
            </span>
          </div>

          <div style={{ ...panel, borderTop: "0" }}>
            {selected.locked ? (
              <p style={{ margin: 0, fontSize: SIZE.name, color: "#b7ad93", textAlign: "center" }}>This discussion has been locked.</p>
            ) : (
              <>
                <textarea
                  aria-label="Your reply"
                  rows={5}
                  maxLength={5000}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  style={whiteBox}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", margin: "6px 4px 0" }}>
                  <button
                    type="button"
                    style={{ ...blueButton, opacity: busy || !reply.trim() ? 0.55 : 1 }}
                    disabled={busy || !reply.trim()}
                    onClick={sendReply}
                  >
                    Add!
                  </button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 6, marginTop: 4 }}>
                  {EMOTICONS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      aria-label={`Add ${e}`}
                      onClick={() => setReply((cur) => cur + e)}
                      style={{ ...linkButton, textDecoration: "none", fontSize: 20, lineHeight: 1.2 }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {(isAdmin || selected.authorId === playerId) && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "6px 0" }}>
              {isAdmin && (
                <>
                  <button className="button secondary" style={{ padding: "4px 10px", fontSize: SIZE.name }} onClick={() => moderate({ pinned: !selected.pinned })}>
                    {selected.pinned ? "Unpin" : "Pin"}
                  </button>
                  <button className="button secondary" style={{ padding: "4px 10px", fontSize: SIZE.name }} onClick={() => moderate({ locked: !selected.locked })}>
                    {selected.locked ? "Unlock" : "Lock"}
                  </button>
                </>
              )}
              <button className="button secondary" style={{ padding: "4px 10px", fontSize: SIZE.name }} onClick={deleteTopic}>
                Delete topic
              </button>
            </div>
          )}

          <div style={{ marginTop: 8 }}>
            {postRows.map((p) => postCard(p.id, p.n, p.author, p.text, stamp(p.at)))}
          </div>

          {postPages > 1 && (
            <div style={{ textAlign: "center", fontSize: SIZE.name, color: "#d4cab2", padding: "4px 0 8px" }}>
              Page
              <br />
              <select
                aria-label="Page"
                value={postPageNo}
                onChange={(e) => setPostPage(Number(e.target.value))}
                style={{ ...field, display: "inline-block", width: "auto", padding: "2px 8px", marginTop: 3 }}
              >
                {Array.from({ length: postPages }, (_, i) => (
                  <option key={i} value={i}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      {/* ---------- THE TOPIC LIST ---------- */}
      {!selected && (
        <>
          {showNew && (
            <>
              <div style={bar}>New topic</div>
              <div style={panel}>
                <label style={{ fontSize: SIZE.name, color: "#d4cab2" }}>Subject:</label>
                {category === "CLASSIFIEDS" && (
                  <select
                    aria-label="Listing type"
                    defaultValue=""
                    onChange={(e) => {
                      const prefix = e.target.value + ": ";
                      setSubject((cur) =>
                        /^(Buying|Selling|Trading): /.test(cur) ? prefix + cur.replace(/^[A-Za-z]+: /, "") : prefix + cur
                      );
                    }}
                    style={{ ...field, margin: "4px 0", height: 34 }}
                  >
                    <option value="" disabled>
                      Listing type (optional)
                    </option>
                    <option value="Buying">Buying</option>
                    <option value="Selling">Selling</option>
                    <option value="Trading">Trading</option>
                  </select>
                )}
                <input
                  aria-label="Subject"
                  value={subject}
                  maxLength={100}
                  onChange={(e) => setSubject(e.target.value)}
                  style={{ ...field, height: 34, margin: "4px 0 6px" }}
                />
                <label style={{ fontSize: SIZE.name, color: "#d4cab2" }}>Message:</label>
                <textarea
                  aria-label="Message"
                  rows={6}
                  maxLength={5000}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  style={{ ...whiteBox, margin: "4px 0 6px" }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                  <button type="button" className="button secondary" style={{ padding: "3px 14px", fontSize: 13, borderRadius: 14 }} onClick={() => setShowNew(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    style={{ ...blueButton, opacity: busy || subject.trim().length < 3 || body.trim().length < 3 ? 0.55 : 1 }}
                    disabled={busy || subject.trim().length < 3 || body.trim().length < 3}
                    onClick={createTopic}
                  >
                    Add!
                  </button>
                </div>
              </div>
            </>
          )}

          <div style={{ ...bar, marginTop: showNew ? 6 : 0 }}>
            {title} (
            <button type="button" onClick={() => setShowNew((v) => !v)} style={{ ...linkButton, color: "#f7efdb" }}>
              {showNew ? "Cancel" : "Add topic"}
            </button>
            )
            <button
              type="button"
              aria-label="Refresh"
              onClick={loadTopics}
              style={{ ...linkButton, position: "absolute", right: 10, top: 4, fontSize: 18, color: "#f7efdb", textDecoration: "none" }}
            >
              ⟳
            </button>
          </div>

          <div style={{ border: "1px solid #6b5d3a", borderTop: 0, background: "#1f2a25", padding: "3px 3px 0" }}>
            {loading ? (
              <p style={{ margin: 0, padding: 10, fontSize: SIZE.row, color: "#b7ad93", textAlign: "center" }}>Loading…</p>
            ) : rows.length === 0 ? (
              <p style={{ margin: 0, padding: 10, fontSize: SIZE.row, color: "#b7ad93", textAlign: "center" }}>
                {search ? "Nothing matches that search." : "No topics yet. Be the first to start one."}
              </p>
            ) : (
              rows.map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openTopic(t.id)}
                  style={{
                    display: "flex",
                    width: "100%",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "5px 6px",
                    margin: 0,
                    border: 0,
                    background: i % 2 === 0 ? "#2a382f" : "#222e27",
                    color: "#f1e8d3",
                    fontSize: SIZE.row,
                    fontFamily: "inherit",
                    lineHeight: 1.25,
                    textAlign: "left",
                    cursor: "pointer"
                  }}
                >
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.pinned ? "★ " : ""}
                    {t.title}
                    {t.locked ? " 🔒" : ""}
                  </span>
                  <span style={{ flexShrink: 0, color: "#cfc6ad" }}>{t._count.posts}</span>
                </button>
              ))
            )}

            <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 22px 14px", fontSize: SIZE.name, minHeight: 20 }}>
              <span>
                {pageNo > 0 && (
                  <button type="button" onClick={() => setPage(pageNo - 1)} style={{ ...linkButton, textDecoration: "none", color: "#f7efdb" }}>
                    Prev
                  </button>
                )}
              </span>
              <span>
                {pageNo < pages - 1 && (
                  <button type="button" onClick={() => setPage(pageNo + 1)} style={{ ...linkButton, textDecoration: "none", color: "#f7efdb" }}>
                    Next
                  </button>
                )}
              </span>
            </div>
          </div>

          <div style={{ ...bar, marginTop: 6 }}>Search</div>
          <div style={{ ...panel, display: "flex", gap: 6, alignItems: "center" }}>
            <input
              aria-label="Search topics"
              placeholder="Search for…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setSearch(query.trim());
                  setPage(0);
                }
              }}
              style={{ ...field, flex: 1, minWidth: 0, height: 32, borderRadius: 8 }}
            />
            <button
              type="button"
              style={{ ...blueButton, padding: "3px 14px", flexShrink: 0 }}
              onClick={() => {
                setSearch(query.trim());
                setPage(0);
              }}
            >
              Search!
            </button>
          </div>
        </>
      )}
    </div>
  );
}
