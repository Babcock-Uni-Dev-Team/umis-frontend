"use client";

import { Check, Play, X } from "lucide-react";
import { describeVoice, stopReading, useVoiceChoice } from "@/hooks/use-speech";
import { cn } from "@/lib/utils";

/**
 * Choose the voice that reads Torch's replies (and every Listen button) aloud. Each voice
 * can be previewed; the choice is remembered on this device. "Automatic" keeps picking the
 * most natural voice available.
 */
export function VoicePicker({ onClose }: { onClose: () => void }) {
  const { voices, choice, choose, preview } = useVoiceChoice();

  const close = () => {
    stopReading();
    onClose();
  };

  type Option = { uri: string; name: string; detail: string; natural: boolean; gender: "female" | "male" | null };
  const options: Option[] = [
    { uri: "", name: "Automatic", detail: "The most natural voice on this device", natural: false, gender: null },
    ...voices.map((v) => ({ uri: v.voiceURI, ...describeVoice(v) })),
  ];

  return (
    <div role="dialog" aria-label="Choose Torch's voice" className="absolute inset-0 z-20 flex flex-col bg-white dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-100 dark:border-gray-800">
        <div>
          <h4 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">Torch&apos;s voice</h4>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">Used when Torch reads replies aloud. Tap play to hear one.</p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close voice settings"
          className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {voices.length === 0 ? (
          <p className="p-4 text-[13px] text-gray-500 dark:text-gray-400">
            No English voices are available on this device yet. Try again in a moment, or install an English voice in your system settings.
          </p>
        ) : (
          <ul className="flex flex-col gap-1" role="radiogroup" aria-label="Voices">
            {options.map((o) => {
              const selected = o.uri === choice || (!o.uri && !voices.some((v) => v.voiceURI === choice));
              return (
                <li key={o.uri || "auto"} className="flex items-center gap-1">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => choose(o.uri)}
                    className={cn(
                      "flex-1 min-w-0 flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition-colors",
                      selected ? "bg-[#eef3fd] dark:bg-[#003cbb]/20" : "hover:bg-gray-50 dark:hover:bg-gray-800"
                    )}
                  >
                    <span
                      className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                        selected ? "border-[#003cbb] dark:border-[#4d82ff] bg-[#003cbb] dark:bg-[#4d82ff]" : "border-gray-300 dark:border-gray-600"
                      )}
                    >
                      {selected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 truncate">{o.name}</span>
                        {o.gender && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 shrink-0">
                            {o.gender === "female" ? "Female" : "Male"}
                          </span>
                        )}
                        {o.natural && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#ecfdf3] dark:bg-emerald-500/15 text-[#027a48] dark:text-emerald-400 shrink-0">
                            Natural
                          </span>
                        )}
                      </span>
                      <span className="block text-[12px] text-gray-500 dark:text-gray-400 truncate">{o.detail}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => preview(o.uri)}
                    aria-label={`Hear ${o.name}`}
                    title={`Hear ${o.name}`}
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[#003cbb] dark:text-[#4d82ff] hover:bg-[#eef3fd] dark:hover:bg-[#003cbb]/20 transition-colors"
                  >
                    <Play className="w-4 h-4 fill-current" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {voices.length > 0 && voices.length < 6 && (
        <p className="mx-4 mb-2 rounded-[10px] bg-[#f5f8fe] dark:bg-[#003cbb]/10 p-3 text-[12px] leading-relaxed text-gray-600 dark:text-gray-300">
          This device has only a few voices. For more natural ones, including more female voices, open Pulse in Microsoft Edge or Chrome,
          or add voices on Windows in Settings › Time &amp; language › Speech.
        </p>
      )}

      <div className="p-3 border-t border-gray-100 dark:border-gray-800">
        <button
          type="button"
          onClick={close}
          className="w-full h-10 rounded-[10px] bg-[#003cbb] hover:bg-[#002e8f] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] text-white text-[14px] font-semibold transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
