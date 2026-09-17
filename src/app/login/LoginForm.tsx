"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LAST_ROLE_COOKIE } from "@/lib/supabase/offline";

const DEMO_ACCOUNTS = [
  { role: "Farmer", email: "farmer@example.com", who: "Johannes Beukes — Brakwater Smallholding" },
  { role: "Agronomist", email: "agronomist@example.com", who: "Dr. Selma Nghoshi — Khomas Agri Advisory" },
  { role: "Bank / Valuation", email: "bank@example.com", who: "Pieter van Wyk — Agribank of Namibia" },
];

const DEMO_PASSWORD = "FisDemo2026!";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(withEmail: string, withPassword: string) {
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: withEmail,
      password: withPassword,
    });

    if (!authError && data.user) {
      // Remember the role so the dashboard can still render the right view if
      // Supabase becomes unreachable later in the demo. Not a security control
      // — the server only trusts it when it already has a valid session cookie.
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();
      document.cookie = `${LAST_ROLE_COOKIE}=${profile?.role ?? "farmer"}; path=/; max-age=86400; samesite=lax`;
    }

    if (authError) {
      setError(
        authError.message === "Invalid login credentials"
          ? "That email and password don't match a demo account."
          : authError.message,
      );
      setBusy(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
            Farm Information System
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">Sign in to the demo</h1>
          <p className="mt-1.5 text-sm text-muted">
            Satellite-derived soil, vegetation and rainfall insight for Namibian agriculture.
          </p>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void signIn(email, password);
          }}
          className="rounded-lg border border-border bg-surface p-5 shadow-sm"
        >
          <label className="block text-sm font-medium" htmlFor="email">
            Email
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>

          <label className="mt-4 block text-sm font-medium" htmlFor="password">
            Password
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>

          {error ? (
            <p role="alert" className="mt-3 rounded-md bg-action/10 px-3 py-2 text-sm text-action">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="mt-5 w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-5 rounded-lg border border-dashed border-border bg-surface-muted p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Demo accounts</p>
          <p className="mt-1 text-xs text-muted">
            Each role sees a different dashboard. Password for all three:{" "}
            <code className="rounded bg-surface px-1 py-0.5 font-mono">{DEMO_PASSWORD}</code>
          </p>
          <ul className="mt-3 space-y-1.5">
            {DEMO_ACCOUNTS.map((account) => (
              <li key={account.email}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(DEMO_PASSWORD);
                    void signIn(account.email, DEMO_PASSWORD);
                  }}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-left text-sm transition-colors hover:border-brand disabled:opacity-60"
                >
                  <span className="font-medium">{account.role}</span>
                  <span className="block text-xs text-muted">{account.who}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
