"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";

export type ForumCategory = "OFFICIAL" | "CLASSIFIEDS" | "OFF_TOPIC";

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

const bar: CSSProperties = {
  position: "relative",
  padding: "6px 8px",
  textAlign: "center",
  fontFamily: "Georgia, serif",
  fontSize: 15,
  color: "#f7efdb",
  background: "linear-gradient(180deg, #8a7038, #4d3d1c)",
  borderTop: "1px solid #b0904a",
  borderBottom: "1px solid #b0904a",
  textShadow: "0 1px 2px #000"
};

const panel: CSSProperties = {
  border: "1px solid #6b5d3a",
  borderTop: 0,
  background: "#1f2a25",
  padding: 8
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
  fontSize: 16,
  fontFamily: "inherit"
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

const stamp = (value: string) =>
  new Date(value).toLocaleString("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

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

  const postCard = (key: string, author: string, text: string, when: string, original = false) => (
    <div key={key} style={{ border: "1px solid #6b5d3a", background: "#1f2a25", marginBottom: 6 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          padding: "4px 8px",
          fontSize: 13,
          background: original ? "linear-gradient(180deg, #5c4a22, #3a2f16)" : "#26332c",
          borderBottom: "1px solid #6b5d3a"
        }}
      >
        <span>
          <a
            href={`/profile/${encodeURIComponent(author)}`}
            style={{ color: "#f7efdb", fontWeight: 700, textDecoration: "none" }}
          >
            {author}
          </a>
        </span>
        <button
          type="button"
          aria-label={`Quote ${author}`}
          title="Quote"
          onClick={() => quote(author, text)}
          style={{ ...linkButton, textDecoration: "none", color: "#b7ad93" }}
        >
          (Q)
        </button>
      </div>
      <div style={{ padding: "8px 10px", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 14, lineHeight: 1.45, color: "#e4dac3" }}>
        {text}
      </div>
      <div style={{ padding: "3px 8px", textAlign: "right", fontSize: 11, color: "#8a8470", background: "#17201c" }}>
        {when}
      </div>
    </div>
  );

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", minWidth: 0 }}>
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
              style={{ ...linkButton, position: "absolute", left: 8, top: 7, fontSize: 13, color: "#f7efdb", textDecoration: "none" }}
            >
              « Topics
            </button>
            <span style={{ display: "block", padding: "0 56px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {selected.pinned ? "★ " : ""}
              {selected.title}
              {selected.locked ? " 🔒" : ""}
            </span>
          </div>

          <div style={{ ...panel, paddingBottom: 2 }}>
            {postCard("op", selected.author.username, selected.body, stamp(selected.createdAt), true)}
            {selected.posts.map((p) => postCard(p.id, p.author.username, p.body, stamp(p.createdAt)))}

            {(isAdmin || selected.authorId === playerId) && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "0 0 8px" }}>
                {isAdmin && (
                  <>
                    <button className="button secondary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => moderate({ pinned: !selected.pinned })}>
                      {selected.pinned ? "Unpin" : "Pin"}
                    </button>
                    <button className="button secondary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => moderate({ locked: !selected.locked })}>
                      {selected.locked ? "Unlock" : "Lock"}
                    </button>
                  </>
                )}
                <button className="button secondary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={deleteTopic}>
                  Delete topic
                </button>
              </div>
            )}
          </div>

          <div style={{ ...bar, marginTop: 6 }}>Add reply</div>
          <div style={panel}>
            {selected.locked ? (
              <p style={{ margin: 0, fontSize: 13, color: "#b7ad93", textAlign: "center" }}>
                This discussion has been locked.
              </p>
            ) : (
              <>
                <textarea
                  aria-label="Your reply"
                  rows={5}
                  maxLength={5000}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  style={{ ...field, resize: "vertical" }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                  <button
                    className="button"
                    style={{ padding: "6px 22px", fontSize: 13, opacity: busy || !reply.trim() ? 0.55 : 1 }}
                    disabled={busy || !reply.trim()}
                    onClick={sendReply}
                  >
                    Add!
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* ---------- THE TOPIC LIST ---------- */}
      {!selected && (
        <>
          {showNew && (
            <>
              <div style={bar}>New topic</div>
              <div style={panel}>
                <label style={{ fontSize: 13, color: "#d4cab2" }}>Subject:</label>
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
                <label style={{ fontSize: 13, color: "#d4cab2" }}>Message:</label>
                <textarea
                  aria-label="Message"
                  rows={6}
                  maxLength={5000}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  style={{ ...field, margin: "4px 0 6px", resize: "vertical" }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                  <button className="button secondary" style={{ padding: "6px 14px", fontSize: 13 }} onClick={() => setShowNew(false)}>
                    Cancel
                  </button>
                  <button
                    className="button"
                    style={{ padding: "6px 22px", fontSize: 13, opacity: busy || subject.trim().length < 3 || body.trim().length < 3 ? 0.55 : 1 }}
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
              style={{ ...linkButton, position: "absolute", right: 10, top: 5, fontSize: 17, color: "#f7efdb", textDecoration: "none" }}
            >
              ⟳
            </button>
          </div>

          <div style={{ border: "1px solid #6b5d3a", borderTop: 0 }}>
            {loading ? (
              <p style={{ margin: 0, padding: 10, fontSize: 13, color: "#b7ad93", textAlign: "center" }}>Loading…</p>
            ) : rows.length === 0 ? (
              <p style={{ margin: 0, padding: 10, fontSize: 13, color: "#b7ad93", textAlign: "center" }}>
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
                    padding: "8px 8px",
                    border: 0,
                    borderBottom: "1px solid #2b3630",
                    background: i % 2 === 0 ? "#1f2a25" : "#18211d",
                    color: "#f1e8d3",
                    fontSize: 14,
                    textAlign: "left",
                    cursor: "pointer"
                  }}
                >
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.pinned ? "★ " : ""}
                    {t.title}
                    {t.locked ? " 🔒" : ""}
                  </span>
                  <span style={{ flexShrink: 0, color: "#b7ad93" }}>{t._count.posts}</span>
                </button>
              ))
            )}

            {pages > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", fontSize: 13, background: "#1f2a25" }}>
                <button type="button" disabled={pageNo === 0} onClick={() => setPage(pageNo - 1)} style={{ ...linkButton, textDecoration: "none", opacity: pageNo === 0 ? 0.4 : 1 }}>
                  « Prev
                </button>
                <span style={{ color: "#b7ad93" }}>
                  Page {pageNo + 1} of {pages}
                </span>
                <button type="button" disabled={pageNo >= pages - 1} onClick={() => setPage(pageNo + 1)} style={{ ...linkButton, textDecoration: "none", opacity: pageNo >= pages - 1 ? 0.4 : 1 }}>
                  Next »
                </button>
              </div>
            )}
          </div>

          <div style={{ ...bar, marginTop: 6 }}>Search</div>
          <div style={{ ...panel, display: "flex", gap: 6, alignItems: "center" }}>
            <label style={{ fontSize: 13, color: "#d4cab2", flexShrink: 0 }}>Search for:</label>
            <input
              aria-label="Search topics"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setSearch(query.trim());
                  setPage(0);
                }
              }}
              style={{ ...field, flex: 1, minWidth: 0, height: 32 }}
            />
            <button
              className="button"
              style={{ padding: "5px 12px", fontSize: 12, flexShrink: 0 }}
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
