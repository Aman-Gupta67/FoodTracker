"use client";

import { useState } from "react";
import { Phone, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/error";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState(initialError ?? "");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/auth/phone-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const body = await res.json();
      if (!res.ok) {
        setErrorMessage(body.error ?? "Something went wrong.");
        setStatus("error");
        return;
      }
      // Full navigation so middleware sees the session cookie the API
      // route just set — a client-side route change could race it.
      window.location.href = "/";
    } catch (e) {
      setErrorMessage(getErrorMessage(e));
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
      <div className="flex h-14 items-center gap-2.5 rounded-2xl border-[1.5px] border-stone-200 px-4 focus-within:border-primary-500 focus-within:shadow-[0_0_0_3px_var(--color-primary-100)]">
        <Phone size={20} className="text-stone-400" />
        <input
          type="tel"
          required
          autoFocus
          placeholder="Mobile number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="h-full flex-1 border-none bg-transparent text-base text-stone-900 outline-none placeholder:text-stone-400"
        />
      </div>
      <Button
        type="submit"
        disabled={status === "loading"}
        className="h-[52px] w-full gap-2 rounded-2xl text-base font-bold shadow-glow"
      >
        {status === "loading" ? "Signing in…" : "Continue"}
        {status !== "loading" ? <ArrowRight size={18} /> : null}
      </Button>
      {errorMessage ? (
        <p className="text-sm text-red-600">{errorMessage}</p>
      ) : null}
      <p className="text-center text-xs text-stone-400">
        No verification — this number is your account. Keep it private.
      </p>
    </form>
  );
}
