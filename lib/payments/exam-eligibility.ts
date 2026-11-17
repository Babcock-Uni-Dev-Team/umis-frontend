/**
 * Whether a student has paid enough to write mid-semester exams: at least 75% of what
 * they owe for the semester (the rule shown on the Finance page).
 */

/** Share of the semester's charges that must be paid before mid-semester exams */
export const MID_SEMESTER_SHARE = 0.75;

export type ExamEligibilityStatus =
  /** Already paid enough */
  | "eligible"
  /** Not yet, but the wallet holds enough to pay now */
  | "wallet-covers"
  /** Not yet, and the wallet needs topping up (or couldn't be read) */
  | "needs-payment"
  /** No semester fee to measure against yet */
  | "unknown";

export interface ExamEligibility {
  status: ExamEligibilityStatus;
  /** 75% of the semester's charges */
  target: number;
  /** Still to pay to reach the target */
  needed: number;
  /** What to add to the wallet first; null when the wallet balance is unknown */
  fundShortfall: number | null;
  /** Share of the semester's charges paid so far, 0–100 */
  percentPaid: number;
}

/** Rounded up to the kobo, so paying the shown amount always reaches the target */
const upToKobo = (n: number) => Math.ceil(Math.round(n * 1000) / 10) / 100;

export function examEligibility({
  semesterFee,
  paid,
  outstanding,
  wallet,
}: {
  semesterFee: number;
  paid: number;
  outstanding: number;
  /** null when the balance couldn't be read */
  wallet: number | null;
}): ExamEligibility {
  // Same measure as payment progress: the semester fee, and never less than paid + still owed
  const obligation = Math.max(semesterFee, paid + outstanding);
  if (obligation <= 0) {
    return { status: "unknown", target: 0, needed: 0, fundShortfall: null, percentPaid: 0 };
  }

  const target = upToKobo(obligation * MID_SEMESTER_SHARE);
  const needed = Math.max(0, upToKobo(target - paid));
  const percentPaid = Math.min(100, Math.max(0, Math.round((paid / obligation) * 100)));

  if (needed === 0) return { status: "eligible", target, needed: 0, fundShortfall: 0, percentPaid };
  if (wallet !== null && wallet >= needed) return { status: "wallet-covers", target, needed, fundShortfall: 0, percentPaid };
  return {
    status: "needs-payment",
    target,
    needed,
    fundShortfall: wallet === null ? null : upToKobo(needed - wallet),
    percentPaid,
  };
}
