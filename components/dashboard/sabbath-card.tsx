"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Church, MapPin, Sunset } from "lucide-react";
import { getFinancialRegSummaryAction } from "@/app/actions/registration";
import type { FinancialRegSummaryWorshipCenter } from "@/app/actions/registration";
import { formatCampusDay, formatCampusTime, formatCountdown, sabbathStatus } from "@/lib/faith/sabbath";
import { ReadAloudButton } from "@/components/shared/read-aloud-button";

/** The time, ticking once a minute; null on the server so the first render matches */
const subscribeMinute = (onChange: () => void) => {
  const timer = setInterval(onChange, 60_000);
  return () => clearInterval(timer);
};
const minuteNow = () => Math.floor(Date.now() / 60_000);

/** Sabbath countdown for Ilishan-Remo, worked out on the device, with the student's worship centre */
export function SabbathCard() {
  const minute = useSyncExternalStore(subscribeMinute, minuteNow, () => null);
  const [worship, setWorship] = useState<FinancialRegSummaryWorshipCenter | null>(null);

  useEffect(() => {
    let cancelled = false;
    getFinancialRegSummaryAction()
      .then((res) => !cancelled && setWorship(res.data?.worship_center?.worship_center_name ? res.data.worship_center : null))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (minute === null) return <div className="h-full min-h-[118px] rounded-[24px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 animate-pulse" aria-hidden />;

  const now = new Date(minute * 60_000);
  const status = sabbathStatus(now);
  const isSabbath = status.state === "sabbath";
  // Within two days, a live countdown; further off, the day and time
  const soon = status.state === "upcoming" && status.startsAt.getTime() - now.getTime() < 2 * 86_400_000;

  const headline = isSabbath ? "Happy Sabbath" : soon ? `Sabbath begins in ${formatCountdown(status.startsAt.getTime() - now.getTime())}` : "Next Sabbath";
  const detail = isSabbath
    ? `Ends at sunset, ${formatCampusTime(status.endsAt)}`
    : `${formatCampusDay(status.startsAt)} at sunset, ${formatCampusTime(status.startsAt)}`;
  const spoken = `${headline}. ${detail}.${worship ? ` Your worship centre is ${worship.worship_center_name}${worship.location_on_campus ? `, at ${worship.location_on_campus}` : ""}.` : ""}`;

  return (
    <section
      aria-label="Sabbath"
      className="relative overflow-hidden rounded-[24px] border border-[#f3e3c4] dark:border-amber-500/20 bg-gradient-to-br from-[#fff8ec] to-[#fdf0dc] dark:from-amber-500/10 dark:to-[#1f2937] p-6 md:p-8 flex flex-col justify-center"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-white/80 dark:bg-amber-500/15 flex items-center justify-center shrink-0">
          <Sunset className="w-5 h-5 text-[#c2410c] dark:text-amber-400" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#9a3412] dark:text-amber-400">{isSabbath ? "Sabbath" : "Sabbath countdown"}</p>
              <h3 className="text-[17px] font-bold text-gray-900 dark:text-gray-100 leading-snug mt-0.5" aria-live="polite">
                {headline}
              </h3>
              <p className="text-[13px] text-gray-600 dark:text-gray-300 mt-0.5">{detail} · Ilishan-Remo</p>
            </div>
            <ReadAloudButton id="sabbath-card" text={spoken} label="Read Sabbath times aloud" />
          </div>

          {worship && (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-gray-700 dark:text-gray-300">
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <Church className="w-4 h-4 shrink-0 text-[#9a3412] dark:text-amber-400" aria-hidden />
                <span className="font-semibold truncate">{worship.worship_center_name}</span>
              </span>
              {worship.pastor_in_charge && <span className="text-gray-500 dark:text-gray-400">Pastor {worship.pastor_in_charge}</span>}
              {worship.location_on_campus && (
                <Link
                  href={`/campus-map?q=${encodeURIComponent(worship.location_on_campus)}`}
                  className="inline-flex items-center gap-1 font-semibold text-[#003cbb] dark:text-[#4d82ff] hover:underline"
                >
                  <MapPin className="w-3.5 h-3.5" aria-hidden />
                  {worship.location_on_campus}
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
