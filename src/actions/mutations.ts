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
    revalidatePath("/admin/subjects"); // Cập nhật lại UI trang admin
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
    return { success: true };
  } catch (error) {
    return { success: false, error: "Lỗi cập nhật môn học" };
  }
}

export async function deleteSubject(id: string) {
  await checkSuperAdmin();
  try {
    await prisma.subject.delete({ where: { id } });
    revalidatePath("/admin/subjects");
    return { success: true };
  } catch (error) {
    // Nếu môn này đã có lớp học, DB sẽ khóa không cho xóa cứng.
    return { success: false, error: "Không thể xóa môn học đã có lớp đang hoạt động" };
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
  gender?: string 
}) {
  await checkSuperAdmin();
  try {
    await prisma.student.create({
      data: {
        fullName: data.fullName,
        phoneStudent: data.phoneStudent,
        parentName: data.parentName,
        phoneParent: data.phoneParent,
        // Ép kiểu gender cho đúng enum
        gender: data.gender === "MALE" || data.gender === "FEMALE" || data.gender === "OTHER" ? data.gender : null
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
    await prisma.student.update({ where: { id }, data });
    revalidatePath("/admin/students");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Lỗi cập nhật học sinh" };
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


