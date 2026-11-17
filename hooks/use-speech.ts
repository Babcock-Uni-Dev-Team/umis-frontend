"use client";

/**
 * Read aloud and voice input with the browser's built-in Web Speech API: no service or key.
 * Both report `supported: false` where the browser lacks them, so callers hide their buttons.
 * (Voice input works in Chrome, Edge and Safari; Chrome sends the audio to Google to transcribe.)
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { speakableText } from "@/lib/speech/text";

const noop = () => () => {};
const hasSynthesis = () => typeof window !== "undefined" && "speechSynthesis" in window;

// ── Read aloud ────────────────────────────────────────────────────────────────

/**
 * The best voice on this device. Neural voices sound far more natural than the default
 * ones: Microsoft's "Natural"/"Online" voices (Windows, Edge), Google's (Chrome) and Apple's
 * "Enhanced"/"Premium" ones. Then Nigerian, British, then any English.
 */
export function rankVoice(v: Pick<SpeechSynthesisVoice, "name" | "lang" | "localService">): number {
  if (!/^en\b|^en-/i.test(v.lang)) return -1;
  let score = 0;
  if (/natural|neural/i.test(v.name)) score += 60;
  else if (/premium|enhanced/i.test(v.name)) score += 50;
  else if (/^google/i.test(v.name)) score += 40;
  else if (/online/i.test(v.name)) score += 35;
  if (!v.localService) score += 5;
  if (/en[-_]NG/i.test(v.lang)) score += 20;
  else if (/en[-_]GB/i.test(v.lang)) score += 15;
  else if (/en[-_](US|AU|IE|ZA)/i.test(v.lang)) score += 8;
  // Robotic legacy voices last, but still listed
  if (/compact|espeak/i.test(v.name)) score -= 10;
  return Math.max(0, score);
}

// System voices don't say whether they sound female or male, so it's read from well-known names
const FEMALE = /\b(female|woman|zira|jenny|aria|sonia|libby|maisie|mia|ezinne|ava|emma|michelle|ana|sara|clara|natasha|catherine|hazel|susan|heera|neerja|samantha|karen|moira|tessa|serena|fiona|victoria|allison|kate|martha|linda|eva|molly|hollie|leah|luna|jane|nancy|elizabeth|amy|joanna|salli|kimberly|ivy|olivia|aditi|raveena)\b/i;
const MALE = /\b(male|man|david|mark|guy|ryan|thomas|alfie|abeo|christopher|eric|roger|steffan|brian|andrew|william|liam|george|daniel|alex|fred|arthur|oliver|rishi|aaron|tom|james|noah|ollie|matthew|joey|justin|russell|prabhat)\b/i;

/** "female", "male", or null when the name doesn't say */
export function voiceGender(name: string): "female" | "male" | null {
  if (/\bfemale\b/i.test(name)) return "female";
  if (/\bmale\b/i.test(name)) return "male";
  if (FEMALE.test(name)) return "female";
  if (MALE.test(name)) return "male";
  // "Google US English" is a female voice
  if (/^google us english$/i.test(name.trim())) return "female";
  return null;
}

/** English voices on this device, best first; updates when Chrome finishes loading them */
let voiceList: SpeechSynthesisVoice[] = [];
const voiceListeners = new Set<() => void>();

function refreshVoices() {
  if (!hasSynthesis()) return;
  voiceList = window.speechSynthesis
    .getVoices()
    .filter((v) => rankVoice(v) >= 0)
    .sort((a, b) => rankVoice(b) - rankVoice(a));
  voiceListeners.forEach((l) => l());
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  refreshVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", refreshVoices);
}

const subscribeVoices = (l: () => void) => {
  voiceListeners.add(l);
  return () => voiceListeners.delete(l);
};
const EMPTY: SpeechSynthesisVoice[] = [];

// The student's chosen voice, remembered on this device ("" = automatic: the best available)
const VOICE_KEY = "pulse:read-aloud-voice";
let chosenVoice: string | null = null;
const choiceListeners = new Set<() => void>();

function readChoice(): string {
  if (chosenVoice !== null) return chosenVoice;
  try {
    chosenVoice = localStorage.getItem(VOICE_KEY) ?? "";
  } catch {
    chosenVoice = "";
  }
  return chosenVoice;
}

function setChoice(voiceURI: string) {
  chosenVoice = voiceURI;
  try {
    if (voiceURI) localStorage.setItem(VOICE_KEY, voiceURI);
    else localStorage.removeItem(VOICE_KEY);
  } catch {
    // Not remembered, but still used for this visit
  }
  choiceListeners.forEach((l) => l());
}

const subscribeChoice = (l: () => void) => {
  choiceListeners.add(l);
  return () => choiceListeners.delete(l);
};

/** The chosen voice if this device still has it, otherwise the best available */
function pickVoice(): SpeechSynthesisVoice | undefined {
  if (voiceList.length === 0) refreshVoices();
  const choice = readChoice();
  return (choice && voiceList.find((v) => v.voiceURI === choice)) || voiceList[0];
}

/** "Microsoft Sonia Online (Natural) - English (United Kingdom)" → Sonia · English (United Kingdom) · Natural */
export function describeVoice(v: Pick<SpeechSynthesisVoice, "name" | "lang">): {
  name: string;
  detail: string;
  natural: boolean;
  gender: "female" | "male" | null;
} {
  const natural = /natural|neural|premium|enhanced/i.test(v.name);
  const gender = voiceGender(v.name);
  const microsoft = v.name.match(/^Microsoft\s+(\w+)(?:\s+Online)?(?:\s+\((?:Natural|Neural)\))?\s*-\s*(.+)$/i);
  if (microsoft) return { name: microsoft[1], detail: microsoft[2], natural, gender };
  const apple = v.name.match(/^(.+?)\s*\((Enhanced|Premium)\)$/i);
  if (apple) return { name: apple[1], detail: v.lang, natural, gender };
  return { name: v.name.replace(/^Google\s+/i, "Google "), detail: v.lang, natural, gender };
}

const PREVIEW_TEXT = "Hi, I'm Torch, your campus guide. How can I help you today?";

/** The voices to choose from, the current choice, and a short preview */
export function useVoiceChoice() {
  const voices = useSyncExternalStore(subscribeVoices, () => voiceList, () => EMPTY);
  const choice = useSyncExternalStore(subscribeChoice, readChoice, () => "");
  const supported = useSyncExternalStore(noop, hasSynthesis, () => false);

  // Opened before the device listed its voices: ask again
  useEffect(() => {
    if (voiceList.length === 0) refreshVoices();
  }, []);

  const preview = useCallback((voiceURI: string) => {
    if (!hasSynthesis()) return;
    stopReading();
    const voice = (voiceURI && voiceList.find((v) => v.voiceURI === voiceURI)) || voiceList[0];
    sentences(PREVIEW_TEXT).forEach((part, i, all) => {
      const utterance = new SpeechSynthesisUtterance(part);
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang ?? "en-GB";
      const { pitch, rate } = sentenceTone(part, i, all.length);
      utterance.pitch = pitch;
      utterance.rate = rate;
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  return { supported, voices, choice, choose: setChoice, preview };
}

/** Split into sentences, so each gets its own intonation and a natural pause after it */
export function sentences(text: string): string[] {
  return (text.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [text]).map((s) => s.trim()).filter(Boolean);
}

/**
 * A little more lift than the flat default: slightly raised overall, questions rise, and the
 * closing sentence settles, so the reading sounds engaged rather than monotone.
 */
export function sentenceTone(sentence: string, index: number, total: number) {
  const BASE_PITCH = 1.08;
  const BASE_RATE = 0.97;
  if (sentence.endsWith("?")) return { pitch: BASE_PITCH + 0.1, rate: BASE_RATE };
  if (total > 1 && index === total - 1) return { pitch: BASE_PITCH - 0.05, rate: BASE_RATE - 0.03 };
  // A gentle alternation between sentences, like a speaker moving from one point to the next
  return { pitch: BASE_PITCH + (index % 2 === 0 ? 0.03 : -0.01), rate: BASE_RATE };
}

/** One speaker for the whole app, so starting one reading stops any other */
let currentId: string | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function stopReading() {
  if (!hasSynthesis()) return;
  window.speechSynthesis.cancel();
  currentId = null;
  notify();
}

export function useReadAloud() {
  const supported = useSyncExternalStore(noop, hasSynthesis, () => false);
  const speakingId = useSyncExternalStore(subscribe, () => currentId, () => null);

  const speak = useCallback((id: string, text: string) => {
    if (!hasSynthesis()) return;
    window.speechSynthesis.cancel();
    const voice = pickVoice();
    const parts = sentences(speakableText(text));
    if (parts.length === 0) return;

    const done = () => {
      if (currentId === id) {
        currentId = null;
        notify();
      }
    };

    currentId = id;
    notify();
    parts.forEach((part, i) => {
      const utterance = new SpeechSynthesisUtterance(part);
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang ?? "en-GB";
      const { pitch, rate } = sentenceTone(part, i, parts.length);
      utterance.pitch = pitch;
      utterance.rate = rate;
      // Finished, or stopped part-way: the button goes back to "Listen"
      if (i === parts.length - 1) utterance.onend = done;
      utterance.onerror = done;
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  /** Read `text`, or stop if this one is already being read */
  const toggle = useCallback(
    (id: string, text: string) => (currentId === id ? stopReading() : speak(id, text)),
    [speak]
  );

  return { supported, speakingId, toggle, stop: stopReading };
}

// ── Voice input ───────────────────────────────────────────────────────────────

interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
}

type RecognitionCtor = new () => Recognition;

const recognitionCtor = (): RecognitionCtor | undefined =>
  typeof window === "undefined"
    ? undefined
    : ((window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition);

/** Plain-language reasons for the browser's recognition errors */
const VOICE_ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow it in your browser's site settings to speak your question.",
  "service-not-allowed": "Microphone access is blocked. Allow it in your browser's site settings to speak your question.",
  "no-speech": "I didn't catch anything. Tap the microphone and try again.",
  "audio-capture": "No microphone was found on this device.",
  network: "Voice input needs an internet connection.",
};

/**
 * Speak instead of typing. `onText` gets the words so far (including partial words while
 * the student is still speaking), so the input fills in live.
 */
export function useVoiceInput(onText: (text: string) => void) {
  const supported = useSyncExternalStore(noop, () => !!recognitionCtor(), () => false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  const stop = useCallback(() => recognition.current?.stop(), []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    stopReading();
    setError(null);
    const r = new Ctor();
    r.lang = "en-NG";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      onTextRef.current(text.trim());
    };
    r.onerror = (e) => {
      if (e.error !== "aborted") setError(VOICE_ERRORS[e.error] ?? "Voice input stopped. Please try again.");
    };
    r.onend = () => {
      setListening(false);
      recognition.current = null;
    };
    recognition.current = r;
    setListening(true);
    try {
      r.start();
    } catch {
      setListening(false);
      setError("Voice input couldn't start. Please try again.");
    }
  }, []);

  // Stop listening if the component goes away mid-sentence
  useEffect(() => () => recognition.current?.stop(), []);

  return { supported, listening, error, start, stop, clearError: () => setError(null) };
}
