"use client";

import { CopyIcon } from "lucide-react";

import { toast } from "@/components/ui/toast";

export function CopyPasswordButton({ password }: { password: string }) {
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(password);
      toast.add({ title: "Copied to clipboard", type: "success" });
    } catch {
      toast.add({ title: "Couldn't copy to clipboard", type: "error" });
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copy password"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        width: 36,
        height: 36,
        borderRadius: "100px",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.04)",
        color: "#f0efe8",
        cursor: "pointer",
      }}
    >
      <CopyIcon size={15} />
    </button>
  );
}
