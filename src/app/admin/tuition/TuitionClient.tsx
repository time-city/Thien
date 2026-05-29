"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { QRCodeSVG } from "qrcode.react";
import type { RentalLogData, TuitionStudentData } from "@/lib/queries";

type SelectedRenter = {
  name: string;
  sessions: RentalLogData[];
  total: number;
};

type TuitionClientProps = {
  initialStudents: TuitionStudentData[];
  initialRentalLogs: RentalLogData[];
  
};

export default function TuitionClient({
  initialStudents,
  initialRentalLogs,
}: TuitionClientProps) {
  const { role } = useAuth();

  const [activeTab, setActiveTab] = useState<"STUDENT" | "RENTAL">("STUDENT");
  const [students] = useState<TuitionStudentData[]>(initialStudents);
  const [rentalLogs] = useState<RentalLogData[]>(initialRentalLogs);

  const [selectedStudent, setSelectedStudent] = useState<TuitionStudentData | null>(null);
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());
  const [selectedRenter, setSelectedRenter] = useState<SelectedRenter | null>(null);

  // Lọc học sinh có môn học sắp hết hạn (<= 2 buổi)
  const studentsWithLowSessions = useMemo(() => {
    return students.filter((s) => s.enrolledCourses.some((c) => c.remainingSessions <= 2));
  }, [students]);

  // Lọc các ca thuê phòng chưa thanh toán
  const pendingRentals = useMemo(() => {
    return rentalLogs.filter((l) => l.status === "PENDING");
  }, [rentalLogs]);

  // Gom nhóm các ca thuê phòng theo tên Giáo viên
  const rentalsByRenter = useMemo(() => {
    const map = new Map<string, RentalLogData[]>();
    for (const log of pendingRentals) {
      const key = log.teacherName;
      const arr = map.get(key) ?? [];
      arr.push(log);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [pendingRentals]);

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

  // Tính tổng số tiền dựa trên các khóa học đã tick chọn
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
    // Chỉ lấy tên của các lớp đã chọn để đưa vào nội dung CK
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
        <p className="text-slate-500 mt-1 text-sm font-medium">Thu học phí học sinh và Thu tiền thuê phòng.</p>
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
          Học Phí Học Sinh
        </button>
        <button
          onClick={() => setActiveTab("RENTAL")}
          className={`px-6 py-3 border-b-2 transition-colors ${
            activeTab === "RENTAL"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Thu Tiền Phòng
        </button>
      </div>

      {/* TAB HỌC PHÍ */}
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
                <tr key={student.id} className="hover:bg-slate-50/50">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">{student.fullName}</div>
                    <div className="text-xs text-slate-500">{student.id}</div>
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
                      Thu tiền
                    </button>
                  </td>
                </tr>
              ))}
              {studentsWithLowSessions.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    Không có học sinh nào cần thu học phí lúc này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB TIỀN PHÒNG */}
      {activeTab === "RENTAL" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rentalsByRenter.map(([name, sessions]) => {
            const totalAmount = sessions.reduce((sum, s) => sum + s.feeCalculated, 0);
            return (
              <div key={name} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-extrabold text-lg text-slate-900">{name}</h3>
                    <p className="text-slate-500 text-sm font-medium">Nợ {sessions.length} ca thuê phòng</p>
                  </div>
                  <div className="bg-rose-50 text-rose-700 font-bold px-2 py-1 rounded text-xs border border-rose-100">
                    PENDING
                  </div>
                </div>

                <div className="space-y-2 mb-4 max-h-[120px] overflow-y-auto pr-2">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className="text-xs flex justify-between p-2 bg-slate-50 rounded border border-slate-100"
                    >
                      <span className="text-slate-600 font-medium">
                        Ca {s.slot} <br /> 
                        <span className="text-slate-400">
                          {new Date(s.date).toLocaleDateString("vi-VN")}
                        </span>
                      </span>
                      <span className="font-bold text-slate-700">{formatCurrency(s.feeCalculated)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-100 pt-4 flex justify-between items-center">
                  <span className="font-bold text-slate-900">{formatCurrency(totalAmount)}</span>
                  <button
                    onClick={() => setSelectedRenter({ name, sessions, total: totalAmount })}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-3 rounded shadow-sm transition-colors text-xs"
                  >
                    Tạo QR Thu
                  </button>
                </div>
              </div>
            );
          })}

          {rentalsByRenter.length === 0 && (
            <div className="col-span-full py-8 text-center text-slate-500 bg-white border border-slate-200 rounded-xl">
              Không có đối tác nào đang nợ tiền thuê phòng.
            </div>
          )}
        </div>
      )}

      {/* MODAL THU HỌC PHÍ */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 md:p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900">Gộp Học Phí</h3>
              <p className="text-sm text-slate-500 mt-1">
                Học sinh: <span className="font-bold text-slate-700">{selectedStudent.fullName} ({selectedStudent.id})</span>
              </p>
            </div>

            <div className="p-4 md:p-6 overflow-y-auto">
              <p className="text-sm font-bold text-slate-700 mb-3">Chọn môn để gia hạn:</p>

              <div className="space-y-2">
                {selectedStudent.enrolledCourses.map((c) => {
                  const isLow = c.remainingSessions <= 2;
                  const isSelected = selectedCourses.has(c.enrollmentId);

                  return (
                    <label
                      key={c.enrollmentId}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded flex items-center justify-center border ${
                            isSelected
                              ? "bg-blue-600 border-blue-600"
                              : "border-slate-300"
                          }`}
                        >
                          {isSelected && (
                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{c.className}</p>
                          <p className={`text-xs ${isLow ? "text-rose-600 font-semibold" : "text-slate-500"}`}>
                            Còn {c.remainingSessions} buổi
                          </p>
                        </div>
                      </div>
                      <div className="font-semibold text-slate-700">{formatCurrency(c.price)}</div>
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
                <span className="text-slate-500 text-sm font-medium">Tổng tiền gộp:</span>
                <span className="text-2xl font-extrabold text-blue-600">{formatCurrency(totalFee)}</span>
              </div>

              <div className="mt-6 flex flex-col items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Mã QR Chuyển Khoản</p>
                <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-200">
                  <QRCodeSVG value={getQrCodeString()} size={160} level="H" />
                </div>
                <p className="mt-3 text-sm font-mono text-slate-700 bg-white px-3 py-1 rounded border border-slate-200 text-center">
                  {getQrCodeString()}
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
              <button
                onClick={() => {
                  setSelectedStudent(null);
                  setSelectedCourses(new Set());
                }}
                className="px-4 py-2 rounded-lg font-bold text-sm text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Đóng
              </button>
              <button
                className="px-4 py-2 rounded-lg font-bold text-sm bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm disabled:bg-slate-300"
                disabled={selectedCourses.size === 0}
                onClick={() => {
                  // TODO: Gắn hàm gọi API cập nhật trạng thái đã thu tiền vào đây
                  alert(`Đã lưu thanh toán: ${getQrCodeString()}`);
                  setSelectedStudent(null);
                  setSelectedCourses(new Set());
                }}
              >
                Xác nhận đã thu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL THU TIỀN PHÒNG */}
      {selectedRenter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="p-4 md:p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900">Thu Tiền Thuê Phòng</h3>
              <p className="text-sm text-slate-500 mt-1">
                Người thuê: <span className="font-bold text-slate-700">{selectedRenter.name}</span>
              </p>
            </div>

            <div className="p-4 md:p-6 flex flex-col items-center">
              <div className="mb-4 text-center">
                <p className="text-sm font-medium text-slate-500 mb-1">Tổng thanh toán ({selectedRenter.sessions.length} ca)</p>
                <p className="text-3xl font-extrabold text-blue-600">{formatCurrency(selectedRenter.total)}</p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 w-full flex flex-col items-center">
                <p className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Mã QR Chuyển Khoản</p>
                <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-200">
                  <QRCodeSVG
                    value={`THUE PHONG ${selectedRenter.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()}`}
                    size={160}
                    level="H"
                  />
                </div>
                <p className="mt-3 text-sm font-mono text-slate-700 bg-white px-3 py-1 rounded border border-slate-200 text-center">
                  THUE PHONG {selectedRenter.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()}
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
              <button
                onClick={() => setSelectedRenter(null)}
                className="px-4 py-2 rounded-lg font-bold text-sm text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Hủy
              </button>
              <button
                className="px-4 py-2 rounded-lg font-bold text-sm bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2"
                onClick={() => {
                  alert(`Đã thu thành công ${formatCurrency(selectedRenter.total)} từ ${selectedRenter.name}`);
                  setSelectedRenter(null);
                }}
              >
                Xác nhận đã thu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}