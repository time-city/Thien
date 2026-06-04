"use server"

import { prisma } from "@/lib/prisma";

export type StudentCourseReport = {
  studentName: string;
  phoneStudent: string | null;
  className: string;
  sessionsPerPackage: number;
  pricePerSession: number;
  logs: {
    date: Date;
    slot: number;
    attendanceStatus: string;
    homeworkStatus: string | null;
    note: string | null;
    teacherName: string;
  }[];
};

export async function getStudentCourseReport(studentId: string, classId: string): Promise<StudentCourseReport | null> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { fullName: true, phoneStudent: true }
  });
  if (!student) return null;

  const classData = await prisma.class.findUnique({
    where: { id: classId },
    select: { name: true, sessionsPerPackage: true, pricePerSession: true }
  });
  if (!classData) return null;

  const logs = await prisma.attendanceLog.findMany({
    where: {
      studentId: studentId,
      classSession: {
        classId: classId
      }
    },
    include: {
      classSession: {
        include: { teacher: true }
      }
    },
    orderBy: {
      classSession: {
        date: "asc"
      }
    }
  });

  return {
    studentName: student.fullName,
    phoneStudent: student.phoneStudent,
    className: classData.name,
    sessionsPerPackage: classData.sessionsPerPackage,
    pricePerSession: classData.pricePerSession,
    logs: logs.map(log => ({
      date: log.classSession.date,
      slot: log.classSession.slot,
      attendanceStatus: log.attendanceStatus,
      homeworkStatus: log.homeworkStatus,
      note: log.note,
      teacherName: log.classSession.teacher.fullName
    }))
  };
}
