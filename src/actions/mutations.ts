"use server"

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

// Hàm hỗ trợ kiểm tra quyền (Gọi đầu tiên trong mọi action)
async function checkSuperAdmin() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    throw new Error("Không đủ thẩm quyền!");
  }
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
  classIds?: string[];
}) {
  await checkSuperAdmin();
  try {
    await prisma.student.create({
      data: {
        fullName: data.fullName,
        phoneStudent: data.phoneStudent,
        parentName: data.parentName,
        phoneParent: data.phoneParent,
        gender: data.gender === "MALE" || data.gender === "FEMALE" || data.gender === "OTHER" ? data.gender : null,
        dob: parseDobToUtcDate(data.dob),
        school: data.school ?? null,
        enrollments: data.classIds?.length ? {
          create: data.classIds.map(classId => ({
            classId,
          }))
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
    const { classIds, dob, school, ...rest } = data;

    const updateData: any = {
      ...rest,
      dob: parseDobToUtcDate(dob),
      school: school ?? null,
    };

    await prisma.student.update({ where: { id }, data: updateData });

    // Handle class enrollments if classIds are provided
    if (classIds && Array.isArray(classIds)) {
      const existingEnrollments = await prisma.enrollment.findMany({
        where: { studentId: id }
      });
      const existingClassIds = existingEnrollments.map(e => e.classId);
      
      const newClassIds = classIds.filter(cid => !existingClassIds.includes(cid));
      
      if (newClassIds.length > 0) {
        await prisma.enrollment.createMany({
          data: newClassIds.map(classId => ({
            studentId: id,
            classId
          }))
        });
      }
    }

    revalidatePath("/admin/students");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Lỗi cập nhật học sinh" };
  }
}

export async function importStudentsCsv(data: { 
  fullName: string; 
  phoneStudent?: string; 
  parentName?: string; 
  phoneParent?: string; 
  gender?: string 
}[]) {
  await checkSuperAdmin();
  try {
    const formattedData = data.filter(d => d.fullName?.trim()).map(row => ({
      fullName: row.fullName.trim(),
      phoneStudent: row.phoneStudent,
      parentName: row.parentName,
      phoneParent: row.phoneParent,
      gender: (row.gender === "MALE" || row.gender === "FEMALE" || row.gender === "OTHER" ? row.gender : null) as any
    }));

    if (formattedData.length === 0) return { success: false, error: "Dữ liệu không hợp lệ" };

    await prisma.student.createMany({
      data: formattedData,
      skipDuplicates: true
    });
    revalidatePath("/admin/students");
    return { success: true, count: formattedData.length };
  } catch(error) {
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
  roomFeePerSession: number; 
  pricePerSession: number;
  sessionsPerPackage: number;
  teacherId?: string 
}) {
  await checkSuperAdmin();
  try {
    await prisma.class.create({
      data: {
        name: data.name,
        category: data.category,
        roomFeePerSession: data.roomFeePerSession,
        pricePerSession: data.pricePerSession,
        sessionsPerPackage: data.sessionsPerPackage,
        teachers: data.teacherId
          ? {
              create: {
                teacherId: data.teacherId,
              },
            }
          : undefined,
      },
    });

    revalidatePath("/admin/classes");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Lỗi tạo lớp học" };
  }
}

export async function updateClass(
  id: string,
  data: { 
    name?: string; 
    category?: string; 
    roomFeePerSession?: number; 
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
          roomFeePerSession: data.roomFeePerSession,
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
    const roomFee = sessionInfo.class.roomFeePerSession;
    const now = new Date();
    
    const studentIds = attendanceData.map((r) => r.studentId);

    let salaryCalculated = 0;
    let netIncome = 0;

    await prisma.$transaction(async (tx) => {
      // ==========================================
      // BƯỚC 1: TÍNH LƯƠNG (CHỈ TRẢ TIỀN KHI HẾT PHIẾU)
      // ==========================================
      if (studentIds.length > 0) {
        const enrollments = await tx.enrollment.findMany({
          where: {
            classId: classId,
            studentId: { in: studentIds },
          },
          include: { class: true },
        });

        enrollments.forEach((enrollment) => {
          // LOGIC MỚI: Chỉ thanh toán khi đây là buổi học CUỐI CÙNG của phiếu
          // (Tức là trước khi trừ, số buổi còn lại đúng bằng 1)
          if (enrollment.remainingSessions === 1) {
            // Lương cộng thêm = Giá 1 buổi * Tổng số buổi trong gói (Ra tiền nguyên tháng)
            salaryCalculated += (enrollment.class.pricePerSession * enrollment.class.sessionsPerPackage);
          }
        });
      }

      // Thực nhận = Lương tháng (của những bé hết hạn hôm nay) - Tiền phòng hôm nay
      netIncome = salaryCalculated - roomFee;

      // ==========================================
      // BƯỚC 2: GHI NHẬN ĐIỂM DANH & CHỐT CA
      // ==========================================
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

    // If user wants to change password, oldPassword must be provided and verified.
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
  classIds: string[] // Mảng các lớp mà học sinh đóng tiền
) {
  try {
    await checkSuperAdmin(); // Chỉ admin/kế toán mới được thu tiền

    await prisma.$transaction(async (tx) => {
      for (const classId of classIds) {
        // 1. Lấy thông tin lớp học để biết giá tiền và số buổi của 1 khóa
        const classInfo = await tx.class.findUnique({
          where: { id: classId },
        });

        if (!classInfo) continue;

        const amount = classInfo.pricePerSession * classInfo.sessionsPerPackage;

        // 2. Tạo lịch sử giao dịch (PaymentHistory)
        await tx.paymentHistory.create({
          data: {
            studentId: studentId,
            classId: classId,
            amount: amount,
            paymentMethod: "BANK_TRANSFER", // Hoặc CASH tùy ông
            status: "SUCCESS",
          },
        });

        // 3. Gia hạn buổi học (Cộng thêm buổi và đổi thành PAID)
        await tx.enrollment.updateMany({
          where: {
            studentId: studentId,
            classId: classId,
          },
          data: {
            // Cộng thêm số buổi của gói (VD: gói 12 buổi thì cộng thêm 12)
            remainingSessions: { increment: classInfo.sessionsPerPackage },
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
// Thêm vào src/actions/mutations.ts
export async function payTeacherSalary(teacherId: string, amount: number) {
  try {
    await checkSuperAdmin(); // Bắt buộc phải là Admin
    
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
          salaryBalance: { decrement: amount } // Trừ đúng số tiền đã thanh toán
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