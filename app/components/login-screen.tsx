"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export function LoginScreen() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const sendCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    setLoading(true);
    setError("");
    setMessage("");

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: false,
      },
    });

    if (signInError) {
      setError("Kunne ikke sende kode lige nu");
    } else {
      setStep("code");
      setMessage("Koden er sendt. Tjek din email.");
    }

    setLoading(false);
  };

  const handleSendCodeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await sendCode();
  };

  const handleVerifyCodeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.trim();
    if (!normalizedEmail || !normalizedCode) {
      setError("Indtast den kode du modtog på email");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: normalizedCode,
      type: "email",
    });

    if (verifyError) {
      setError("Koden er ugyldig eller udløbet");
    }

    setLoading(false);
  };

  return (
    <main className="mx-auto flex h-full min-h-0 w-full max-w-sm flex-1 flex-col justify-center px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="rounded-2xl border border-line-soft/45 bg-white/80 p-5 shadow-[0_20px_50px_-35px_rgba(15,42,29,0.4)] backdrop-blur-sm">
        {step === "email" ? (
          <>
            <h1 className="text-[22px] font-bold tracking-tight text-evergreen">
              Log ind
            </h1>
            <p className="mt-1 text-[13px] text-evergreen/70">
              Få en engangskode sendt til din email
            </p>

            <form className="mt-5 space-y-3" onSubmit={handleSendCodeSubmit}>
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
                {loading ? "Sender..." : "Send kode"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-[22px] font-bold tracking-tight text-evergreen">
              Indtast kode
            </h1>
            <p className="mt-1 text-[13px] text-evergreen/70">
              Vi har sendt en kode til {email.trim().toLowerCase()}
            </p>

            <form className="mt-5 space-y-3" onSubmit={handleVerifyCodeSubmit}>
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-forest">
                  Kode
                </span>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  className="w-full rounded-xl border border-line-soft/70 bg-white px-3 py-2.5 text-[14px] text-forest outline-none focus:ring-2 focus:ring-accent/35"
                  required
                />
              </label>

              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="w-full rounded-xl bg-accent px-3 py-2.5 text-[14px] font-semibold text-white shadow-[0_12px_30px_-18px_rgba(76,167,113,0.75)] transition-colors hover:bg-accent-mid disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Logger ind..." : "Log ind"}
              </button>
            </form>

            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={sendCode}
                disabled={loading}
                className="text-[12px] font-semibold text-evergreen/80 hover:text-forest disabled:opacity-50"
              >
                Send ny kode
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError("");
                  setMessage("");
                }}
                disabled={loading}
                className="text-[12px] font-semibold text-evergreen/70 hover:text-forest disabled:opacity-50"
              >
                Skift email
              </button>
            </div>
          </>
        )}

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
