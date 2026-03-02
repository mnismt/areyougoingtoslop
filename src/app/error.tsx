"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SiteFooter } from "@/app/components/site-footer";

const messages = [
  {
    headline: "something broke. we'd blame the AI,",
    body: "but the irony would be too much to bear.",
    signal: "slop_score: pending",
  },
  {
    headline: "the server threw an exception.",
    body: "unlike most commits here, this one wasn't AI-generated.",
    signal: "origin: suspiciously human",
  },
  {
    headline: "our scoring model briefly achieved sentience,",
    body: "assessed the situation, and gave up.",
    signal: "status: existential_crisis",
  },
  {
    headline: "an unhandled exception occurred.",
    body: "the AI says it wasn't its fault. classic.",
    signal: "blame: unresolved · pr: open",
  },
  {
    headline: "the server had a moment of genuine human error.",
    body: "refreshing, honestly. in the worst possible way.",
    signal: "confidence: rock_bottom",
  },
];

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    console.error(error);
  }, [error]);

  useEffect(() => {
    setIdx(Math.floor(Math.random() * messages.length));
    const t = setTimeout(() => {
      setVisible(true);
      setEntered(true);
    }, 200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!entered) return;
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % messages.length);
        setVisible(true);
      }, 450);
    }, 5500);
    return () => clearInterval(timer);
  }, [entered]);

  const msg = messages[idx];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-6 sm:px-6 sm:py-16">
      <section className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p
          className="font-mono text-xs text-muted-foreground uppercase tracking-widest animate-rise"
          style={{ animationDelay: "0ms" }}
        >
          signal: unhandled_exception
        </p>

        <h1
          className="text-8xl font-bold text-primary animate-rise"
          style={{ animationDelay: "80ms" }}
        >
          500
        </h1>

        <div
          className="flex flex-col gap-1 transition-all duration-500 ease-in-out"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(-6px)",
          }}
        >
          <p className="text-xl">{msg.headline}</p>
          <p className="text-xl text-muted-foreground">{msg.body}</p>
        </div>

        <p
          className="font-mono text-xs text-muted-foreground transition-all duration-500 ease-in-out"
          style={{
            opacity: visible ? 1 : 0,
            transitionDelay: visible ? "60ms" : "0ms",
          }}
        >
          {msg.signal}
        </p>

        <div
          className="flex items-center gap-6 mt-4 animate-rise"
          style={{ animationDelay: "320ms" }}
        >
          <button
            onClick={reset}
            className="group relative font-mono text-sm text-primary"
          >
            ↺ try again
            <span className="absolute -bottom-1 left-0 h-[1px] w-0 bg-primary transition-all duration-300 group-hover:w-full" />
          </button>
          <Link
            href="/"
            className="group relative font-mono text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            ← go home
            <span className="absolute -bottom-1 left-0 h-[1px] w-0 bg-foreground transition-all duration-300 group-hover:w-full" />
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
