"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { QRCodeSVG } from "qrcode.react";
import type { TuitionStudentData, TeacherData } from "@/lib/queries"; // Cần bổ sung TeacherData vào queries.ts nếu chưa có

type TuitionClientProps = {
  initialStudents: TuitionStudentData[];
  initialTeachers: TeacherData[]; // Nhận danh sách giáo viên có salaryBalance
};

export default function TuitionClient({
  initialStudents,
  initialTeachers,
}: TuitionClientProps) {
  const { role } = useAuth();

  const [activeTab, setActiveTab] = useState<"STUDENT" | "TEACHER_SALARY">("STUDENT");
  const [students] = useState<TuitionStudentData[]>(initialStudents);
  const [teachers] = useState<TeacherData[]>(initialTeachers);

  const [selectedStudent, setSelectedStudent] = useState<TuitionStudentData | null>(null);
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());
  
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherData | null>(null);

  // Lọc học sinh có môn học sắp hết hạn (<= 2 buổi)
  const studentsWithLowSessions = useMemo(() => {
    return students.filter((s) => s.enrolledCourses.some((c) => c.remainingSessions <= 2));
  }, [students]);

  // Lọc giáo viên CÓ SỐ DƯ > 0 để hiển thị danh sách cần trả lương
  const teachersWithBalance = useMemo(() => {
    return teachers.filter((t) => (t.salaryBalance ?? 0) > 0);
  }, [teachers]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  const handleOpenStudentModal = (student: TuitionStudentData) => {
    setSelectedStudent(student);
    setSelectedCourses(new Set());
  };

  const handleToggleCourse = (courseId: string) => {
    setSelectedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  };

  // Tính tổng số tiền học phí dựa trên các khóa học đã tick chọn
  const totalFee = useMemo(() => {
    if (!selectedStudent) return 0;
    return selectedStudent.enrolledCourses.reduce((sum, course) => {
      if (selectedCourses.has(course.enrollmentId)) {
        return sum + course.price;
      }
      return sum;
    }, 0);
  }, [selectedStudent, selectedCourses]);

  const getQrCodeString = () => {
    if (!selectedStudent) return "";
    const selectedCourseNames = selectedStudent.enrolledCourses
      .filter(c => selectedCourses.has(c.enrollmentId))
      .map(c => c.className);

    const normalizedCourses = selectedCourseNames
      .map((k) => k.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase())
      .join(" ");
    
    return `HP ${normalizedCourses} ${selectedStudent.id}`;
  };

  if (role !== "SUPER_ADMIN") {
    return <div className="p-8 text-center text-slate-500">Bạn không có quyền truy cập trang này.</div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-slate-900">Quản Lý Tài Chính</h1>
        <p className="text-slate-500 mt-1 text-sm font-medium">Thu học phí học sinh và Thanh toán lương giáo viên.</p>
      </div>

      <div className="flex border-b border-slate-200 mb-6 font-bold text-sm">
        <button
          onClick={() => setActiveTab("STUDENT")}
          className={`px-6 py-3 border-b-2 transition-colors ${
            activeTab === "STUDENT"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Thu Học Phí Học Sinh
        </button>
        <button
          onClick={() => setActiveTab("TEACHER_SALARY")}
          className={`px-6 py-3 border-b-2 transition-colors ${
            activeTab === "TEACHER_SALARY"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Thanh Toán Lương
        </button>
      </div>

      {/* TAB 1: THU HỌC PHÍ */}
      {activeTab === "STUDENT" && (
        <div className="bg-white border text-center border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-900">
              <tr>
                <th className="py-3 px-4 font-bold">Học sinh</th>
                <th className="py-3 px-4 font-bold">Lớp</th>
                <th className="py-3 px-4 font-bold">Môn cảnh báo</th>
                <th className="py-3 px-4 font-bold text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {studentsWithLowSessions.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">{student.fullName}</div>
                    <div className="text-xs text-slate-500">ID: {student.id.substring(0, 8)}...</div>
                  </td>
                  <td className="py-3 px-4">{student.enrolledCourses[0]?.className ?? "-"}</td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {student.enrolledCourses
                        .filter((c) => c.remainingSessions <= 2)
                        .map((c) => (
                          <span
                            key={c.enrollmentId}
                            className="bg-rose-50 text-rose-700 font-bold px-2 py-0.5 rounded text-xs border border-rose-100"
                          >
                            {c.className} ({c.remainingSessions} buổi)
                          </span>
                        ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleOpenStudentModal(student)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-3 rounded shadow-sm transition-colors text-xs"
                    >
                      Tạo QR Thu
                    </button>
                  </td>
                </tr>
              ))}
              {studentsWithLowSessions.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500 font-medium">
                    Không có học sinh nào cần thu học phí lúc này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: THANH TOÁN LƯƠNG GIÁO VIÊN */}
      {activeTab === "TEACHER_SALARY" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teachersWithBalance.map((teacher) => (
            <div key={teacher.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-extrabold text-lg text-slate-900">{teacher.fullName}</h3>
                    <p className="text-slate-500 text-xs font-medium">@{teacher.username}</p>
                  </div>
                  <div className="bg-emerald-50 text-emerald-700 font-bold px-2 py-1 rounded text-[10px] uppercase tracking-wider border border-emerald-100">
                    Cần Trả Lương
                  </div>
                </div>

                <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100 mb-5">
                  <div className="text-xs text-slate-500 mb-1 font-medium">Tổng thực nhận (Đã trừ phí phòng)</div>
                  <div className="text-2xl font-extrabold text-emerald-600 tracking-tight">
                    {formatCurrency(teacher.salaryBalance ?? 0)}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 flex justify-end">
                <button
                  onClick={() => setSelectedTeacher(teacher)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold w-full py-2.5 rounded-lg shadow-sm transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Tiến Hành Thanh Toán
                </button>
              </div>
            </div>
          ))}

          {teachersWithBalance.length === 0 && (
            <div className="col-span-full py-12 text-center bg-white border border-slate-200 rounded-xl shadow-sm">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-slate-600 font-medium">Không có giáo viên nào cần thanh toán lương hiện tại.</p>
              <p className="text-slate-400 text-xs mt-1">Tất cả số dư ví giáo viên đều đang = 0đ.</p>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* ================ MODAL THU HỌC PHÍ ===================== */}
      {/* ======================================================== */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50">
              <h3 className="text-lg font-extrabold text-slate-900">Gộp Học Phí & Gia Hạn</h3>
              <p className="text-sm text-slate-500 mt-0.5 font-medium">
                Học sinh: <span className="font-bold text-slate-700">{selectedStudent.fullName}</span>
              </p>
            </div>

            <div className="p-4 md:p-6 overflow-y-auto">
              <p className="text-sm font-bold text-slate-700 mb-3">1. Chọn môn học để gia hạn:</p>

              <div className="space-y-2">
                {selectedStudent.enrolledCourses.map((c) => {
                  const isLow = c.remainingSessions <= 2;
                  const isSelected = selectedCourses.has(c.enrollmentId);

                  return (
                    <label
                      key={c.enrollmentId}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? "border-blue-500 bg-blue-50/50"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                            isSelected ? "bg-blue-600 border-blue-600" : "border-slate-300"
                          }`}
                        >
                          {isSelected && (
                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{c.className}</p>
                          <p className={`text-[11px] font-medium mt-0.5 ${isLow ? "text-rose-600" : "text-slate-500"}`}>
                            Đang còn: {c.remainingSessions} buổi
                          </p>
                        </div>
                      </div>
                      <div className="font-bold text-slate-700 text-sm">{formatCurrency(c.price)}</div>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleCourse(c.enrollmentId)}
                        className="sr-only"
                      />
                    </label>
                  );
                })}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center">
                <span className="text-slate-500 text-sm font-bold">2. Tổng tiền cần thu:</span>
                <span className="text-2xl font-extrabold text-blue-600 tracking-tight">{formatCurrency(totalFee)}</span>
              </div>

              {selectedCourses.size > 0 && (
                <div className="mt-6 flex flex-col items-center p-5 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[11px] font-bold text-slate-500 mb-3 uppercase tracking-widest">Đưa QR cho học sinh quét</p>
                  <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
                    <QRCodeSVG value={getQrCodeString()} size={160} level="H" />
                  </div>
                  <p className="mt-4 text-xs font-mono font-semibold text-slate-600 bg-white px-3 py-1.5 rounded-md border border-slate-200 text-center w-full truncate">
                    {getQrCodeString()}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-white">
              <button
                onClick={() => {
                  setSelectedStudent(null);
                  setSelectedCourses(new Set());
                }}
                className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors w-full sm:w-auto"
              >
                Đóng
              </button>
              <button
                className="px-5 py-2.5 rounded-xl font-bold text-sm bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm disabled:bg-slate-300 disabled:cursor-not-allowed w-full sm:w-auto"
                disabled={selectedCourses.size === 0}
                onClick={() => {
                  // TODO: Gắn hàm Server Action chốt hóa đơn thu học phí vào đây
                  alert(`Đã lưu thanh toán: ${getQrCodeString()}`);
                  setSelectedStudent(null);
                  setSelectedCourses(new Set());
                }}
              >
                Xác Nhận Đã Thu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ============= MODAL THANH TOÁN LƯƠNG GIÁO VIÊN =========== */}
      {/* ======================================================== */}
      {selectedTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50">
              <h3 className="text-lg font-extrabold text-slate-900">Chi Trả Lương Giáo Viên</h3>
              <p className="text-sm text-slate-500 mt-0.5 font-medium">
                Người nhận: <span className="font-bold text-slate-700">{selectedTeacher.fullName}</span>
              </p>
            </div>

            <div className="p-6 flex flex-col items-center">
              <div className="mb-6 text-center w-full">
                <p className="text-sm font-semibold text-slate-500 mb-1">Số tiền cần chuyển khoản</p>
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 mt-2">
                  <p className="text-3xl font-extrabold text-emerald-600 tracking-tight">
                    {formatCurrency(selectedTeacher.salaryBalance ?? 0)}
                  </p>
                </div>
              </div>

              <div className="w-full flex flex-col items-center p-5 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[11px] font-bold text-slate-500 mb-3 uppercase tracking-widest text-center">
                  Bạn có thể quét QR để CK nhanh <br/> (Nếu GV có cung cấp STK)
                </p>
                <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
                  <QRCodeSVG
                    value={`THANH TOAN LUONG ${selectedTeacher.fullName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()}`}
                    size={160}
                    level="H"
                  />
                </div>
                <p className="mt-4 text-[10px] font-mono font-semibold text-slate-500 bg-white px-3 py-1.5 rounded-md border border-slate-200 text-center w-full truncate">
                  LUONG {selectedTeacher.username.toUpperCase()}
                </p>
              </div>
              
              <p className="text-xs text-slate-400 mt-4 text-center italic">
                * Bấm xác nhận bên dưới sau khi bạn đã chuyển khoản thành công để đưa số dư ví giáo viên về 0đ.
              </p>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-white">
              <button
                onClick={() => setSelectedTeacher(null)}
                className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors w-full sm:w-auto"
              >
                Hủy
              </button>
              <button
                className="px-5 py-2.5 rounded-xl font-bold text-sm bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm flex items-center justify-center gap-2 w-full sm:w-auto"
                onClick={() => {
                  // TODO: Gắn hàm Server Action trừ ví giáo viên về 0 và lưu vào bảng SalaryPayment
                  alert(`Đã chốt thanh toán lương ${formatCurrency(selectedTeacher.salaryBalance ?? 0)} cho ${selectedTeacher.fullName}`);
                  setSelectedTeacher(null);
                }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Xác Nhận Đã Chuyển
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}