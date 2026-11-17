import { describe, it, expect } from "vitest";
import { examEligibility } from "./payments/exam-eligibility";
import { formatCampusTime, formatCountdown, sabbathStatus, sunsetOn } from "./faith/sabbath";
import { speakableText } from "./speech/text";
import { rankVoice, sentences, sentenceTone } from "@/hooks/use-speech";

describe("examEligibility", () => {
  it("says how much more to pay to reach 75%", () => {
    const result = examEligibility({ semesterFee: 2_000_000, paid: 500_000, outstanding: 0, wallet: 0 });

    expect(result).toEqual({ status: "needs-payment", target: 1_500_000, needed: 1_000_000, fundShortfall: 1_000_000, percentPaid: 25 });
  });

  it("knows when the wallet already covers it", () => {
    expect(examEligibility({ semesterFee: 2_000_000, paid: 500_000, outstanding: 0, wallet: 1_200_000 }).status).toBe("wallet-covers");
  });

  it("asks only for the top-up the wallet is missing", () => {
    expect(examEligibility({ semesterFee: 2_000_000, paid: 0, outstanding: 0, wallet: 400_000 }).fundShortfall).toBe(1_100_000);
  });

  it("is eligible at 75% or more", () => {
    expect(examEligibility({ semesterFee: 2_000_000, paid: 1_500_000, outstanding: 0, wallet: 0 }).status).toBe("eligible");
  });

  it("rounds up to the kobo so paying the amount shown always reaches 75%", () => {
    const result = examEligibility({ semesterFee: 2_469_523.5, paid: 0, outstanding: 0, wallet: 0 });

    expect(result.needed).toBe(1_852_142.63);
    expect(result.needed).toBeGreaterThanOrEqual(2_469_523.5 * 0.75);
  });

  it("leaves the top-up unknown when the wallet can't be read", () => {
    expect(examEligibility({ semesterFee: 2_000_000, paid: 0, outstanding: 0, wallet: null })).toMatchObject({ status: "needs-payment", fundShortfall: null });
  });

  it("can't judge without a semester fee", () => {
    expect(examEligibility({ semesterFee: 0, paid: 0, outstanding: 0, wallet: 100 }).status).toBe("unknown");
  });

  it("counts older debt, like payment progress", () => {
    expect(examEligibility({ semesterFee: 1_000_000, paid: 1_000_000, outstanding: 1_000_000, wallet: 0 }).needed).toBe(500_000);
  });
});

describe("Sabbath times", () => {
  it("matches published sunset times for Lagos to within two minutes", () => {
    // Published: 18:27 on 1 Nov and 18:26 on 15 Nov 2026 (West Africa Time)
    for (const [day, hhmm] of [[1, "18:27"], [15, "18:26"]] as const) {
      const sunset = sunsetOn(2026, 11, day, 6.4541, 3.3947);
      const [h, m] = hhmm.split(":").map(Number);
      const published = Date.UTC(2026, 10, day, h - 1, m);
      expect(Math.abs(sunset.getTime() - published) / 60_000).toBeLessThanOrEqual(2);
    }
  });

  it("is upcoming during the week, starting Friday at sunset", () => {
    const wednesdayNoon = new Date("2026-11-11T11:00:00Z");
    const status = sabbathStatus(wednesdayNoon);

    expect(status.state).toBe("upcoming");
    if (status.state === "upcoming") {
      expect(new Date(status.startsAt.getTime() + 3_600_000).toISOString().slice(0, 10)).toBe("2026-11-13");
      expect(formatCampusTime(status.startsAt)).toMatch(/^6:2\d\spm$/i);
    }
  });

  it("is Sabbath on Friday evening and Saturday afternoon, ending at Saturday sunset", () => {
    for (const at of ["2026-11-13T19:00:00Z", "2026-11-14T13:00:00Z"]) {
      const status = sabbathStatus(new Date(at));
      expect(status.state).toBe("sabbath");
      if (status.state === "sabbath") expect(new Date(status.endsAt.getTime() + 3_600_000).toISOString().slice(0, 10)).toBe("2026-11-14");
    }
  });

  it("looks to next Friday once Saturday's sunset has passed", () => {
    const status = sabbathStatus(new Date("2026-11-14T19:00:00Z"));

    expect(status.state).toBe("upcoming");
    if (status.state === "upcoming") expect(new Date(status.startsAt.getTime() + 3_600_000).toISOString().slice(0, 10)).toBe("2026-11-20");
  });

  it("uses campus time whatever the phone's time zone", () => {
    // 23:30 UTC on Friday is already 00:30 Saturday in Ilishan-Remo
    expect(sabbathStatus(new Date("2026-11-13T23:30:00Z")).state).toBe("sabbath");
  });

  it("formats countdowns", () => {
    expect(formatCountdown(45 * 60_000)).toBe("45 min");
    expect(formatCountdown((3 * 60 + 12) * 60_000)).toBe("3 h 12 min");
    expect(formatCountdown((26 * 60) * 60_000)).toBe("1 day 2 h");
  });
});

describe("voice choice", () => {
  const voice = (name: string, lang: string, localService = true) => ({ name, lang, localService });

  it("prefers natural neural voices over the default ones", () => {
    const voices = [
      voice("Microsoft David Desktop - English (United States)", "en-US"),
      voice("Google UK English Female", "en-GB", false),
      voice("Microsoft Sonia Online (Natural) - English (United Kingdom)", "en-GB", false),
    ];
    const best = [...voices].sort((a, b) => rankVoice(b) - rankVoice(a))[0];

    expect(best.name).toContain("Sonia Online (Natural)");
  });

  it("prefers a Nigerian voice among equals, and never a non-English one", () => {
    expect(rankVoice(voice("Microsoft Ezinne Online (Natural) - English (Nigeria)", "en-NG", false))).toBeGreaterThan(
      rankVoice(voice("Microsoft Aria Online (Natural) - English (United States)", "en-US", false))
    );
    expect(rankVoice(voice("Google français", "fr-FR", false))).toBe(-1);
  });

  it("splits text into sentences", () => {
    expect(sentences("Pay now. Need help? Ask Torch!")).toEqual(["Pay now.", "Need help?", "Ask Torch!"]);
    expect(sentences("No full stop")).toEqual(["No full stop"]);
  });

  it("lifts questions and settles the closing sentence", () => {
    expect(sentenceTone("Ready?", 0, 2).pitch).toBeGreaterThan(sentenceTone("Ready.", 0, 2).pitch);
    expect(sentenceTone("Done.", 2, 3).pitch).toBeLessThan(sentenceTone("Start.", 0, 3).pitch);
    expect(sentenceTone("Done.", 2, 3).rate).toBeLessThan(1);
  });
});

describe("speakableText", () => {
  it("reads Markdown as plain sentences", () => {
    const md = "To pay:\n\n1. Open **Finance**\n2. Tap [Fund Wallet](/dashboard/finance)\n\n- Cost: ₦5,000";

    expect(speakableText(md)).toBe("To pay: Open Finance. Tap Fund Wallet. Cost: naira 5,000.");
  });
});
