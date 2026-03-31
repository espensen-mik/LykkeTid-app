"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError("");
    setMessage("");

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (signInError) {
      setError(signInError.message);
    } else {
      setMessage("Tjek din email for login-link.");
    }

    setLoading(false);
  };

  return (
    <main className="mx-auto flex h-full min-h-0 w-full max-w-sm flex-1 flex-col justify-center px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="rounded-2xl border border-line-soft/45 bg-white/80 p-5 shadow-[0_20px_50px_-35px_rgba(15,42,29,0.4)] backdrop-blur-sm">
        <h1 className="text-[22px] font-bold tracking-tight text-evergreen">
          LykkeTid
        </h1>
        <p className="mt-1 text-[13px] text-evergreen/70">
          Log ind med magic link for at fortsætte.
        </p>

        <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-forest">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              placeholder="dig@eksempel.dk"
              className="w-full rounded-xl border border-line-soft/70 bg-white px-3 py-2.5 text-[14px] text-forest outline-none focus:ring-2 focus:ring-accent/35"
              required
            />
          </label>

          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full rounded-xl bg-accent px-3 py-2.5 text-[14px] font-semibold text-white shadow-[0_12px_30px_-18px_rgba(76,167,113,0.75)] transition-colors hover:bg-accent-mid disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Sender..." : "Send login link"}
          </button>
        </form>

        {message ? (
          <p className="mt-3 text-[12px] font-medium text-accent">{message}</p>
        ) : null}
        {error ? (
          <p className="mt-3 text-[12px] font-medium text-rose-700">{error}</p>
        ) : null}
      </div>
    </main>
  );
}
