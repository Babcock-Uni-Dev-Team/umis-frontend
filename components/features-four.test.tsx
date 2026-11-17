import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ExamEligibility } from "./finance/exam-eligibility";
import { SabbathCard } from "./dashboard/sabbath-card";
import { ReadAloudButton } from "./shared/read-aloud-button";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/app/actions/registration", () => ({
  getFinancialRegSummaryAction: vi.fn().mockResolvedValue({
    data: {
      lock_financial_reg: true,
      worship_center: { worship_center_name: "Canaan Land Chapel", location_on_campus: "Nelson Mandela Auditorium", pastor_in_charge: "Afanga Sylvester" },
    },
  }),
}));

describe("ExamEligibility", () => {
  it("says how much more to pay and links to funding the shortfall", () => {
    render(<ExamEligibility semesterFee={2_000_000} paid={500_000} outstanding={0} wallet={200_000} />);

    expect(screen.getByText(/more to write your mid-semester exams/).textContent).toContain("₦1,000,000");
    expect(screen.getByText(/25% of this semester/)).toBeDefined();
    expect(screen.getByRole("link", { name: /Fund ₦800,000/ }).getAttribute("href")).toBe("/dashboard/finance?action=fund&amount=800000");
  });

  it("offers to pay from the wallet when it already covers the amount", () => {
    render(<ExamEligibility semesterFee={2_000_000} paid={500_000} outstanding={0} wallet={1_500_000} />);

    expect(screen.getByRole("link", { name: /Pay from wallet/ }).getAttribute("href")).toBe("/dashboard/finance/fees");
  });

  it("confirms when the student can already write the exams", () => {
    render(<ExamEligibility semesterFee={2_000_000} paid={1_600_000} outstanding={0} wallet={0} />);

    expect(screen.getByText("You can write your mid-semester exams.")).toBeDefined();
  });

  it("doesn't guess a top-up when the wallet can't be read", () => {
    render(<ExamEligibility semesterFee={2_000_000} paid={0} outstanding={0} wallet={0} walletUnavailable />);

    expect(screen.getByRole("link", { name: "Fund wallet" }).getAttribute("href")).toBe("/dashboard/finance?action=fund");
  });

  it("fits on one line with its button when inline", () => {
    render(<ExamEligibility variant="inline" semesterFee={2_000_000} paid={0} outstanding={0} wallet={2_000_000} />);

    expect(screen.getByText(/more to reach the 75% needed for mid-semester exams/).textContent).toContain("₦1,500,000");
    expect(screen.getByRole("link", { name: /Pay from wallet/ }).getAttribute("href")).toBe("/dashboard/finance/fees");
    expect(screen.queryByText(/of this semester's fees paid/)).toBeNull();
  });

  it("shows nothing before there's a semester fee", () => {
    const { container } = render(<ExamEligibility semesterFee={0} paid={0} outstanding={0} wallet={0} />);

    expect(container.innerHTML).toBe("");
  });
});

describe("SabbathCard", () => {
  afterEach(() => vi.useRealTimers());

  it("counts down to Friday sunset and shows the student's worship centre", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-13T12:00:00Z"), shouldAdvanceTime: true });
    render(<SabbathCard />);

    expect(await screen.findByText(/^Sabbath begins in 5 h \d+ min$/)).toBeDefined();
    await waitFor(() => expect(screen.getByText("Canaan Land Chapel")).toBeDefined());
    expect(screen.getByRole("link", { name: /Nelson Mandela Auditorium/ }).getAttribute("href")).toBe("/campus-map?q=Nelson%20Mandela%20Auditorium");
  });

  it("wishes a happy Sabbath during it", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-14T10:00:00Z"), shouldAdvanceTime: true });
    render(<SabbathCard />);

    expect(await screen.findByText("Happy Sabbath")).toBeDefined();
    expect(screen.getByText(/^Ends at sunset/)).toBeDefined();
  });
});

describe("ReadAloudButton", () => {
  const speak = vi.fn();
  const cancel = vi.fn();

  beforeEach(() => {
    speak.mockReset();
    cancel.mockReset();
    Object.assign(window, { speechSynthesis: { speak, cancel, getVoices: () => [] } });
    // jsdom has no SpeechSynthesisUtterance
    (globalThis as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance = class {
      text: string;
      lang = "";
      rate = 1;
      voice: unknown = null;
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

  it("reads plain text aloud, and stops on a second tap", () => {
    render(<ReadAloudButton id="t1" text="Open **Finance** and tap [Fund](/x)." label="Read aloud" />);

    fireEvent.click(screen.getByRole("button", { name: "Read aloud" }));
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0][0].text).toBe("Open Finance and tap Fund.");

    fireEvent.click(screen.getByRole("button", { name: "Stop reading" }));
    expect(cancel).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Read aloud" })).toBeDefined();
  });

  it("goes back to Listen when the reading finishes", () => {
    render(<ReadAloudButton id="t2" text="Hello" label="Read aloud" />);
    fireEvent.click(screen.getByRole("button", { name: "Read aloud" }));

    act(() => speak.mock.calls[0][0].onend());

    expect(screen.getByRole("button", { name: "Read aloud" })).toBeDefined();
  });

  it("reads sentence by sentence with a little intonation, and finishes after the last", () => {
    render(<ReadAloudButton id="t4" text="Your fees are paid. Want a receipt? Open Finance." label="Read aloud" />);
    fireEvent.click(screen.getByRole("button", { name: "Read aloud" }));

    const spoken = speak.mock.calls.map((c) => c[0]);
    expect(spoken.map((u) => u.text)).toEqual(["Your fees are paid.", "Want a receipt?", "Open Finance."]);
    // Raised a little, a lift on the question, settling on the close
    expect(spoken[0].pitch).toBeGreaterThan(1);
    expect(spoken[1].pitch).toBeGreaterThan(spoken[0].pitch);
    expect(spoken[2].pitch).toBeLessThan(spoken[0].pitch);

    act(() => spoken[0].onend?.());
    expect(screen.getByRole("button", { name: "Stop reading" })).toBeDefined();
    act(() => spoken[2].onend());
    expect(screen.getByRole("button", { name: "Read aloud" })).toBeDefined();
  });

  it("hides itself where the browser can't speak", () => {
    delete (window as { speechSynthesis?: unknown }).speechSynthesis;
    const { container } = render(<ReadAloudButton id="t3" text="Hello" />);

    expect(container.innerHTML).toBe("");
  });
});
