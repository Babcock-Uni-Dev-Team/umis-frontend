import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/session", () => ({ getSessionToken: vi.fn() }));
vi.mock("@/app/actions/user", () => ({ getStudentProfileAction: vi.fn() }));
vi.mock("@/app/actions/payment", () => ({ getStudentFeesAction: vi.fn(), getWalletBalanceAction: vi.fn() }));
vi.mock("@/app/actions/academic-details", () => ({ getAcademicResultsAction: vi.fn(), getRegisteredCoursesAction: vi.fn() }));
vi.mock("@/app/actions/registration-semester", () => ({ getSemesterRegistrationStatusAction: vi.fn() }));
vi.mock("@/app/actions/registration-courses", () => ({ getHasSubmittedCoursesAction: vi.fn() }));

import { formatStudentContext, type StudentSnapshot } from "./student-context";

const snapshot: StudentSnapshot = {
  firstName: "Tomiwa",
  programme: "B.Sc. Information Technology",
  school: "School of Computing",
  level: 200,
  cgpa: 4.13,
  semester: "2026/2027.1",
  commenced: true,
  coursesSubmitted: false,
  lateRegistrationDate: "2026-11-20",
  courses: [
    { code: "COSC 204", title: "Data Structures", units: 3 },
    { code: "GEDS 210", title: "Entrepreneurship", units: 2 },
  ],
  recentGpas: [{ semester: "2025/2026.2", gpa: 4.2 }],
  fees: { semesterFee: 2_000_000, paid: 500_000, outstanding: 0 },
  wallet: 200_000,
};

describe("formatStudentContext", () => {
  const text = formatStudentContext(snapshot, new Date("2026-11-10T09:00:00Z"));

  it("gives Torch the student's own record", () => {
    expect(text).toContain("First name: Tomiwa");
    expect(text).toContain("CGPA: 4.13 on a 5.00 scale");
    expect(text).toContain("Registered courses (5 units): COSC 204 Data Structures (3); GEDS 210 Entrepreneurship (2)");
    expect(text).toContain("Course form submitted: no");
    expect(text).toContain("Wallet balance: ₦200,000");
  });

  it("works out the mid-semester 75% rule", () => {
    expect(text).toContain("needs to pay ₦1,000,000 more to reach the required 75% (₦1,500,000)");
  });

  it("says what's missing instead of guessing", () => {
    const sparse = formatStudentContext({ ...snapshot, cgpa: null, wallet: null, fees: null });

    expect(sparse).toContain("CGPA: not available");
    expect(sparse).toContain("Wallet balance: not available right now");
    expect(sparse).not.toContain("Mid-semester exams");
  });

  it("never includes identifying details it wasn't given", () => {
    expect(text).not.toMatch(/matric|@|phone|address/i);
  });
});
