"use client";

import { Square, Volume2 } from "lucide-react";
import { useReadAloud } from "@/hooks/use-speech";
import { cn } from "@/lib/utils";

/**
 * Reads `text` aloud with the device's voice; tap again to stop.
 * Renders nothing where the browser can't speak.
 */
export function ReadAloudButton({
  id,
  text,
  label = "Read aloud",
  className,
  showLabel = false,
}: {
  /** Unique per piece of text, so only its own button shows "Stop" */
  id: string;
  text: string;
  label?: string;
  className?: string;
  showLabel?: boolean;
}) {
  const { supported, speakingId, toggle } = useReadAloud();
  if (!supported || !text.trim()) return null;
  const speaking = speakingId === id;

  return (
    <button
      type="button"
      onClick={() => toggle(id, text)}
      aria-label={speaking ? "Stop reading" : label}
      aria-pressed={speaking}
      title={speaking ? "Stop reading" : label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003cbb]/40",
        showLabel ? "h-7 px-2.5" : "w-7 h-7 justify-center",
        speaking
          ? "bg-[#003cbb] text-white dark:bg-[#2563EB]"
          : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-[#003cbb] dark:hover:text-[#4d82ff]",
        className
      )}
    >
      {speaking ? <Square className="w-3 h-3 fill-current" aria-hidden /> : <Volume2 className="w-3.5 h-3.5" aria-hidden />}
      {showLabel && <span>{speaking ? "Stop" : "Listen"}</span>}
    </button>
  );
}
