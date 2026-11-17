
"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export default function AuthForm({
  mode
}: {
  mode: "login" | "register";
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);

    const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(form.entries());

    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      setBusy(false);

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }

      window.location.href = "/";
    } catch {
      setBusy(false);
      setError("Unable to connect. Please try again.");
    }
  }

  return (
    <main className="auth-wrap">
      <form className="auth-panel" onSubmit={submit}>
        <Link href="/" className="back-link">
          ← Rumrunners
        </Link>

        <p className="eyebrow">BRITAIN · 1933</p>

        <h1>
          {mode === "login"
            ? "Return to the streets"
            : "Make your name"}
        </h1>

        {mode === "register" && (
          <label>
            Username
            <input
              name="username"
              minLength={3}
              maxLength={18}
              required
              autoComplete="username"
            />
          </label>
        )}

        <label>
          Email address
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
          />
        </label>

        <label>
          Password
          <input
            name="password"
            type="password"
            minLength={mode === "register" ? 10 : 1}
            required
            autoComplete={
              mode === "login"
                ? "current-password"
                : "new-password"
            }
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button className="button" disabled={busy}>
          {busy
            ? "Please wait…"
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </button>

        <p className="auth-switch">
          {mode === "login"
            ? "New to the city?"
            : "Already have an account?"}{" "}
          <Link
            href={
              mode === "login"
                ? "/register"
                : "/login"
            }
          >
            {mode === "login"
              ? "Create an account"
              : "Sign in"}
          </Link>
        </p>
      </form>
    </main>
  );
}
