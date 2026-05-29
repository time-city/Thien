"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import StudentEvaluationModal from "./StudentEvaluationModal"; 
import type { CheckInStudent, UISessionInfo } from "../../app/types";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { saveStudentEvaluation } from "@/actions/mutations";

export default function TaCheckInClient({
  sessionInfo,
  students,
  currentPage,
  totalPages,
  classId,
  sessionId,
}: {
  sessionInfo: UISessionInfo;
  students: CheckInStudent[];
  currentPage: number;
  totalPages: number;
  classId: string;
  sessionId: string;
}) {
  const { role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [studentsState, setStudentsState] = useState<CheckInStudent[]>(students);
  const [selectedStudent, setSelectedStudent] = useState<CheckInStudent | null>(null);
  const [search, setSearch] = useState<string>("");

  useEffect(() => {
    setStudentsState(students);
  }, [students]);

  const handleSaveAssessment = async (id: string, updates: Partial<CheckInStudent>) => {
    try {
      const res = await saveStudentEvaluation({
        classSessionId: sessionId,
        studentId: id,
        attendanceStatus: updates.attendance as any,
        homeworkStatus: updates.homework as any,
        note: updates.note,
      });

      if (res.success) {
        setStudentsState((prev) => prev.map((st) => (st.id === id ? { ...st, ...updates } : st)));
        setSelectedStudent(null);
      } else {
        alert(res.error || "Lỗi khi lưu đánh giá");
      }
    } catch (err) {
      console.error(err);
      alert("Đã xảy ra lỗi hệ thống.");
    }
  };

  const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const visibleSortedStudents = useMemo(() => {
    const q = normalize(search.trim());
    if (!q) return studentsState;
    return studentsState.filter((st) => normalize(st.fullName).includes(q));
  }, [studentsState, search]);

  const getAttendanceColor = (att?: string) => {
    switch (att) {
      case "PRESENT": return "bg-emerald-500";
      case "LATE": return "bg-amber-500";
      case "EXCUSED": return "bg-orange-500";
      case "UNEXCUSED": return "bg-rose-500";
      default: return "bg-slate-200";
    }
  };

  const getHomeworkColor = (hw?: string) => {
    switch (hw) {
      case "GOOD": return "bg-emerald-500";
      case "DONE": return "bg-amber-500";
      case "NOT_DONE": return "bg-rose-500";
      default: return "bg-slate-200";
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    router.push(`${pathname}?classId=${classId}&sessionId=${sessionId}&page=${newPage}`);
  };

  return (
    <div className="w-full max-w-5xl mx-auto pb-8 font-sans">
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl py-3 px-4 mb-6">
        <div className="mb-2">
          <Link
            href="/schedule"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft size={14} />
            Quay lại Lịch Dạy
          </Link>
        </div>
        <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Sơ Đồ Lớp Học & Điểm Danh
            </h1>
            <p className="text-[13px] text-slate-500 font-medium mt-1 leading-tight">
              Lớp: <span className="font-bold text-slate-700">{sessionInfo.className}</span> | 
              GV: <span className="font-bold text-slate-700">{sessionInfo.teacherName}</span> | 
              Ca {sessionInfo.slot} - {new Date(sessionInfo.date).toLocaleDateString('vi-VN')}
            </p>
          </div>

          <div className="w-full lg:w-auto">
            <input
              type="text"
              placeholder="Tìm theo tên học sinh..."
              className="w-full lg:w-64 bg-slate-50 border border-slate-200 rounded-lg h-8 px-3 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>
      

      <div className="flex flex-col gap-4">
           {totalPages > 1 && (
          <div className="flex items-center justify-between bg-white px-4 py-2 border border-slate-200 rounded-xl shadow-sm">
             <span className="text-[13px] text-slate-700 font-medium">
                Trang <span className="font-bold text-slate-900">{currentPage}</span> / {totalPages}
             </span>
             <div className="flex gap-1.5">
              {
                currentPage > 1 && (
                  <button 
                    onClick={() => handlePageChange(1)}
                    className="px-2.5 py-1 border border-slate-200 rounded text-[13px] font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Trang đầu
                  </button>
                )
              }
                <button 
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 border border-slate-200 rounded text-[13px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Trước
                </button>
                <button 
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 border border-slate-200 rounded text-[13px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sau
                </button>
                 {
                currentPage < totalPages  && (
                  <button 
                    onClick={() => handlePageChange(totalPages)}
                    className="px-2.5 py-1 border border-slate-200 rounded text-[13px] font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Trang cuối
                  </button>
                )
              }
             </div>
          </div>
        )}
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-widest font-extrabold text-slate-500">
                <th className="py-2 px-3 w-12 text-center">STT</th>
                <th className="py-2 px-3">Học sinh</th>
                <th className="py-2 px-3 w-28">Điểm danh</th>
                <th className="py-2 px-3 w-28">Bài tập</th>
                <th className="py-2 px-3 w-24 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {visibleSortedStudents.map((student) => {
                const isAssessed = student.attendance || student.homework;
                const nameParts = student.fullName.split(" ");
                const initial = nameParts[nameParts.length - 1].charAt(0).toUpperCase();

                return (
                  <tr
                    key={student.id}
                    className={`border-b last:border-b-0 border-slate-100 transition-colors ${
                      isAssessed ? "bg-slate-50/50" : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="py-2 px-3 text-center font-bold text-slate-400 text-[13px]">
                      {student.seat}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs border ${
                            isAssessed
                              ? "bg-slate-800 text-white border-slate-700"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          }`}
                        >
                          {initial}
                        </div>
                        <div className="flex flex-col justify-center">
                           <div className="font-bold text-slate-800 text-[13px] leading-none mb-1">{student.fullName}</div>
                           <div className="text-[11px] text-slate-500 font-medium leading-none">Còn {student.remainingSessions} buổi</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      {student.attendance ? (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                          <div className={`w-2.5 h-2.5 rounded-full ${getAttendanceColor(student.attendance)}`}></div>
                          {student.attendance === "PRESENT" && "Có mặt"}
                          {student.attendance === "LATE" && "Trễ"}
                          {student.attendance === "EXCUSED" && "Phép"}
                          {student.attendance === "UNEXCUSED" && "Vắng"}
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-slate-300">-</span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {student.homework ? (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                          <div className={`w-2.5 h-2.5 rounded-full ${getHomeworkColor(student.homework)}`}></div>
                          {student.homework === "GOOD" && "Tốt"}
                          {student.homework === "DONE" && "Đủ"}
                          {student.homework === "NOT_DONE" && "Không làm"}
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-slate-300">-</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => setSelectedStudent(student)}
                        className={`px-3 py-1 border rounded-[6px] text-[11px] font-bold shadow-sm transition-all outline-none ${
                          isAssessed
                            ? "bg-transparent border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50"
                            : "bg-transparent border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300"
                        }`}
                      >
                        {isAssessed ? "Sửa" : "Đánh giá"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              
              {visibleSortedStudents.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500 text-sm">
                    Không tìm thấy học sinh nào trong lớp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
     

      </div>

      {selectedStudent && (
        <AssessmentModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          onSave={handleSaveAssessment}
        />
      )}
    </div>
  );
}

function AssessmentModal({
  student,
  onClose,
  onSave,
}: {
  student: CheckInStudent;
  onClose: () => void;
  onSave: (id: string, updates: Partial<CheckInStudent>) => void;
}) {
  return (
    <StudentEvaluationModal
      student={{
        id: student.id,
        fullName: student.fullName,
        className: student.className,
        seat: student.seat,
        phone: student.phone,
        parentName: student.parentName,
        parentPhone: student.parentPhone,
        remainingSessions: student.remainingSessions,
        feeStatus: student.feeStatus,
        attendance: student.attendance,
        homework: student.homework,
        note: student.note ?? "",
      }}
      onClose={onClose}
      onSave={(id, updates) =>
        onSave(id, {
          attendance: updates.attendance,
          homework: updates.homework,
          note: updates.note,
        })
      }
    />
  );
}
