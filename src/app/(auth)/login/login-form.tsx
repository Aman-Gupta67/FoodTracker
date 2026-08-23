"use client";

import { useState } from "react";
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
    <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-3">
      <input
        type="tel"
        required
        autoFocus
        placeholder="Mobile number"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="h-10 field-input"
      />
      <Button type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Signing in…" : "Continue"}
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
