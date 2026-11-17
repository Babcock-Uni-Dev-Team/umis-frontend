"use client";

import Link from "next/link";
import { CheckCircle2, ChevronRight, GraduationCap, Wallet } from "lucide-react";
import { examEligibility } from "@/lib/payments/exam-eligibility";
import { cn } from "@/lib/utils";

const naira = (n: number) => `₦${n.toLocaleString(undefined, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

/**
 * "Can I write my mid-semester exams?" in one line: what's still needed to reach 75% of the
 * semester's charges, and the next step: pay from the wallet, or fund it first.
 */
export function ExamEligibility({
  semesterFee,
  paid,
  outstanding,
  wallet,
  walletUnavailable = false,
  variant = "card",
  className,
}: {
  semesterFee: number;
  paid: number;
  outstanding: number;
  wallet: number | null;
  walletUnavailable?: boolean;
  /** "inline": one line with its button, for sitting under an existing progress bar */
  variant?: "card" | "inline";
  className?: string;
}) {
  const e = examEligibility({ semesterFee, paid, outstanding, wallet: walletUnavailable ? null : wallet });
  if (e.status === "unknown") return null;

  if (variant === "inline") {
    const fund = e.fundShortfall !== null && e.fundShortfall > 0 ? Math.ceil(e.fundShortfall) : null;
    return (
      <div className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-2", className)}>
        <p className="flex items-start gap-2 min-w-0 text-[14px] leading-snug text-gray-700 dark:text-gray-300">
          {e.status === "eligible" ? (
            <>
              <CheckCircle2 className="w-[18px] h-[18px] shrink-0 mt-px text-[#12B76A] dark:text-[#34d399]" aria-hidden />
              <span>You&apos;ve paid enough to write your mid-semester exams.</span>
            </>
          ) : (
            <>
              <GraduationCap className="w-[18px] h-[18px] shrink-0 mt-px text-[#003cbb] dark:text-[#4d82ff]" aria-hidden />
              <span>
                Pay <span className="font-bold text-gray-900 dark:text-gray-100 tabular-nums">{naira(e.needed)}</span> more to reach the 75% needed for mid-semester exams.
              </span>
            </>
          )}
        </p>
        {e.status === "wallet-covers" ? (
          <Link
            href="/dashboard/finance/fees"
            className="inline-flex items-center gap-1 h-8 px-3 rounded-[10px] bg-[#003cbb] hover:bg-[#002e8f] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] text-white text-[13px] font-semibold transition-colors shrink-0"
          >
            Pay from wallet
            <ChevronRight className="w-4 h-4" aria-hidden />
          </Link>
        ) : e.status === "needs-payment" ? (
          <Link
            href={`/dashboard/finance?action=fund${fund ? `&amount=${fund}` : ""}`}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[10px] bg-[#003cbb] hover:bg-[#002e8f] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] text-white text-[13px] font-semibold transition-colors shrink-0"
          >
            <Wallet className="w-4 h-4" aria-hidden />
            {fund ? `Fund ${naira(fund)}` : "Fund wallet"}
          </Link>
        ) : null}
      </div>
    );
  }

  if (e.status === "eligible") {
    return (
      <div className={cn("flex items-start gap-2.5 rounded-[12px] border border-[#cbf5e5] dark:border-emerald-500/25 bg-[#effaf6] dark:bg-emerald-500/10 p-3.5", className)}>
        <CheckCircle2 className="w-5 h-5 shrink-0 text-[#12B76A] dark:text-[#34d399]" aria-hidden />
        <p className="text-[14px] leading-relaxed text-[#176448] dark:text-[#6ee7b7]">
          <span className="font-semibold">You can write your mid-semester exams.</span> You&apos;ve paid {e.percentPaid}% of this semester&apos;s fees, and 75% is required.
        </p>
      </div>
    );
  }

  const fundAmount = e.fundShortfall !== null && e.fundShortfall > 0 ? Math.ceil(e.fundShortfall) : null;

  return (
    <div className={cn("flex flex-col gap-3 rounded-[12px] border border-[#ccdaf9] dark:border-[#003cbb]/40 bg-[#f5f8ff] dark:bg-[#003cbb]/10 p-3.5", className)}>
      <div className="flex items-start gap-2.5">
        <GraduationCap className="w-5 h-5 shrink-0 text-[#003cbb] dark:text-[#4d82ff]" aria-hidden />
        <div className="min-w-0">
          <p className="text-[14px] leading-relaxed text-gray-900 dark:text-gray-100">
            Pay <span className="font-bold tabular-nums">{naira(e.needed)}</span> more to write your mid-semester exams.
          </p>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">
            {e.percentPaid}% of this semester&apos;s fees paid · 75% ({naira(e.target)}) required
            {e.status === "wallet-covers" && " · your wallet already covers it"}
          </p>
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-[#dbe5fb] dark:bg-gray-800 overflow-hidden" aria-hidden>
        <div className="relative h-full">
          <div className="h-full rounded-full bg-[#003cbb] dark:bg-[#4d82ff]" style={{ width: `${e.percentPaid}%` }} />
          <div className="absolute top-[-2px] bottom-[-2px] w-0.5 bg-gray-500 dark:bg-gray-400" style={{ left: "75%" }} />
        </div>
      </div>

      {e.status === "wallet-covers" ? (
        <Link
          href="/dashboard/finance/fees"
          className="self-start inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[10px] bg-[#003cbb] hover:bg-[#002e8f] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] text-white text-[13px] font-semibold transition-colors"
        >
          Pay from wallet
          <ChevronRight className="w-4 h-4" aria-hidden />
        </Link>
      ) : (
        <Link
          href={`/dashboard/finance?action=fund${fundAmount ? `&amount=${fundAmount}` : ""}`}
          className="self-start inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[10px] bg-[#003cbb] hover:bg-[#002e8f] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] text-white text-[13px] font-semibold transition-colors"
        >
          <Wallet className="w-4 h-4" aria-hidden />
          {fundAmount ? `Fund ${naira(fundAmount)}` : "Fund wallet"}
        </Link>
      )}
    </div>
  );
}
