import "server-only";

/**
 * What Torch knows about the student asking: their own programme, level, CGPA, this
 * semester's courses, registration status, fees and wallet, so "how much do I still owe?"
 * gets a real answer.
 *
 * Built on the server from the student's own session (the same calls the portal pages
 * make), so it only ever describes the student who is signed in. It leaves out what the
 * model doesn't need to help: matric number, email, phone, address and photo.
 *
 * Off with TORCH_STUDENT_CONTEXT=off.
 */

import { createHash } from "crypto";
import { getSessionToken } from "@/lib/session";
import { getStudentProfileAction } from "@/app/actions/user";
import { getStudentFeesAction, getWalletBalanceAction } from "@/app/actions/payment";
import { getAcademicResultsAction, getRegisteredCoursesAction } from "@/app/actions/academic-details";
import { getSemesterRegistrationStatusAction } from "@/app/actions/registration-semester";
import { getHasSubmittedCoursesAction } from "@/app/actions/registration-courses";
import { examEligibility } from "@/lib/payments/exam-eligibility";

export interface StudentSnapshot {
  firstName: string | null;
  programme: string | null;
  school: string | null;
  level: number | null;
  cgpa: number | null;
  semester: string | null;
  commenced: boolean | null;
  coursesSubmitted: boolean | null;
  lateRegistrationDate: string | null;
  courses: { code: string; title: string; units: number }[] | null;
  recentGpas: { semester: string; gpa: number }[] | null;
  fees: { semesterFee: number; paid: number; outstanding: number } | null;
  wallet: number | null;
}

const naira = (n: number) => `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/** The snapshot as a short brief for the system prompt; missing parts are said to be unavailable */
export function formatStudentContext(s: StudentSnapshot, today: Date = new Date()): string {
  const lines: string[] = [];
  const known = (v: unknown) => v !== null && v !== undefined && v !== "";

  if (s.firstName) lines.push(`- First name: ${s.firstName}`);
  if (s.programme) lines.push(`- Programme: ${s.programme}${s.school ? ` (${s.school})` : ""}`);
  if (known(s.level)) lines.push(`- Level: ${s.level}`);
  lines.push(`- CGPA: ${known(s.cgpa) ? s.cgpa!.toFixed(2) + " on a 5.00 scale" : "not available (results may not be published yet)"}`);
  if (s.recentGpas?.length) lines.push(`- Recent semester GPAs: ${s.recentGpas.map((g) => `${g.semester}: ${g.gpa.toFixed(2)}`).join("; ")}`);

  if (s.semester) lines.push(`- Current semester: ${s.semester}`);
  if (s.commenced !== null) lines.push(`- Commenced registration this semester: ${s.commenced ? "yes" : "no"}`);
  if (s.coursesSubmitted !== null) lines.push(`- Course form submitted: ${s.coursesSubmitted ? "yes" : "no"}`);
  if (s.lateRegistrationDate) lines.push(`- Late registration closes: ${s.lateRegistrationDate}`);
  if (s.courses) {
    lines.push(
      s.courses.length
        ? `- Registered courses (${s.courses.reduce((n, c) => n + c.units, 0)} units): ${s.courses.map((c) => `${c.code} ${c.title} (${c.units})`).join("; ")}`
        : "- Registered courses: none yet"
    );
  }

  if (s.fees) {
    const e = examEligibility({ semesterFee: s.fees.semesterFee, paid: s.fees.paid, outstanding: s.fees.outstanding, wallet: s.wallet });
    lines.push(`- Semester fee: ${naira(s.fees.semesterFee)}; paid so far: ${naira(s.fees.paid)}; outstanding from earlier: ${naira(Math.abs(s.fees.outstanding))}${s.fees.outstanding < 0 ? " (credit)" : ""}`);
    if (e.status === "eligible") lines.push("- Mid-semester exams: has paid at least 75%, so can write them");
    else if (e.status !== "unknown") lines.push(`- Mid-semester exams: needs to pay ${naira(e.needed)} more to reach the required 75% (${naira(e.target)})`);
  }
  lines.push(`- Wallet balance: ${s.wallet !== null ? naira(s.wallet) : "not available right now"}`);

  return `STUDENT RECORD (the signed-in student, as of ${today.toISOString().slice(0, 10)}):
${lines.join("\n")}

How to use the student record:
- Use it to answer questions about the student's own courses, results, registration, fees and wallet, and to tailor advice.
- Don't recite it unprompted, and never invent a figure that isn't in it. If something is "not available", say you can't see it right now and point to the right Pulse page (Finance, Academic Details or Registration).
- Amounts are in naira. The 75% rule decides whether a student can write mid-semester exams.`;
}

async function loadSnapshot(): Promise<StudentSnapshot> {
  const settled = await Promise.allSettled([
    getStudentProfileAction(),
    getSemesterRegistrationStatusAction(),
    getHasSubmittedCoursesAction(),
    getRegisteredCoursesAction(),
    getAcademicResultsAction(),
    getStudentFeesAction(),
    getWalletBalanceAction(),
  ]);
  const value = <T,>(r: PromiseSettledResult<T>) => (r.status === "fulfilled" ? r.value : null);
  const [profile, semester, submitted, courses, results, fees, wallet] = [
    value(settled[0]),
    value(settled[1]),
    value(settled[2]),
    value(settled[3]),
    value(settled[4]),
    value(settled[5]),
    value(settled[6]),
  ] as const;

  const ud = profile?.user_data;
  const fullName = ud?.personal_information?.student_name ?? ud?.student_name ?? profile?.entity_name ?? null;
  // Names come as "SURNAME, Firstname Middle"
  const firstName = fullName ? (fullName.includes(",") ? fullName.split(",")[1] : fullName).trim().split(/\s+/)[0] || null : null;
  const degree = ud?.degree_name ?? null;
  const department = ud?.department ?? null;
  const programme =
    degree && department && !degree.toLowerCase().includes(department.toLowerCase()) ? `${degree} ${department}`.replace(/\s+/g, " ").trim() : degree || department;

  return {
    firstName: firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase() : null,
    programme: programme || null,
    school: ud?.school_name ?? null,
    level: ud?.academic_information?.study_level ?? ud?.current_level ?? null,
    cgpa: ud?.academic_information?.cummulative_gpa ?? ud?.cummulative_gpa ?? null,
    semester: semester?.data?.semester ?? null,
    commenced: semester?.data ? Boolean(semester.data.check) : null,
    coursesSubmitted: submitted?.data ? submitted.data.hasSubmitted : null,
    lateRegistrationDate: semester?.data?.lateRegDate ?? null,
    courses: courses?.data ? courses.data.map((c) => ({ code: c.courseId, title: c.title, units: c.units })) : null,
    recentGpas: results?.data
      ? results.data
          .filter((r) => typeof r.semester_gpa === "number")
          .slice(-4)
          .map((r) => ({ semester: r.semester, gpa: r.semester_gpa as number }))
      : null,
    fees: fees?.success && fees.data ? { semesterFee: fees.data.estimated_semester_fee, paid: fees.data.amount_paid_for_semester, outstanding: fees.data.total_outstanding_fees } : null,
    wallet: wallet?.success && wallet.balance !== undefined ? wallet.balance : null,
  };
}

// Each message would otherwise repeat seven backend calls; a short per-session cache keeps chats quick
const CACHE_MS = 2 * 60_000;
const LOAD_TIMEOUT_MS = 6_000;
const cache = new Map<string, { at: number; text: string }>();

/** The signed-in student's brief for Torch, or null (signed out, switched off, or too slow) */
export async function getStudentContext(): Promise<string | null> {
  if (process.env.TORCH_STUDENT_CONTEXT?.toLowerCase() === "off") return null;
  const token = await getSessionToken();
  if (!token) return null;

  const key = createHash("sha256").update(token).digest("hex");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.text;

  try {
    const snapshot = await Promise.race([
      loadSnapshot(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Student record took too long")), LOAD_TIMEOUT_MS)),
    ]);
    const text = formatStudentContext(snapshot);
    cache.set(key, { at: Date.now(), text });
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
    return text;
  } catch (error) {
    // Torch still answers, just without the student's own figures
    console.warn("[AI chat] Student context unavailable:", error instanceof Error ? error.message : error);
    return null;
  }
}
