"use server"

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { ClassStatus, PaymentMethod } from "@prisma/client";

// Hàm hỗ trợ kiểm tra quyền (Gọi đầu tiên trong mọi action)
async function checkSuperAdmin() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    throw new Error("Không đủ thẩm quyền!");
  }
}

export async function getPendingSessionsCount() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") return 0;
  
  return await prisma.classSession.count({
    where: { status: "PENDING" }
  });
}

// ==========================================
// 1. ACTIONS CHO HỌC SINH (STUDENTS)
// ==========================================
type StudentDobInput = string | Date | null | undefined;

function parseDobToUtcDate(dob: StudentDobInput): Date | null {
  if (!dob) return null;
  if (dob instanceof Date) {
    return isNaN(dob.getTime()) ? null : dob;
  }

  // Expected format: YYYY-MM-DD from <input type="date" />
  const match = /^\d{4}-\d{2}-\d{2}$/.exec(dob);
  if (!match) {
    const parsed = new Date(dob);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  const [y, m, d] = dob.split("-").map(Number);
  // Create midnight UTC to avoid timezone shift
  return new Date(Date.UTC(y, m - 1, d));
}
export async function createStudent(data: { 
  fullName: string; 
  phoneStudent?: string; 
  parentName?: string; 
  phoneParent?: string; 
  gender?: string;
  dob?: StudentDobInput;
  school?: string | null;
  // Đổi từ classIds sang mảng object chứa trạng thái học phí
  classEnrollments?: { classId: string; feeStatus: "PAID" | "UNPAID" }[]; 
}) {
  await checkSuperAdmin();
  try {
    let enrollmentsData: any[] = [];

    // Nếu có chọn lớp, móc db Class ra để lấy số buổi của gói (sessionsPerPackage)
    if (data.classEnrollments && data.classEnrollments.length > 0) {
      const classIds = data.classEnrollments.map(c => c.classId);
      const classesInfo = await prisma.class.findMany({ where: { id: { in: classIds } } });
      
      enrollmentsData = data.classEnrollments.map(ce => {
        const cls = classesInfo.find(c => c.id === ce.classId);
        return {
          classId: ce.classId,
          feeStatus: ce.feeStatus,
          // Nếu PAID -> Lấy đủ số buổi của khóa. Nếu UNPAID -> 0 buổi
          remainingSessions: ce.feeStatus === "PAID" ? (cls?.sessionsPerPackage || 0) : 0
        };
      });
    }

    await prisma.student.create({
      data: {
        fullName: data.fullName,
        phoneStudent: data.phoneStudent,
        parentName: data.parentName,
        phoneParent: data.phoneParent,
        gender: data.gender === "MALE" || data.gender === "FEMALE" || data.gender === "OTHER" ? data.gender : null,
        dob: parseDobToUtcDate(data.dob),
        school: data.school ?? null,
        enrollments: enrollmentsData.length > 0 ? {
          create: enrollmentsData
        } : undefined
      }
    });
    revalidatePath("/admin/students");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Lỗi tạo học sinh" };
  }
}

export async function updateStudent(id: string, data: any) {
  await checkSuperAdmin();
  try {
    const { classEnrollments, dob, school, ...rest } = data; // Lấy classEnrollments thay vì classIds

    const updateData: any = {
      ...rest,
      dob: parseDobToUtcDate(dob),
      school: school ?? null,
    };

    await prisma.$transaction(async (tx) => {
      await tx.student.update({ where: { id }, data: updateData });

      if (classEnrollments && Array.isArray(classEnrollments)) {
        const existingEnrollments = await tx.enrollment.findMany({
          where: { studentId: id }
        });
        const existingClassIds = existingEnrollments.map(e => e.classId);
        const newClassIds = classEnrollments.map(ce => ce.classId);
        
        const classIdsToRemove = existingClassIds.filter(cid => !newClassIds.includes(cid));
        // Lọc ra NHỮNG LỚP ĐƯỢC THÊM MỚI HOÀN TOÀN
        const classesToAdd = classEnrollments.filter(ce => !existingClassIds.includes(ce.classId));

        // Xóa những lớp bị bỏ tick
        if (classIdsToRemove.length > 0) {
          await tx.enrollment.deleteMany({
            where: {
              studentId: id,
              classId: { in: classIdsToRemove }
            }
          });
        }

        // Tạo ghi danh cho những lớp thêm mới (Kèm logic Paid/Unpaid)
        if (classesToAdd.length > 0) {
          const classIdsToAdd = classesToAdd.map(c => c.classId);
          const classesInfo = await tx.class.findMany({ where: { id: { in: classIdsToAdd } } });

          await tx.enrollment.createMany({
            data: classesToAdd.map(ce => {
              const cls = classesInfo.find(c => c.id === ce.classId);
              return {
                studentId: id,
                classId: ce.classId,
                feeStatus: ce.feeStatus,
                // PAID thì cấp buổi, UNPAID thì 0 buổi
                remainingSessions: ce.feeStatus === "PAID" ? (cls?.sessionsPerPackage || 0) : 0
              };
            })
          });
        }
      }
    });

    revalidatePath("/admin/students");
    return { success: true };
  } catch (error) {
    console.error("updateStudent error:", error);
    return { success: false, error: "Lỗi cập nhật học sinh" };
  }
}
export async function importStudentsCsv(data: { 
  fullName: string; 
  phoneStudent?: string; 
  parentName?: string; 
  phoneParent?: string; 
  gender?: string;
  className?: string;
  school?: string;
  dob?: string;
  createdAt?: string;
  feeStatus?: string;
}[]) {
  await checkSuperAdmin();
  try {
    // 1. Lọc dữ liệu hợp lệ
    const validData = data.filter(d => d.fullName?.trim());
    if (validData.length === 0) return { success: false, error: "File CSV không có dữ liệu hợp lệ" };

    // 2. Thu thập danh sách lớp học có trong file
    const classNamesInCsv = Array.from(new Set(validData.map(d => d.className?.trim()).filter(Boolean) as string[]));

    // 3. Tìm các lớp học trong hệ thống
    const existingClasses = await prisma.class.findMany({
      where: { name: { in: classNamesInCsv } }
    });
    const existingClassNames = existingClasses.map(c => c.name);

    // 4. Báo lỗi nếu có lớp chưa được tạo
    const missingClasses = classNamesInCsv.filter(name => !existingClassNames.includes(name));
    if (missingClasses.length > 0) {
      return { 
        success: false, 
        error: `Các lớp sau chưa được tạo trên hệ thống: ${missingClasses.join(', ')}. Vui lòng tạo lớp trước khi import.` 
      };
    }

    // Hàm hỗ trợ parse DD/MM/YYYY sang Date UTC
    const parseDDMMYYYY = (dateString?: string) => {
      if (!dateString) return undefined;
      const parts = dateString.trim().split('/');
      if (parts.length === 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const y = parseInt(parts[2], 10);
        if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
          return new Date(Date.UTC(y, m - 1, d));
        }
      }
      return undefined;
    };

    // 5. Thêm dữ liệu (dùng Transaction để đảm bảo tính toàn vẹn)
    await prisma.$transaction(async (tx) => {
      for (const row of validData) {
        let genderEnum: any = null;
        if (row.gender === "MALE" || row.gender === "FEMALE" || row.gender === "OTHER") {
          genderEnum = row.gender;
        }

        const classNameStr = row.className?.trim();
        const classInfo = classNameStr ? existingClasses.find(c => c.name === classNameStr) : null;
        
        let enrollmentsData: any = undefined;
        if (classInfo) {
          const isPaid = row.feeStatus === "PAID";
          enrollmentsData = {
            create: [{
              classId: classInfo.id,
              feeStatus: isPaid ? "PAID" : "UNPAID",
              remainingSessions: isPaid ? classInfo.sessionsPerPackage : 0,
              currentVoucher: isPaid ? 1 : 0
            }]
          };
        }

        const parsedCreatedAt = parseDDMMYYYY(row.createdAt);

        await tx.student.create({
          data: {
            fullName: row.fullName.trim(),
            phoneStudent: row.phoneStudent,
            parentName: row.parentName,
            phoneParent: row.phoneParent,
            gender: genderEnum,
            school: row.school,
            dob: parseDDMMYYYY(row.dob),
            createdAt: parsedCreatedAt ? parsedCreatedAt : undefined,
            enrollments: enrollmentsData
          }
        });
      }
    }, {
      timeout: 60000, // Tăng timeout lên 60 giây cho các file CSV cực lớn
    });

    revalidatePath("/admin/students");
    return { success: true, count: validData.length };
  } catch(error) {
    console.error("importStudentsCsv error:", error);
    return { success: false, error: "Lỗi import file CSV" };
  }
}

export async function deleteStudent(id: string) {
  await checkSuperAdmin();
  try {
    await prisma.student.delete({ where: { id } });
    revalidatePath("/admin/students");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Lỗi xóa học sinh" };
  }
}

export async function deleteStudents(ids: string[]) {
  await checkSuperAdmin();
  try {
    await prisma.student.deleteMany({ where: { id: { in: ids } } });
    revalidatePath("/admin/students");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Lỗi xóa nhiều học sinh" };
  }
}

async function requireTeacherSession() {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Vui lòng đăng nhập" as const };
  if (session.user.role !== "TEACHER") {
    return { success: false, error: "Không đủ quyền" as const };
  }

  return { success: true, teacherId: session.user.id };
}

async function getTeacherManagedClassIds(teacherId: string) {
  const links = await prisma.classTeacher.findMany({
    where: { teacherId },
    select: { classId: true },
  });

  return links.map((link) => link.classId);
}

type TeacherStudentEnrollmentInput = { classId: string };

type TeacherStudentPayload = {
  fullName: string;
  phoneStudent?: string;
  parentName?: string;
  phoneParent?: string;
  gender?: string;
  dob?: StudentDobInput;
  school?: string | null;
  classEnrollments?: TeacherStudentEnrollmentInput[];
};

export async function addStudentByTeacher(data: TeacherStudentPayload) {
  const teacherSession = await requireTeacherSession();
  if (!teacherSession.success) return teacherSession;

  try {
    const managedClassIds = await getTeacherManagedClassIds(teacherSession.teacherId || "");
    const selectedClassIds = Array.from(new Set((data.classEnrollments ?? []).map((item) => item.classId)));

    if (selectedClassIds.length === 0) {
      return { success: false, error: "Vui lòng chọn ít nhất 1 lớp" };
    }

    const invalidClassId = selectedClassIds.find((classId) => !managedClassIds.includes(classId));
    if (invalidClassId) {
      return { success: false, error: "Bạn chỉ được thêm học sinh vào các lớp do mình quản lý" };
    }

    const classesInfo = await prisma.class.findMany({
      where: { id: { in: selectedClassIds } },
      select: { id: true, sessionsPerPackage: true },
    });

    await prisma.student.create({
      data: {
        fullName: data.fullName,
        phoneStudent: data.phoneStudent,
        parentName: data.parentName,
        phoneParent: data.phoneParent,
        gender: data.gender === "MALE" || data.gender === "FEMALE" || data.gender === "OTHER" ? data.gender : null,
        dob: parseDobToUtcDate(data.dob),
        school: data.school ?? null,
        enrollments: {
          create: selectedClassIds.map((classId) => {
            const classInfo = classesInfo.find((item) => item.id === classId);

            return {
              classId,
              feeStatus: "PAID",
              remainingSessions: classInfo?.sessionsPerPackage ?? 0,
            };
          }),
        },
      },
    });

    revalidatePath("/myClass");
    return { success: true };
  } catch (error) {
    console.error("addStudentByTeacher error:", error);
    return { success: false, error: "Lỗi tạo học sinh" };
  }
}

// ==========================================
// 1B. ACTIONS CHO PHÒNG HỌC (ROOMS)
// ==========================================

export async function createRoom(data: { name: string; capacity?: number; feePerSession?: number }) {
  await checkSuperAdmin();
  try {
    await prisma.room.create({
      data: {
        name: data.name.trim(),
        capacity: typeof data.capacity === "number" ? data.capacity : null,
        feePerSession: typeof data.feePerSession === "number" ? data.feePerSession : 0,
      },
    });

    revalidatePath("/admin/rooms");
    return { success: true };
  } catch (error) {
    console.error("createRoom error:", error);
    return { success: false, error: "Lỗi tạo phòng học" };
  }
}

export async function updateRoom(
  id: string,
  data: { name: string; capacity?: number; feePerSession?: number; isActive?: boolean }
) {
  await checkSuperAdmin();
  try {
    await prisma.room.update({
      where: { id },
      data: {
        name: data.name.trim(),
        capacity: typeof data.capacity === "number" ? data.capacity : null,
        feePerSession: typeof data.feePerSession === "number" ? data.feePerSession : undefined,
        ...(typeof data.isActive === "boolean" ? { isActive: data.isActive } : {}),
      },
    });

    revalidatePath("/admin/rooms");
    return { success: true };
  } catch (error) {
    console.error("updateRoom error:", error);
    return { success: false, error: "Lỗi cập nhật phòng học" };
  }
}

export async function getRoomDeletionImpact(roomId: string) {
  await checkSuperAdmin();
  try {
    const classSessionCount = await prisma.classSession.count({
      where: { roomId },
    });

    return {
      success: true,
      impact: {
        classSessionCount,
      },
    };
  } catch (error) {
    console.error("getRoomDeletionImpact error:", error);
    return { success: false, error: "Không thể kiểm tra dữ liệu phòng học" };
  }
}

export async function deleteRoom(id: string) {
  await checkSuperAdmin();
  try {
    await prisma.room.delete({
      where: { id },
    });

    revalidatePath("/admin/rooms");
    return { success: true };
  } catch (error) {
    console.error("deleteRoom error:", error);
    return { success: false, error: "Lỗi xóa phòng học" };
  }
}

export async function getStudentDeletionImpact(studentId: string) {
  try {
    const enrollmentsCount = await prisma.enrollment.count({ where: { studentId } });
    const paymentsCount = await prisma.paymentHistory.count({ where: { studentId } });
    const attendanceCount = await prisma.attendanceLog.count({ where: { studentId } });

    return { 
      success: true, 
      impact: { 
        enrollmentCount: enrollmentsCount, 
        paymentCount: paymentsCount, 
        attendanceCount: attendanceCount 
      } 
    };
  } catch (error) {
    return { success: false, error: "Không thể kiểm tra dữ liệu học sinh." };
  }
}

// ==========================
// Teacher-scoped student actions
// ==========================
export async function updateStudentByTeacher(id: string, data: any) {
  const teacherSession = await requireTeacherSession();
  if (!teacherSession.success) return teacherSession;

  try {
    const managedClassIds = await getTeacherManagedClassIds(teacherSession.teacherId || "");
    const existingEnrollments = await prisma.enrollment.findMany({
      where: { studentId: id },
      select: { id: true, classId: true },
    });

    const teacherOwnedEnrollments = existingEnrollments.filter((enrollment) => managedClassIds.includes(enrollment.classId));
    const teacherOwnedClassIds = teacherOwnedEnrollments.map((enrollment) => enrollment.classId);

    const selectedClassIds = data.classEnrollments
      ? Array.from(new Set((data.classEnrollments as TeacherStudentEnrollmentInput[]).map((item) => item.classId)))
      : null;

    if (selectedClassIds) {
      const invalidClassId = selectedClassIds.find((classId) => !managedClassIds.includes(classId));
      if (invalidClassId) {
        return { success: false, error: "Bạn chỉ được thêm/xóa lớp trong phạm vi quản lý của mình" };
      }
    }

    const updateData: any = {
      fullName: data.fullName,
      phoneStudent: data.phoneStudent,
      parentName: data.parentName,
      phoneParent: data.phoneParent,
      gender: data.gender === "MALE" || data.gender === "FEMALE" || data.gender === "OTHER" ? data.gender : undefined,
      dob: parseDobToUtcDate(data.dob),
      school: data.school ?? undefined,
    };

    await prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id },
        data: Object.fromEntries(Object.entries(updateData).filter(([, value]) => value !== undefined)),
      });

      if (selectedClassIds) {
        const classIdsToRemove = teacherOwnedClassIds.filter((classId) => !selectedClassIds.includes(classId));
        const classIdsToAdd = selectedClassIds.filter((classId) => !teacherOwnedClassIds.includes(classId));

        if (classIdsToRemove.length > 0) {
          await tx.enrollment.deleteMany({
            where: { studentId: id, classId: { in: classIdsToRemove } },
          });
        }

        if (classIdsToAdd.length > 0) {
          const classesInfo = await tx.class.findMany({
            where: { id: { in: classIdsToAdd } },
            select: { id: true, sessionsPerPackage: true },
          });

          await tx.enrollment.createMany({
            data: classIdsToAdd.map((classId) => {
              const classInfo = classesInfo.find((item) => item.id === classId);
              return {
                studentId: id,
                classId,
                feeStatus: "PAID",
                remainingSessions: classInfo?.sessionsPerPackage ?? 0,
              };
            }),
          });
        }
      }
    });

    revalidatePath("/myClass");
    revalidatePath("/myClass/");
    return { success: true };
  } catch (error) {
    console.error("updateStudentByTeacher error:", error);
    return { success: false, error: "Lỗi cập nhật học sinh" };
  }
}

export async function deleteStudentByTeacher(id: string) {
  const teacherSession = await requireTeacherSession();
  if (!teacherSession.success) return teacherSession;

  try {
    const impact = await getStudentDeletionImpact(id);
    if (!impact.success) return { success: false, error: "Không thể kiểm tra dữ liệu liên quan" };

    // Disallow if has payments or attendance logs
    const impactData = impact.impact;
    if (!impactData) return { success: false, error: "Không thể kiểm tra dữ liệu liên quan" };

    if (impactData.paymentCount > 0 || impactData.attendanceCount > 0) {
      return { success: false, error: "Học sinh có dữ liệu điểm danh hoặc thanh toán, không thể xóa" };
    }

    // Ensure all enrollments belong to classes taught by this teacher
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: id },
      include: { class: { include: { teachers: true } } },
    });
    const allInTeacherClasses = enrollments.every((enrollment) =>
      enrollment.class.teachers.some((teacher) => teacher.teacherId === teacherSession.teacherId)
    );
    if (!allInTeacherClasses) return { success: false, error: "Bạn chỉ có thể xóa học sinh chỉ thuộc lớp của bạn" };

    await prisma.student.delete({ where: { id } });
    revalidatePath("/myClass");
    return { success: true };
  } catch (error) {
    console.error("deleteStudentByTeacher error:", error);
    return { success: false, error: "Lỗi xóa học sinh" };
  }
}

// ==========================================
// 2. ACTIONS CHO ĐÁNH GIÁ/ĐIỂM DANH (ATTENDANCE & EVALUATION)
// ==========================================

export async function saveStudentEvaluation(data: {
  classSessionId: string;
  studentId: string;
  attendanceStatus: "PRESENT" | "LATE" | "EXCUSED" | "UNEXCUSED";
  homeworkStatus?: "GOOD" | "DONE" | "NOT_DONE" | null;
  note?: string | null;
}) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Vui lòng đăng nhập!" };
  }

  try {
    const existingLog = await prisma.attendanceLog.findFirst({
      where: {
        classSessionId: data.classSessionId,
        studentId: data.studentId,
      },
    });

    if (existingLog) {
      await prisma.attendanceLog.update({
        where: { id: existingLog.id },
        data: {
          attendanceStatus: data.attendanceStatus,
          homeworkStatus: data.homeworkStatus,
          note: data.note,
        },
      });
    } else {
      await prisma.attendanceLog.create({
        data: {
          classSessionId: data.classSessionId,
          studentId: data.studentId,
          attendanceStatus: data.attendanceStatus,
          homeworkStatus: data.homeworkStatus,
          note: data.note,
        },
      });
    }

    revalidatePath("/ta");
    revalidatePath("/schedule");
    
    return { success: true };
  } catch (error) {
    console.error("Save evaluation error:", error);
    return { success: false, error: "Lỗi khi lưu đánh giá học sinh" };
  }
}

// ==========================================
// 3. ACTIONS CHO GIÁO VIÊN (TEACHERS)
// ==========================================
export async function createTeacher(data: {
  username: string;
  password: string;
  fullName: string;
  isActive?: boolean;
}) {
  await checkSuperAdmin();
  try {
    const session = await auth();
    if (!session?.user) throw new Error("Bạn chưa đăng nhập");

    const bcrypt = await import("bcryptjs");
    const hashed = await bcrypt.hash(data.password, 10);

    await prisma.user.create({
      data: {
        username: data.username,
        passwordHash: hashed,
        fullName: data.fullName,
        role: "TEACHER",
        isActive: data.isActive ?? true,
      },
    });

    revalidatePath("/admin/teachers");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Lỗi tạo giáo viên" };
  }
}

export async function updateTeacher(
  teacherId: string,
  data: {
    fullName?: string;
    isActive?: boolean;
  }
) {
  await checkSuperAdmin();
  try {
    await prisma.user.update({
      where: { id: teacherId },
      data: {
        fullName: data.fullName,
        isActive: data.isActive,
      },
    });
    revalidatePath("/admin/teachers");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Lỗi cập nhật giáo viên" };
  }
}

export async function banTeacher(teacherId: string) {
  await checkSuperAdmin();
  try {
    await prisma.user.update({
      where: { id: teacherId },
      data: { isActive: false },
    });

    revalidatePath("/admin/teachers");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Lỗi ban giáo viên" };
  }
}

export async function getTeacherBanImpact(teacherId: string) {
  await checkSuperAdmin();
  try {
    const now = new Date();

    const activeFutureSessionsCount = await prisma.classSession.count({
      where: { teacherId, date: { gte: now } },
    });

    const roomRentalLogsCount = await prisma.roomRentalLog.count({
      where: { teacherId },
    });

    return {
      success: true,
      impact: {
        activeFutureSessionsCount,
        roomRentalLogsCount,
      },
    };
  } catch (error) {
    return { success: false, error: "Không thể kiểm tra dữ liệu ban giáo viên" };
  }
}

export async function getTeacherDeletionImpact(teacherId: string) {
  await checkSuperAdmin();
  try {
    const classSessionsCount = await prisma.classSession.count({
      where: { teacherId },
    });

    const roomRentalLogsCount = await prisma.roomRentalLog.count({
      where: { teacherId },
    });

    const salaryPaymentsCount = await prisma.salaryPayment.count({
      where: { teacherId },
    });

    const classTeacherLinksCount = await prisma.classTeacher.count({
      where: { teacherId },
    });

    return {
      success: true,
      impact: {
        classSessionsCount,
        roomRentalLogsCount,
        salaryPaymentsCount,
        classTeacherLinksCount,
      },
    };
  } catch (error) {
    return { success: false, error: "Không thể kiểm tra ảnh hưởng khi xóa giáo viên" };
  }
}

export async function deleteTeacher(teacherId: string) {
  await checkSuperAdmin();
  try {
    await prisma.user.delete({ where: { id: teacherId } });
    revalidatePath("/admin/teachers");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Lỗi xóa giáo viên" };
  }
}

// ==========================================
// 4. ACTIONS CHO LỚP HỌC (CLASSES)
// ==========================================
export async function createClass(data: { 
  name: string; 
  category: string; 
  pricePerSession: number;
  sessionsPerPackage: number;
  teacherId?: string 
}) {
  try {
    const session = await auth();
    const role = session?.user?.role;

    if (!session?.user) {
      return { success: false, error: "Vui lòng đăng nhập" };
    }

    if (role !== "SUPER_ADMIN" && role !== "TEACHER") {
      return { success: false, error: "Không đủ quyền tạo lớp học" };
    }

    const status = role === "TEACHER" ? ClassStatus.PENDING : ClassStatus.APPROVED;

    const assignedTeacherId = role === "TEACHER" ? session.user.id : data.teacherId;

    await prisma.class.create({
      data: {
        name: data.name,
        category: data.category,
        pricePerSession: data.pricePerSession,
        sessionsPerPackage: data.sessionsPerPackage,
        status,
        createdById: session.user.id,
        teachers: assignedTeacherId
          ? {
              create: {
                teacherId: assignedTeacherId,
              },
            }
          : undefined,
      },
    });

    revalidatePath("/admin/classes");
    return { success: true };
  } catch (error) {
    console.error("createClass error:", error);
    return { success: false, error: "Lỗi tạo lớp học" };
  }
}

export async function approveOrRejectClass(
  id: string,
  status: "APPROVED" | "REJECTED"
) {
  await checkSuperAdmin();
  try {
    await prisma.class.update({
      where: { id },
      data: { status },
    });

    revalidatePath("/admin/classes");
    return { success: true };
  } catch (error) {
    console.error("approveOrRejectClass error:", error);
    return { success: false, error: "Lỗi duyệt/từ chối lớp học" };
  }
}

export async function updateClass(
  id: string,
  data: { 
    name?: string; 
    category?: string; 
    pricePerSession?: number;
    sessionsPerPackage?: number;
    teacherId?: string 
  }
) {
  await checkSuperAdmin();
  try {
    await prisma.$transaction(async (tx) => {
      await tx.classTeacher.deleteMany({ where: { classId: id } });

      await tx.class.update({
        where: { id },
        data: {
          name: data.name,
          category: data.category,
          pricePerSession: data.pricePerSession,
          sessionsPerPackage: data.sessionsPerPackage,
        },
      });

      if (data.teacherId) {
        await tx.classTeacher.create({
          data: {
            classId: id,
            teacherId: data.teacherId,
          },
        });
      }
    });

    revalidatePath("/admin/classes");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Lỗi cập nhật lớp học" };
  }
}

export async function updateClassByTeacher(
  classId: string,
  data: {
    name?: string;
    category?: string;
    pricePerSession?: number;
    sessionsPerPackage?: number;
  }
) {
  const teacherSession = await requireTeacherSession();
  if (!teacherSession.success) return teacherSession;

  try {
    const classRecord = await prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, createdById: true, status: true },
    });

    if (!classRecord) {
      return { success: false, error: "Không tìm thấy lớp học" };
    }

    if (classRecord.createdById !== teacherSession.teacherId) {
      return { success: false, error: "Bạn chỉ được sửa lớp do chính mình tạo" };
    }

    await prisma.class.update({
      where: { id: classId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.pricePerSession !== undefined ? { pricePerSession: data.pricePerSession } : {}),
        ...(data.sessionsPerPackage !== undefined ? { sessionsPerPackage: data.sessionsPerPackage } : {}),
        status: classRecord.status === ClassStatus.APPROVED ? ClassStatus.PENDING : classRecord.status,
      },
    });

    revalidatePath("/myClass");
    revalidatePath("/admin/classes");
    return { success: true };
  } catch (error) {
    console.error("updateClassByTeacher error:", error);
    return { success: false, error: "Lỗi cập nhật lớp học" };
  }
}

export async function deleteClassByTeacher(classId: string) {
  const teacherSession = await requireTeacherSession();
  if (!teacherSession.success) return teacherSession;

  try {
    const classRecord = await prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, createdById: true, status: true },
    });

    if (!classRecord) {
      return { success: false, error: "Không tìm thấy lớp học" };
    }

    const impact = await prisma.enrollment.aggregate({
      where: { classId },
      _count: { _all: true },
    });
    const enrollmentCount = impact._count._all;

    const canDeleteByCreator = classRecord.createdById === teacherSession.teacherId;
    const canDeletePendingNoStudents = classRecord.status === ClassStatus.PENDING && enrollmentCount === 0;

    if (!canDeleteByCreator && !canDeletePendingNoStudents) {
      return { success: false, error: "Bạn không có quyền xóa lớp này" };
    }

    await prisma.class.delete({ where: { id: classId } });
    revalidatePath("/myClass");
    revalidatePath("/admin/classes");
    return { success: true };
  } catch (error) {
    console.error("deleteClassByTeacher error:", error);
    return { success: false, error: "Lỗi xóa lớp học" };
  }
}

export async function getClassDeletionImpact(classId: string) {
  await checkSuperAdmin();
  try {
    const classTeacherCount = await prisma.classTeacher.count({ where: { classId } });
    const enrollmentCount = await prisma.enrollment.count({ where: { classId } });
    const sessionCount = await prisma.classSession.count({ where: { classId } });
    const paymentCount = await prisma.paymentHistory.count({ where: { classId } });

    return { success: true, impact: { classTeacherCount, enrollmentCount, sessionCount, paymentCount } };
  } catch (error) {
    console.error("Lỗi khi kiểm tra dữ liệu ảnh hưởng của lớp học:", error);
    return { success: false, error: "Lỗi hệ thống khi kiểm tra dữ liệu lớp học." };
  }
}

export async function deleteClass(id: string) {
  try {
    await prisma.class.delete({
      where: { id },
    });
    revalidatePath("/admin/classes");
    return { success: true };
  } catch (error) {
    console.error("Lỗi khi xóa lớp học:", error);
    return { success: false, error: "Đã xảy ra lỗi khi xóa lớp học." };
  }
}

// ==========================================
// 5. TEACHER: SUBMIT ATTENDANCE & CALCULATE FINANCE
// ==========================================

type AttendanceInput = {
  studentId: string;
  attendanceStatus: "PRESENT" | "LATE" | "EXCUSED" | "UNEXCUSED";
  homeworkStatus?: "GOOD" | "DONE" | "NOT_DONE" | null;
  note?: string | null;
};

export async function submitAttendanceAndCalculateFinance(
  classSessionId: string,
  teacherId: string,
  attendanceData: AttendanceInput[]
) {
  try {
    if (!attendanceData?.length) {
      return { success: false, error: "attendanceData rỗng" };
    }

    const sessionInfo = await prisma.classSession.findUnique({
      where: { id: classSessionId },
      include: { class: true },
    });

    if (!sessionInfo) {
      return { success: false, error: "Không tìm thấy classSession" };
    }

    // Báo lỗi nếu session đã được chốt
    if (sessionInfo.isAttendanceSubmitted || sessionInfo.status === "COMPLETED") {
      return { success: false, error: "Ca học đã được chốt điểm danh" };
    }

    const classId = sessionInfo.classId;
    const roomFee = 0; // Lớp trung tâm không tính phí phòng
    const now = new Date();
    
    const studentIds = attendanceData.map((r) => r.studentId);

    if (!classId) {
      throw new Error("Lớp tự do (Freelance) không có danh sách học sinh để điểm danh.");
    }

    let salaryCalculated = 0;
    let netIncome = 0;

    await prisma.$transaction(async (tx) => {
      // ==========================================
      // BƯỚC 1: TÍNH LƯƠNG GIÁO VIÊN DẠY CA NÀY
      // ==========================================
      const classTeacher = await tx.classTeacher.findFirst({
        where: {
          classId: classId,
          teacherId: teacherId,
        },
      });

      if (classTeacher && classTeacher.salaryPerSession > 0) {
        salaryCalculated = classTeacher.salaryPerSession;
      }

      // Thực nhận = Lương dạy - Tiền phòng (nếu có)
      netIncome = salaryCalculated - roomFee;

      // ==========================================
      // BƯỚC 2: GHI NHẬN ĐIỂM DANH & CHỐT CA
      // ==========================================
      // Xóa các log cũ (nếu có do giáo viên đã bấm lưu lẻ từng bạn trước đó) để tránh trùng lặp
      await tx.attendanceLog.deleteMany({
        where: { classSessionId }
      });

      await tx.attendanceLog.createMany({
        data: attendanceData.map((row) => ({
          classSessionId,
          studentId: row.studentId,
          attendanceStatus: row.attendanceStatus,
          homeworkStatus: row.homeworkStatus,
          note: row.note,
        })),
      });

      await tx.classSession.update({
        where: { id: classSessionId },
        data: {
          isAttendanceSubmitted: true,
          status: "COMPLETED",
          attendanceSubmittedAt: now,
        },
      });

      // ==========================================
      // BƯỚC 3: TÀI CHÍNH & TRỪ PHIẾU
      // ==========================================
      if (roomFee > 0) {
        await tx.roomRentalLog.create({
          data: {
            teacherId,
            classSessionId,
            feeCalculated: roomFee,
            status: "PAID",
          },
        });
      }

      // Cộng/trừ tiền trực tiếp vào ví giáo viên
      await tx.user.update({
        where: { id: teacherId },
        data: {
          salaryBalance: { increment: netIncome },
        },
      });

      if (studentIds.length > 0) {
        // Trừ đi 1 buổi học
        await tx.enrollment.updateMany({
          where: { classId: classId, studentId: { in: studentIds } },
          data: { remainingSessions: { decrement: 1 } },
        });

        // Đổi trạng thái sang NỢ PHÍ nếu số buổi <= 0
        await tx.enrollment.updateMany({
          where: { classId: classId, studentId: { in: studentIds }, remainingSessions: { lte: 0 } },
          data: { feeStatus: "UNPAID" },
        });
      }
    });

    revalidatePath("/ta/settings");
    revalidatePath("/ta");

    return { success: true, salaryCalculated, roomFee, netIncome };
  } catch (error) {
    console.error("submitAttendanceAndCalculateFinance error:", error);
    return { success: false, error: "Lỗi khi chốt ca và tính lương" };
  }
}

// ==========================================
// 6. TEACHER: UPDATE PROFILE
// ==========================================

export async function updateTeacherProfile(
  teacherId: string,
  data: { fullName: string; oldPassword?: string; newPassword?: string }
) {
  try {
    const updateData: { fullName: string; passwordHash?: string } = {
      fullName: data.fullName,
    };

    if (data.newPassword && data.newPassword.trim().length > 0) {
      if (!data.oldPassword || !data.oldPassword.trim()) {
        return { success: false, error: "Bạn cần nhập mật khẩu cũ để đổi mật khẩu." };
      }

      const bcrypt = await import("bcryptjs");

      const currentUser = await prisma.user.findUnique({
        where: { id: teacherId },
        select: { passwordHash: true },
      });

      if (!currentUser) {
        return { success: false, error: "Không tìm thấy tài khoản." };
      }

      const isMatch = await bcrypt.compare(data.oldPassword, currentUser.passwordHash);
      if (!isMatch) {
        return { success: false, error: "Mật khẩu cũ không đúng." };
      }

      const hashed = await bcrypt.hash(data.newPassword, 10);
      updateData.passwordHash = hashed;
    }

    if (updateData.passwordHash) {
      await prisma.user.update({
        where: { id: teacherId },
        data: {
          fullName: updateData.fullName,
          passwordHash: updateData.passwordHash,
        },
      });
    } else {
      await prisma.user.update({
        where: { id: teacherId },
        data: {
          fullName: updateData.fullName,
        },
      });
    }

    revalidatePath("/ta/settings");
    return { success: true };
  } catch (error) {
    console.error("updateTeacherProfile error:", error);
    return { success: false, error: "Lỗi cập nhật hồ sơ giáo viên" };
  }
}

// ==========================================
// 7. GIA HẠN / THU HỌC PHÍ HỌC SINH
// ==========================================
export async function processStudentTuitionPayment(
  studentId: string,
  enrollmentIds: string[], // Frontend đang gửi mảng enrollmentId chứ không phải classId
  paymentMethod: PaymentMethod = "BANK_TRANSFER"
) {
  try {
    await checkSuperAdmin(); 

    await prisma.$transaction(async (tx) => {
      for (const enrollmentId of enrollmentIds) {
        // 1. Tìm thông tin phiếu ghi danh kèm thông tin lớp học
        const enrollment = await tx.enrollment.findUnique({
          where: { id: enrollmentId },
          include: { class: true } // Lấy class để biết giá tiền (pricePerSession) và số buổi (sessionsPerPackage)
        });

        if (!enrollment) continue;

        const classInfo = enrollment.class;

        // 2. Tạo lịch sử giao dịch vào bảng PaymentHistory
        await tx.paymentHistory.create({
          data: {
            studentId: studentId,
            classId: classInfo.id,
            amount: classInfo.pricePerSession, // Giá nguyên 1 gói học
            paymentMethod: paymentMethod,
            status: "SUCCESS",
            // Nếu muốn, ông có thể gán voucherRef = enrollment.currentVoucher + 1 ở đây
          },
        });

        // 3. Cập nhật lại phiếu ghi danh (Cộng số buổi, TĂNG VOUCHER và chuyển sang PAID)
        await tx.enrollment.update({
          where: {
            id: enrollmentId,
          },
          data: {
            // Cộng thêm số buổi của gói học
            remainingSessions: { increment: classInfo.sessionsPerPackage },
            // Tăng biến currentVoucher lên 1 để đánh dấu sang phiếu mới
            currentVoucher: { increment: 1 },
            feeStatus: "PAID",
          },
        });
      }
    });

    revalidatePath("/admin/tuition");
    return { success: true };
  } catch (error) {
    console.error("Lỗi khi thu học phí:", error);
    return { success: false, error: "Đã xảy ra lỗi khi gia hạn học phí" };
  }
}
// ==========================================
// 8. THANH TOÁN LƯƠNG GIÁO VIÊN
// ==========================================
export async function payTeacherSalary(teacherId: string, amount: number) {
  try {
    await checkSuperAdmin(); 
    
    if (amount <= 0) return { success: false, error: "Số tiền thanh toán phải lớn hơn 0" };

    await prisma.$transaction(async (tx) => {
      // 1. Lưu lịch sử thanh toán
      await tx.salaryPayment.create({
        data: {
          teacherId: teacherId,
          amount: amount,
          note: "Admin thanh toán lương",
        }
      });

      // 2. Trừ tiền trong ví của Giáo viên
      await tx.user.update({
        where: { id: teacherId },
        data: {
          salaryBalance: { decrement: amount }
        }
      });
    });

    revalidatePath("/admin/tuition");
    return { success: true };
  } catch (error) {
    console.error("Lỗi khi thanh toán lương:", error);
    return { success: false, error: "Đã xảy ra lỗi hệ thống" };
  }
}

// ==========================================
// 9. ROOM BOOKING FLOW
// ==========================================

export async function requestRoomBooking(data: {
  classId: string | null;
  roomId: string;
  date: string;
  slot: number;
}) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Vui lòng đăng nhập" };
  const role = session.user.role;
  const isTeacherOrAdmin = role === "TEACHER" || role === "SUPER_ADMIN";
  if (!isTeacherOrAdmin) return { success: false, error: "Không đủ quyền đăng ký phòng" };
  const teacherId = session.user.id;

  try {
    const dateObj = new Date(data.date);

    // Kiểm tra trùng lặp thời gian phòng
    const existingRoom = await prisma.classSession.findFirst({
      where: {
        roomId: data.roomId,
        date: dateObj,
        slot: data.slot,
      },
    });

    if (existingRoom) {
      return { success: false, error: "Phòng này đã có người đặt trong thời gian này" };
    }

    // Kiểm tra trùng lặp thời gian giáo viên
    const existingTeacher = await prisma.classSession.findFirst({
      where: {
        teacherId: teacherId,
        date: dateObj,
        slot: data.slot,
      },
    });

    if (existingTeacher) {
      return { success: false, error: "Bạn đã có lịch dạy trong thời gian này" };
    }

    await prisma.classSession.create({
      data: {
        classId: data.classId === "freelance" ? null : data.classId,
        teacherId: teacherId,
        roomId: data.roomId,
        date: dateObj,
        slot: data.slot,
        status: role === "SUPER_ADMIN" ? "SCHEDULED" : "PENDING",
      },
    });

    return { success: true };
  } catch (error) {
    console.error("requestRoomBooking error:", error);
    return { success: false, error: "Lỗi khi đăng ký phòng" };
  }
}

export async function approveSessionRequest(sessionId: string) {
  await checkSuperAdmin();
  try {
    return await prisma.$transaction(async (tx) => {
      const session = await tx.classSession.findUnique({
        where: { id: sessionId },
        include: { room: true }
      });

      if (!session) throw new Error("Không tìm thấy phiên đăng ký");

      // Nếu là lớp tự do (Freelance), trừ tiền phòng NGAY LẬP TỨC khi duyệt
      if (session.classId === null) {
        const roomFee = session.room?.feePerSession ?? 0;
        
        if (roomFee > 0) {
          await tx.user.update({
            where: { id: session.teacherId },
            data: { salaryBalance: { decrement: roomFee } }
          });

          await tx.roomRentalLog.create({
            data: {
              teacherId: session.teacherId,
              classSessionId: session.id,
              feeCalculated: roomFee,
              status: "PAID"
            }
          });
        }
      }

      await tx.classSession.update({
        where: { id: sessionId },
        data: { status: "SCHEDULED" },
      });

      return { success: true, error: undefined };
    });
  } catch (error) {
    console.error("approveSessionRequest error:", error);
    return { success: false, error: "Lỗi duyệt phòng" };
  }
}

export async function requestCancelSession(sessionId: string, reason: string) {
  const userSession = await auth();
  if (!userSession?.user) return { success: false, error: "Chưa đăng nhập" };

  try {
    const classSession = await prisma.classSession.findUnique({
      where: { id: sessionId },
    });

    if (!classSession) return { success: false, error: "Không tìm thấy phiên đăng ký" };
    
    if (classSession.teacherId !== userSession.user.id && userSession.user.role !== "SUPER_ADMIN") {
      return { success: false, error: "Không đủ quyền" };
    }

    if (classSession.status !== "SCHEDULED") {
      return { success: false, error: "Chỉ có thể yêu cầu huỷ ca đã được duyệt (SCHEDULED)" };
    }

    await prisma.classSession.update({
      where: { id: sessionId },
      data: { isCancelRequested: true, cancelReason: reason }
    });

    return { success: true, error: undefined };
  } catch (error) {
    console.error("requestCancelSession error:", error);
    return { success: false, error: "Lỗi khi gửi yêu cầu huỷ ca" };
  }
}

export async function approveCancelSession(sessionId: string) {
  await checkSuperAdmin();
  try {
    return await prisma.$transaction(async (tx) => {
      const session = await tx.classSession.findUnique({
        where: { id: sessionId }
      });

      if (!session) throw new Error("Không tìm thấy ca học");
      if (!session.isCancelRequested) throw new Error("Ca này không có yêu cầu huỷ");

      // Nếu là lớp tự do, hoàn tiền phòng
      if (session.classId === null) {
        const log = await tx.roomRentalLog.findFirst({
          where: { classSessionId: session.id, status: "PAID" }
        });

        if (log) {
          // Hoàn tiền vào ví
          await tx.user.update({
            where: { id: session.teacherId },
            data: { salaryBalance: { increment: log.feeCalculated } }
          });
          
          // Cập nhật trạng thái log thành REFUNDED
          await tx.roomRentalLog.update({
            where: { id: log.id },
            data: { status: "REFUNDED" }
          });
        }
      }

      await tx.classSession.update({
        where: { id: sessionId },
        data: { status: "CANCELLED", isCancelRequested: false, cancelReason: null }
      });

      return { success: true, error: undefined };
    });
  } catch (error) {
    console.error("approveCancelSession error:", error);
    return { success: false, error: "Lỗi khi duyệt huỷ ca" };
  }
}

export async function rejectCancelSession(sessionId: string) {
  await checkSuperAdmin();
  try {
    await prisma.classSession.update({
      where: { id: sessionId },
      data: { isCancelRequested: false, cancelReason: null }
    });
    return { success: true, error: undefined };
  } catch (error) {
    console.error("rejectCancelSession error:", error);
    return { success: false, error: "Lỗi khi từ chối huỷ ca" };
  }
}

export async function rejectSessionRequest(sessionId: string) {
  // Cả Admin và Teacher đều có thể gọi hàm này (Teacher tự hủy pending)
  const session = await auth();
  if (!session?.user) return { success: false, error: "Chưa đăng nhập" };

  try {
    const classSession = await prisma.classSession.findUnique({
      where: { id: sessionId },
    });

    if (!classSession) {
      return { success: false, error: "Không tìm thấy phiên đăng ký" };
    }

    if (session.user.role === "TEACHER") {
      if (classSession.teacherId !== session.user.id || classSession.status !== "PENDING") {
        return { success: false, error: "Không thể hủy phiên này" };
      }
    } else if (session.user.role !== "SUPER_ADMIN") {
      return { success: false, error: "Không đủ quyền" };
    }

    await prisma.classSession.delete({
      where: { id: sessionId },
    });
    return { success: true };
  } catch (error) {
    console.error("rejectSessionRequest error:", error);
    return { success: false, error: "Lỗi từ chối / hủy phòng" };
  }
}

export async function transferStudentClass(studentId: string, oldClassId: string, newClassId: string) {
  await checkSuperAdmin();
  if (oldClassId === newClassId) return { success: false, error: "Lớp mới phải khác lớp cũ" };

  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Lấy thông tin phiếu học cũ
      const oldEnrollment = await tx.enrollment.findFirst({
        where: { studentId, classId: oldClassId, status: "ACTIVE" },
        include: { class: true }
      });
      if (!oldEnrollment) throw new Error("Không tìm thấy thông tin đăng ký lớp cũ");

      // 2. Lấy thông tin lớp mới
      const newClass = await tx.class.findUnique({
        where: { id: newClassId }
      });
      if (!newClass) throw new Error("Không tìm thấy lớp mới");

      // 3. Tính số buổi đã học = Tổng số buổi mặc định lớp cũ - Số buổi còn lại
      const usedSessions = Math.max(0, oldEnrollment.class.sessionsPerPackage - oldEnrollment.remainingSessions);

      // 4. Tính số buổi còn lại cho lớp mới
      const newRemainingSessions = Math.max(0, newClass.sessionsPerPackage - usedSessions);

      // 5. Cập nhật phiếu cũ thành DROPPED
      await tx.enrollment.update({
        where: { id: oldEnrollment.id },
        data: { status: "DROPPED" }
      });

      // 6. Tạo phiếu đăng ký mới (chuyển bảo lưu số dư/số buổi)
      const newEnrollment = await tx.enrollment.create({
        data: {
          studentId,
          classId: newClassId,
          remainingSessions: newRemainingSessions,
          feeStatus: oldEnrollment.feeStatus,
          status: "ACTIVE"
        }
      });

      return { success: true, data: newEnrollment };
    });
  } catch (error: any) {
    console.error("Lỗi khi chuyển lớp:", error);
    return { success: false, error: error.message || "Lỗi hệ thống khi chuyển lớp" };
  }
}

export async function markReportAsSent(attendanceLogId: string) {
  try {
    await prisma.attendanceLog.update({
      where: { id: attendanceLogId },
      data: { isReportSent: true }
    });
    return { success: true };
  } catch (error) {
    console.error("markReportAsSent error:", error);
    return { success: false, error: "Lỗi cập nhật trạng thái đã gửi báo cáo" };
  }
}

export async function markMultipleReportsAsSent(attendanceLogIds: string[]) {
  try {
    await prisma.attendanceLog.updateMany({
      where: { id: { in: attendanceLogIds } },
      data: { isReportSent: true }
    });
    return { success: true };
  } catch (error) {
    console.error("markMultipleReportsAsSent error:", error);
    return { success: false, error: "Lỗi cập nhật trạng thái đã gửi báo cáo" };
  }
}
