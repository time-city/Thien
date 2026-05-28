"use client";

import { useState } from 'react';
import { mockStudents, Student, CourseInfo, mockRentals } from '@/lib/mock-data';
import { useAuth } from '@/lib/AuthContext';
import { QRCodeSVG } from 'qrcode.react';

export default function TuitionPage() {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<'STUDENT' | 'RENTAL'>('STUDENT');
  
  // -- TÍNH NĂNG TÍNH PHÍ HỌC SINH --
  const studentsWithLowSessions = mockStudents.filter(s => 
    s.enrolledCourses.some(c => c.remaining <= 2)
  );

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());

  // -- TÍNH NĂNG TÍNH PHÍ THUÊ PHÒNG --
  const pendingRentals = mockRentals.filter(r => r.paymentStatus === 'PENDING');
  // Group rentals by renterName
  const rentalsByRenter = pendingRentals.reduce((acc, current) => {
    if (!acc[current.renterName]) {
      acc[current.renterName] = [];
    }
    acc[current.renterName].push(current);
    return acc;
  }, {} as Record<string, typeof mockRentals>);

  const [selectedRenter, setSelectedRenter] = useState<{name: string, sessions: typeof mockRentals, total: number} | null>(null);

  if (role !== 'SUPER_ADMIN') {
    return (
      <div className="p-8 text-center text-slate-500">
        Bạn không có quyền truy cập trang này.
      </div>
    );
  }

  // logic modal học sinh...
  const handleOpenStudentModal = (student: Student) => {
    setSelectedStudent(student);
    const toSelect = student.enrolledCourses
      .filter(c => c.remaining <= 2)
      .map(c => c.course);
    setSelectedCourses(new Set(toSelect));
  };

  const handleToggleCourse = (courseName: string) => {
    const next = new Set(selectedCourses);
    if (next.has(courseName)) {
      next.delete(courseName);
    } else {
      next.add(courseName);
    }
    setSelectedCourses(next);
  };

  const totalFee = selectedStudent?.enrolledCourses
    .filter(c => selectedCourses.has(c.course))
    .reduce((sum, c) => sum + c.fee, 0) || 0;

  // Cú pháp HP HOA LY [Ma HS] - normalize string, ko dấu
  const getQrCodeString = () => {
    if (!selectedStudent) return '';
    const normalizedCourses = Array.from(selectedCourses).map(c => 
      c.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
    ).join(' ');
    
    return `HP ${normalizedCourses} ${selectedStudent.id}`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-slate-900">Quản Lý Tài Chính</h1>
        <p className="text-slate-500 mt-1 text-sm font-medium">Thu học phí học sinh và Thu tiền thuê phòng.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6 font-bold text-sm">
        <button 
          onClick={() => setActiveTab('STUDENT')}
          className={`px-6 py-3 border-b-2 transition-colors ${activeTab === 'STUDENT' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Học Phí Học Sinh
        </button>
        <button 
          onClick={() => setActiveTab('RENTAL')}
          className={`px-6 py-3 border-b-2 transition-colors ${activeTab === 'RENTAL' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Thu Tiền Phòng
        </button>
      </div>

      {activeTab === 'STUDENT' && (
        <div className="bg-white border text-center border-slate-200 rounded-xl overflow-hidden shadow-sm">
          {/* ...table hoc sinh */}
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
            {studentsWithLowSessions.map(student => (
              <tr key={student.id} className="hover:bg-slate-50/50">
                <td className="py-3 px-4">
                  <div className="font-semibold text-slate-900">{student.name}</div>
                  <div className="text-xs text-slate-500">{student.id}</div>
                </td>
                <td className="py-3 px-4">{student.className}</td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-1">
                    {student.enrolledCourses.filter(c => c.remaining <= 2).map((c, idx) => (
                      <span key={idx} className="bg-rose-50 text-rose-700 font-bold px-2 py-0.5 rounded text-xs border border-rose-100">
                        {c.course} ({c.remaining} buổi)
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

      {/* RENTAL TAB CONTENT */}
      {activeTab === 'RENTAL' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.entries(rentalsByRenter).map(([name, sessions]) => {
            const totalAmount = sessions.reduce((sum, s) => sum + s.pricePerSession, 0);
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
                  {sessions.map(s => (
                    <div key={s.id} className="text-xs flex justify-between p-2 bg-slate-50 rounded border border-slate-100">
                      <span className="text-slate-600 font-medium">{s.roomName} <br/> <span className="text-slate-400">({s.timeSlot})</span></span>
                      <span className="font-bold text-slate-700">{formatCurrency(s.pricePerSession)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-100 pt-4 flex justify-between items-center">
                  <span className="font-bold text-slate-900">{formatCurrency(totalAmount)}</span>
                  <button 
                    onClick={() => setSelectedRenter({name, sessions, total: totalAmount})}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-3 rounded shadow-sm transition-colors text-xs"
                  >
                    Tạo QR Thu
                  </button>
                </div>
              </div>
            );
          })}
          {Object.keys(rentalsByRenter).length === 0 && (
            <div className="col-span-full py-8 text-center text-slate-500 bg-white border border-slate-200 rounded-xl">
              Không có đối tác nào đang nợ tiền thuê phòng.
            </div>
          )}
        </div>
      )}

      {/* Modal Học Sinh */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 md:p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900">Gộp Học Phí</h3>
              <p className="text-sm text-slate-500 mt-1">Học sinh: <span className="font-bold text-slate-700">{selectedStudent.name} ({selectedStudent.id})</span></p>
            </div>
            
            <div className="p-4 md:p-6 overflow-y-auto">
              <p className="text-sm font-bold text-slate-700 mb-3">Chọn môn để gia hạn:</p>
              <div className="space-y-2">
                {selectedStudent.enrolledCourses.map((c, idx) => {
                  const isLow = c.remaining <= 2;
                  return (
                    <label 
                      key={idx} 
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedCourses.has(c.course) 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded flex items-center justify-center border ${
                          selectedCourses.has(c.course) ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                        }`}>
                          {selectedCourses.has(c.course) && (
                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{c.course}</p>
                          <p className={`text-xs ${isLow ? 'text-rose-600 font-semibold' : 'text-slate-500'}`}>
                            Còn {c.remaining} buổi
                          </p>
                        </div>
                      </div>
                      <div className="font-semibold text-slate-700">
                        {formatCurrency(c.fee)}
                      </div>
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
                  <QRCodeSVG 
                    value={getQrCodeString()} 
                    size={160} 
                    level="H"
                  />
                </div>
                <p className="mt-3 text-sm font-mono text-slate-700 bg-white px-3 py-1 rounded border border-slate-200">
                  {getQrCodeString()}
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
              <button 
                onClick={() => setSelectedStudent(null)}
                className="px-4 py-2 rounded-lg font-bold text-sm text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Đóng
              </button>
              <button 
                className="px-4 py-2 rounded-lg font-bold text-sm bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
                onClick={() => {
                  alert(`Đã lưu thanh toán: ${getQrCodeString()}`);
                  setSelectedStudent(null);
                }}
                disabled={selectedCourses.size === 0}
              >
                Xác nhận đã thu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Rental */}
      {selectedRenter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="p-4 md:p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900">Thu Tiền Thuê Phòng</h3>
              <p className="text-sm text-slate-500 mt-1">Người thuê: <span className="font-bold text-slate-700">{selectedRenter.name}</span></p>
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
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                Xác nhận đã thu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
