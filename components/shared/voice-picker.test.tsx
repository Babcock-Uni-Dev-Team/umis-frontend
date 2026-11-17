import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { VoicePicker } from "./voice-picker";
import { ReadAloudButton } from "./read-aloud-button";
import { describeVoice, voiceGender } from "@/hooks/use-speech";

const voices = [
  { name: "Microsoft David - English (United States)", lang: "en-US", localService: true, voiceURI: "david" },
  { name: "Microsoft Zira - English (United States)", lang: "en-US", localService: true, voiceURI: "zira" },
  { name: "Microsoft Sonia Online (Natural) - English (United Kingdom)", lang: "en-GB", localService: false, voiceURI: "sonia" },
  { name: "Google UK English Male", lang: "en-GB", localService: false, voiceURI: "google-uk-male" },
  { name: "Google français", lang: "fr-FR", localService: false, voiceURI: "fr" },
];

const speak = vi.fn();

beforeEach(() => {
  speak.mockReset();
  localStorage.clear();
  Object.assign(window, { speechSynthesis: { speak, cancel: vi.fn(), getVoices: () => voices } });
  (globalThis as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance = class {
    text: string;
    voice: unknown = null;
    lang = "";
    pitch = 1;
    rate = 1;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(text: string) {
      this.text = text;
    }
  };
});

afterEach(() => {
  delete (window as { speechSynthesis?: unknown }).speechSynthesis;
});

describe("describeVoice", () => {
  it("turns system voice names into something readable", () => {
    expect(describeVoice(voices[2])).toEqual({ name: "Sonia", detail: "English (United Kingdom)", natural: true, gender: "female" });
    expect(describeVoice({ name: "Daniel (Enhanced)", lang: "en-GB" })).toEqual({ name: "Daniel", detail: "en-GB", natural: true, gender: "male" });
  });

  it("tells female and male voices apart by name", () => {
    expect(voiceGender("Microsoft Zira - English (United States)")).toBe("female");
    expect(voiceGender("Microsoft Mark - English (United States)")).toBe("male");
    expect(voiceGender("Google UK English Female")).toBe("female");
    expect(voiceGender("Google UK English Male")).toBe("male");
    expect(voiceGender("Google US English")).toBe("female");
    expect(voiceGender("Some Voice")).toBeNull();
  });
});

describe("VoicePicker", () => {
  it("lists English voices, best first, after Automatic", () => {
    render(<VoicePicker onClose={() => {}} />);

    const names = screen.getAllByRole("radio").map((r) => r.textContent);
    expect(names[0]).toContain("Automatic");
    expect(names[1]).toContain("Sonia");
    expect(names.join(" ")).not.toContain("français");
    // Every English voice is listed, including the only female voice on many Windows PCs
    expect(screen.getByRole("radio", { name: /Zira/ }).textContent).toContain("Female");
    expect(screen.getByRole("radio", { name: /David/ }).textContent).toContain("Male");
    expect(screen.getByRole("radio", { name: /Automatic/ }).getAttribute("aria-checked")).toBe("true");
  });

  it("previews a voice", () => {
    render(<VoicePicker onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Hear Google UK English Male" }));

    expect(speak).toHaveBeenCalled();
    expect(speak.mock.calls[0][0].voice.voiceURI).toBe("google-uk-male");
  });

  it("remembers the choice and reads aloud with it", () => {
    render(<VoicePicker onClose={() => {}} />);
    fireEvent.click(screen.getByRole("radio", { name: /Google UK English Male/ }));

    expect(localStorage.getItem("pulse:read-aloud-voice")).toBe("google-uk-male");
    expect(screen.getByRole("radio", { name: /Google UK English Male/ }).getAttribute("aria-checked")).toBe("true");

    render(<ReadAloudButton id="r1" text="Hello there." label="Listen to this" />);
    fireEvent.click(screen.getByRole("button", { name: "Listen to this" }));
    expect(speak.mock.calls.at(-1)?.[0].voice.voiceURI).toBe("google-uk-male");

    // Back to automatic: the most natural voice
    fireEvent.click(screen.getByRole("radio", { name: /Automatic/ }));
    expect(localStorage.getItem("pulse:read-aloud-voice")).toBeNull();
  });
});
