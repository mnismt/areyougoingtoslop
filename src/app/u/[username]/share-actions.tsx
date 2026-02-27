"use client";

import { useState } from "react";

type ShareActionsProps = {
  username: string;
};

const copyToClipboard = async (text: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
};

export default function ShareActions({ username }: ShareActionsProps) {
  const [copyState, setCopyState] = useState<"idle" | "done" | "error">("idle");
  const [downloadState, setDownloadState] = useState<"idle" | "busy" | "done">(
    "idle",
  );

  const handleCopy = async () => {
    try {
      await copyToClipboard(window.location.href);
      setCopyState("done");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("error");
    }
  };

  const handleDownload = async () => {
    if (downloadState === "busy") {
      return;
    }
    setDownloadState("busy");
    try {
      const response = await fetch(`/api/og/${username}`, {
        cache: "no-store",
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `areyougoingslop-${username}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setDownloadState("done");
      setTimeout(() => setDownloadState("idle"), 2000);
    } catch {
      setDownloadState("idle");
    }
  };

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={handleCopy}
        className="rounded-lg border border-[var(--border)] px-4 py-2 font-mono text-xs text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
      >
        {copyState === "done"
          ? "Link copied"
          : copyState === "error"
            ? "Copy failed"
            : "Copy link"}
      </button>
      <button
        type="button"
        onClick={handleDownload}
        className="rounded-lg border border-[var(--border)] px-4 py-2 font-mono text-xs text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
      >
        {downloadState === "done"
          ? "Card saved"
          : downloadState === "busy"
            ? "Saving..."
            : "Download card"}
      </button>
    </div>
  );
}
