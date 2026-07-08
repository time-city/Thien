import { prisma } from "./src/lib/prisma";

async function main() {
  const sessions = await prisma.classSession.findMany({
    where: {
      class: { name: { contains: "Hóa 9 NTĐ" } },
    },
    include: {
      class: true,
    },
  });
  console.log(
    "Found sessions:",
    sessions.map((s) => ({ id: s.id, date: s.date, status: s.status }))
  );

  if (sessions.length > 0) {
    const sId = sessions[sessions.length - 1].id;
    const cId = sessions[sessions.length - 1].classId;

    // ✅ Fix: prisma expects `string | UuidFilter | undefined` (NOT `null`)
    if (!cId) {
      console.log("Latest session has no classId; skip enrollment counts.");
      return;
    }

    const totalStudents = await prisma.enrollment.count({
      where: { classId: cId, status: "ACTIVE" },
    });

    const assessedStudentsCount = await prisma.attendanceLog.count({
      where: { classSessionId: sId },
    });

    console.log("For latest session:");
    console.log("totalStudents (ACTIVE enrollments):", totalStudents);
    console.log(
      "assessedStudentsCount (AttendanceLogs):",
      assessedStudentsCount
    );

    // Which students are enrolled but NOT assessed?
    const enrolled = await prisma.enrollment.findMany({
      where: { classId: cId, status: "ACTIVE" },
      select: {
        studentId: true,
        student: { select: { fullName: true } },
      },
    });
    const assessed = await prisma.attendanceLog.findMany({
      where: { classSessionId: sId },
      select: { studentId: true },
    });

    const assessedIds = assessed.map((a) => a.studentId);
    const missing = enrolled.filter((e) => !assessedIds.includes(e.studentId));

    console.log("Missing students:", missing.map((m) => m.student.fullName));
  }
}
main();

