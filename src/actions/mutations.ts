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
// 1. ACTIONS CHO MÔN HỌC (SUBJECTS)
// ==========================================
export async function createSubject(data: { name: string; pricePerSession: number; sessionsPerPackage: number }) {
  await checkSuperAdmin();
  
  try {
    await prisma.subject.create({ data });
    revalidatePath("/admin/subjects");
    revalidatePath("/admin/classes"); // Cập nhật lại UI trang admin
    return { success: true };
  } catch (error) {
    return { success: false, error: "Lỗi tạo môn học" };
  }
}

export async function updateSubject(id: string, data: { name?: string; pricePerSession?: number; sessionsPerPackage?: number }) {
  await checkSuperAdmin();
  try {
    await prisma.subject.update({ where: { id }, data });
    revalidatePath("/admin/subjects");
    revalidatePath("/admin/classes");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Lỗi cập nhật môn học" };
  }
}
export async function getSubjectDeletionImpact(subjectId: string) {
  await checkSuperAdmin();
  try {
    const classCount = await prisma.class.count({ where: { subjectId } });
    const classes = await prisma.class.findMany({ where: { subjectId }, select: { id: true } });
    const classIds = classes.map((c) => c.id);

    const enrollmentCount = await prisma.enrollment.count({ where: { classId: { in: classIds } } });
    const sessionCount = await prisma.classSession.count({ where: { classId: { in: classIds } } });

    return { success: true, impact: { classCount, enrollmentCount, sessionCount } };
  } catch (error) {
    console.error("Lỗi khi kiểm tra dữ liệu ảnh hưởng của môn học:", error);
    return { success: false, error: "Lỗi hệ thống khi kiểm tra dữ liệu môn học." };
  }
}

export async function deleteSubject(id: string) {
  try {
    // Nhờ tính năng onDelete: Cascade trong Schema, 
    // lệnh này sẽ tự động xóa sạch Class, ClassSession, Enrollment... của môn này.
    // Dữ liệu User (Giáo viên) không bị ảnh hưởng vì nó không phải là bảng con của Subject.
    await prisma.subject.delete({
      where: { id },
    });

    revalidatePath("/admin/classes"); // Sửa lại đúng đường dẫn trang của ông nếu cần
    return { success: true };
  } catch (error) {
    console.error("Lỗi khi xóa môn học:", error);
    return { 
      success: false, 
      error: "Đã xảy ra lỗi hệ thống khi xóa môn học và các dữ liệu liên quan." 
    };
  }
}
// ==========================================
// 2. ACTIONS CHO HỌC SINH (STUDENTS)
// ==========================================
export async function createStudent(data: { 
  fullName: string; 
  phoneStudent?: string; 
  parentName?: string; 
  phoneParent?: string; 
  gender?: string;
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
    const { classIds, ...updateData } = data;
    
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
// 3. ACTIONS CHO ĐÁNH GIÁ/ĐIỂM DANH (ATTENDANCE & EVALUATION)
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
    // Kiểm tra xem đã có bản ghi điểm danh/đánh giá cho học sinh này trong buổi học này chưa
    const existingLog = await prisma.attendanceLog.findFirst({
      where: {
        classSessionId: data.classSessionId,
        studentId: data.studentId,
      },
    });

    if (existingLog) {
      // Sửa đánh giá (Update)
      await prisma.attendanceLog.update({
        where: { id: existingLog.id },
        data: {
          attendanceStatus: data.attendanceStatus,
          homeworkStatus: data.homeworkStatus,
          note: data.note,
        },
      });
    } else {
      // Tạo đánh giá (Create)
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
// 4. ACTIONS CHO LỚP HỌC (CLASSES)
// ==========================================
export async function createClass(data: { name: string; category: string; subjectId: string }) {
  await checkSuperAdmin();
  try {
    await prisma.class.create({ data });
    revalidatePath("/admin/classes");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Lỗi tạo lớp học" };
  }
}

export async function updateClass(id: string, data: { name?: string; category?: string; subjectId?: string }) {
  await checkSuperAdmin();
  try {
    await prisma.class.update({ where: { id }, data });
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