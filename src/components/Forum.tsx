
"use client";

import { useEffect, useState, type FormEvent } from "react";

type Category = "OFFICIAL" | "CLASSIFIEDS" | "OFF_TOPIC";

type Post = {
  id: string;
  body: string;
  createdAt: string;
  author: { username: string };
};

type Topic = {
  id: string;
  authorId: string;
  category: Category;
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

const sections: {
  id: Category;
  title: string;
  description: string;
}[] = [
  {
    id: "OFFICIAL",
    title: "Official",
    description: "Announcements, updates and notices from the Rumrunners team."
  },
  {
    id: "CLASSIFIEDS",
    title: "Classifieds",
    description: "Buy, sell and trade with other players."
  },
  {
    id: "OFF_TOPIC",
    title: "Off Topic",
    description: "The public house. Talk about anything beyond the game."
  }
];

function stamp(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export default function Forum({
  isAdmin = false,
  playerId,
  initialCategory = "OFFICIAL"
}: {
  isAdmin?: boolean;
  playerId: string;
  initialCategory?: Category;
}) {
  const [category, setCategory] = useState<Category>(initialCategory);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selected, setSelected] = useState<Topic | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");

  async function loadTopics(section: Category = category) {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/forum?category=${section}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load the forum.");
      }

      setTopics(data.topics);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load the forum."
      );
    } finally {
      setLoading(false);
    }
  }

  async function openTopic(topic: Topic) {
    setSelected(topic);
    setError("");

    try {
      const response = await fetch(
        `/api/forum/topic/${topic.id}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not open topic.");
      }

      setSelected(data.topic);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not open topic."
      );
    }
  }

  useEffect(() => {
    loadTopics(category);
  }, [category]);

  useEffect(() => {
    setCategory(initialCategory);
    setSelected(null);
    setShowNew(false);
  }, [initialCategory]);

  async function createTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    try {
      const response = await fetch("/api/forum", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          category,
          title,
          body
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Could not create topic.");
        return;
      }

      setTitle("");
      setBody("");
      setShowNew(false);
      setSelected(null);

      await loadTopics(category);
    } catch {
      setError("Unable to connect. Please try again.");
    }
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selected) return;

    setError("");

    try {
      const response = await fetch(
        `/api/forum/${selected.id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ body: reply })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Could not post reply.");
        return;
      }

      setReply("");

      const refreshed = await fetch(
        `/api/forum/topic/${selected.id}`
      );

      const refreshedData = await refreshed.json();

      if (refreshed.ok) {
        setSelected(refreshedData.topic);
      }

      await loadTopics(category);
    } catch {
      setError("Unable to post your reply.");
    }
  }

  async function moderate(values: {
    pinned?: boolean;
    locked?: boolean;
  }) {
    if (!selected) return;

    setError("");

    try {
      const response = await fetch(
        `/api/forum/${selected.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(values)
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Moderation action failed.");
        return;
      }

      setSelected({
        ...selected,
        ...data.topic
      });

      await loadTopics(category);
    } catch {
      setError("Unable to update this topic.");
    }
  }

  async function deleteTopic() {
    if (!selected) return;

    if (!window.confirm("Delete this topic and all its replies?")) {
      return;
    }

    setError("");

    try {
      const response = await fetch(
        `/api/forum/${selected.id}`,
        {
          method: "DELETE"
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Could not delete topic.");
        return;
      }

      setSelected(null);
      await loadTopics(category);
    } catch {
      setError("Unable to delete this topic.");
    }
  }

  const active = sections.find(
    section => section.id === category
  )!;

  return (
    <section className="forum">

      <div className="forum-sections">
        {sections.map(section => (
          <button
            key={section.id}
            className={
              `forum-section ${
                category === section.id ? "active" : ""
              }`
            }
            onClick={() => {
              setCategory(section.id);
              setSelected(null);
              setShowNew(false);
              setError("");
            }}
          >
            <strong>{section.title}</strong>
            <small>{section.description}</small>
          </button>
        ))}
      </div>

      <div className="forum-toolbar">
        <div>
          <h2>
            {selected ? selected.title : active.title}
          </h2>

          <p>
            {selected
              ? `Started by ${selected.author.username} · ${stamp(selected.createdAt)}`
              : active.description}
          </p>
        </div>

        {!selected && (
          (category !== "OFFICIAL" || isAdmin) && (
            <button
              className="button"
              onClick={() => setShowNew(!showNew)}
            >
              {showNew ? "Cancel" : "New topic"}
            </button>
          )
        )}

        {selected && (
          <button
            className="forum-back"
            onClick={() => {
              setSelected(null);
              setError("");
            }}
          >
            ← All topics
          </button>
        )}
      </div>

      {error && (
        <p className="forum-error">{error}</p>
      )}

      {showNew && (
        <form
          className="forum-form"
          onSubmit={createTopic}
        >
          <label>
            Topic title

            <input
              value={title}
              onChange={event => setTitle(event.target.value)}
              maxLength={100}
              minLength={3}
              required
            />
          </label>

          {category === "CLASSIFIEDS" && (
            <label>
              Listing type

              <select
                defaultValue=""
                onChange={event => {
                  const prefix = event.target.value + ": ";
                  setTitle(current =>
                    current.startsWith("Buying: ") ||
                    current.startsWith("Selling: ") ||
                    current.startsWith("Trading: ")
                      ? prefix + current.substring(current.indexOf(": ") + 2)
                      : prefix + current
                  );
                }}
              >
                <option value="" disabled>
                  Choose a type (optional)
                </option>
                <option value="Buying">Buying</option>
                <option value="Selling">Selling</option>
                <option value="Trading">Trading</option>
              </select>
            </label>
          )}

          <label>
            Message

            <textarea
              value={body}
              onChange={event => setBody(event.target.value)}
              maxLength={5000}
              rows={5}
              required
            />
          </label>

          <div className="forum-form-actions">
            <button className="button" type="submit">
              Publish topic
            </button>

            <button
              className="forum-back"
              type="button"
              onClick={() => setShowNew(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {selected ? (
        <div className="forum-thread">

          <article className="forum-post original">
            <div className="forum-post-meta">
              <b>{selected.author.username}</b>
              <span>{stamp(selected.createdAt)}</span>
            </div>

            <p>{selected.body}</p>
          </article>

          {selected.posts.map(post => (
            <article
              className="forum-post"
              key={post.id}
            >
              <div className="forum-post-meta">
                <b>{post.author.username}</b>
                <span>{stamp(post.createdAt)}</span>
              </div>

              <p>{post.body}</p>
            </article>
          ))}

          {isAdmin && (
            <div className="forum-mod">
              <button
                onClick={() =>
                  moderate({ pinned: !selected.pinned })
                }
              >
                {selected.pinned ? "Unpin topic" : "Pin topic"}
              </button>

              <button
                onClick={() =>
                  moderate({ locked: !selected.locked })
                }
              >
                {selected.locked ? "Unlock topic" : "Lock topic"}
              </button>
            </div>
          )}

          {selected.locked ? (
            <p className="forum-locked">
              This discussion has been locked.
            </p>
          ) : (
            <form
              className="forum-reply"
              onSubmit={sendReply}
            >
              <label htmlFor="forum-reply">
                Your reply
              </label>

              <textarea
                id="forum-reply"
                rows={4}
                value={reply}
                onChange={event => setReply(event.target.value)}
                maxLength={5000}
                required
              />

              <button className="button" type="submit">
                Post reply
              </button>
            </form>
          )}

          {(isAdmin || selected.authorId === playerId) && (
            <button
              className="forum-delete"
              onClick={deleteTopic}
            >
              Delete topic
            </button>
          )}
        </div>
      ) : (
        <div className="forum-topic-list">

          {loading ? (
            <p>Loading discussions…</p>
          ) : topics.length === 0 ? (
            <p className="forum-empty">
              No topics here yet. Be the first to start a discussion.
            </p>
          ) : (
            topics.map(topic => (
              <button
                className="forum-topic"
                key={topic.id}
                onClick={() => openTopic(topic)}
              >
                <span className="forum-topic-main">
                  <strong>
                    {topic.pinned ? "★ " : ""}
                    {topic.title}
                    {topic.locked ? " 🔒" : ""}
                  </strong>

                  <small>
                    Started by {topic.author.username} · {stamp(topic.createdAt)}
                  </small>
                </span>

                <span className="forum-topic-count">
                  {topic._count.posts} replies
                </span>
              </button>
            ))
          )}

        </div>
      )}

    </section>
  );
}
