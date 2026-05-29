import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import TaCheckInClient from "./TaCheckInClient";
import Link from "next/link";

export default async function ClassRosterPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; sessionId?: string; page?: string }> | { classId?: string; sessionId?: string; page?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const resolvedParams = await searchParams;
  const { classId, sessionId, page } = resolvedParams;

  if (!classId || !sessionId) {
    return (
      <div className="p-8 max-w-2xl mx-auto mt-10 bg-rose-50 border border-rose-200 rounded-xl text-center shadow-sm">
        <h2 className="text-xl font-bold text-rose-700 mb-2">Lỗi Truy Cập</h2>
        <p className="text-slate-600 font-medium">Không tìm thấy mã Lớp (classId) hoặc mã Ca học (sessionId) trên URL.</p>
        <Link href="/schedule" className="inline-block mt-4 bg-blue-600 text-white font-bold px-6 py-2 rounded-lg hover:bg-blue-700">
          Quay lại
        </Link>
      </div>
    );
  }

  const sessionInfo = await prisma.classSession.findUnique({
    where: { id: sessionId },
    include: { class: true, teacher: true }
  });

  if (!sessionInfo) {
    return (
      <div className="p-8 max-w-2xl mx-auto mt-10 bg-amber-50 border border-amber-200 rounded-xl text-center shadow-sm">
        <h2 className="text-xl font-bold text-amber-700 mb-2">Ca học không tồn tại</h2>
        <Link href="/schedule" className="inline-block mt-4 bg-blue-600 text-white font-bold px-6 py-2 rounded-lg hover:bg-blue-700">
          Quay lại Bảng Lịch Dạy
        </Link>
      </div>
    );
  }

  // --- BẮT ĐẦU ĐOẠN LOG DEBUG ---
  const currentPage = Number(page) > 0 ? Number(page) : 1;
  const pageSize = 10;
  const skip = (currentPage - 1) * pageSize;

  const totalStudents = await prisma.enrollment.count({
    where: { classId: classId, status: "ACTIVE" }
  });
  const totalPages = Math.ceil(totalStudents / pageSize) || 1;

  console.log("\n================ DEBUG PHÂN TRANG ================");
  console.log("1. Param 'page' lấy từ URL:", page);
  console.log("2. Tính toán: currentPage =", currentPage, "| skip =", skip, "| take =", pageSize);
  console.log("3. Tổng số học sinh lớp này:", totalStudents, "=> Tổng số trang:", totalPages);

  const enrollments = await prisma.enrollment.findMany({
    where: { classId: classId, status: "ACTIVE" },
    skip: skip,
    take: pageSize,
    include: {
      student: {
        include: {
          attendanceLogs: {
            where: { classSessionId: sessionId }
          }
        }
      }
    },
    orderBy: { student: { fullName: "asc" } }
  });

  console.log("4. Prisma trả về số lượng data:", enrollments.length);
  console.log("5. Danh sách học sinh trên trang này:");
  enrollments.forEach((e, idx) => {
    console.log(`   [STT ${skip + idx + 1}] ID: ${e.studentId} | Tên: ${e.student.fullName}`);
  });
  console.log("====================================================\n");
  // --- KẾT THÚC LOG DEBUG ---

  const mappedStudents = enrollments.map((e, idx) => {
    const currentLog = e.student.attendanceLogs[0]; 
    const stt = (skip + idx + 1).toString();

    return {
      id: e.student.id,
      fullName: e.student.fullName,
      className: sessionInfo.class.name,
      seat: stt, 
      attendance: currentLog?.attendanceStatus || undefined,
      homework: currentLog?.homeworkStatus || undefined,
      note: currentLog?.note || "",
      phone: e.student.phoneStudent,
      parentName: e.student.parentName,
      parentPhone: e.student.phoneParent,
      remainingSessions: e.remainingSessions,
      feeStatus: e.feeStatus,
    };
  });

  return (
    <TaCheckInClient
      sessionInfo={{
        className: sessionInfo.class.name,
        teacherName: sessionInfo.teacher.fullName,
        date: sessionInfo.date.toISOString(),
        slot: sessionInfo.slot,
      }}
      students={mappedStudents}
      currentPage={currentPage}
      totalPages={totalPages}
      classId={classId}
      sessionId={sessionId}
    />
  );
}