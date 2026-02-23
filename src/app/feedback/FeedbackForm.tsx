"use client";

import { useState } from "react";

export default function FeedbackForm() {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!message.trim()) {
      setStatus("error");
      return;
    }
    setStatus("sending");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!response.ok) {
        throw new Error("Failed");
      }
      setMessage("");
      setStatus("sent");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-4 text-left"
    >
      <label className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
        Your feedback
      </label>
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        rows={5}
        placeholder="Tell us what felt fair, what felt off, and what to fix next."
        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/90 placeholder:text-white/35 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[rgba(241,90,41,0.35)]"
      />
      <button
        type="submit"
        className="h-11 rounded-full bg-[var(--accent)] px-6 text-xs font-semibold uppercase tracking-[0.2em] text-black transition hover:translate-y-[-1px] hover:shadow-[0_14px_40px_rgba(241,90,41,0.35)]"
      >
        {status === "sending"
          ? "Sending..."
          : status === "sent"
            ? "Thanks!"
            : "Send feedback"}
      </button>
      {status === "error" ? (
        <p className="text-xs text-[var(--accent-soft)]">
          Something went wrong. Try again.
        </p>
      ) : null}
    </form>
  );
}
