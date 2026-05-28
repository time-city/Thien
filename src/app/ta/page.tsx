"use client";

import { useState, useMemo, useEffect } from 'react';
import { mockStudents, mockClasses, mockUsers } from '@/lib/mock-data';
import { useAuth } from '@/lib/AuthContext';

// Mở rộng kiểu dữ liệu Student cho màn hình Điểm danh Sơ đồ
type CheckInStudent = {
  id: string;
  name: string;
  className: string;
  seat: string;
  attendance?: 'PRESENT' | 'LATE' | 'EXCUSED' | 'UNEXCUSED';
  homework?: 'GOOD' | 'DONE' | 'NONE';
  note?: string;
};

export default function CinemaCheckInPage() {
  const { role, currentUser } = useAuth();
  const [filterTeacher, setFilterTeacher] = useState<string>('ALL');

  // Lọc danh sách lớp: Teacher chỉ thấy lớp mình. Admin thấy theo filter.
  const visibleClasses = useMemo(() => {
    if (role === 'TEACHER') {
      return mockClasses.filter(c => c.teacherId === currentUser?.id);
    }
    if (filterTeacher !== 'ALL') {
      return mockClasses.filter(c => c.teacherId === filterTeacher);
    }
    return mockClasses;
  }, [role, currentUser, filterTeacher]);

  const [selectedClass, setSelectedClass] = useState<string>('');

  useEffect(() => {
    if (visibleClasses.length > 0 && !visibleClasses.some(c => c.name === selectedClass)) {
      setSelectedClass(visibleClasses[0].name);
    }
  }, [visibleClasses, selectedClass]);

  const [sessionDate, setSessionDate] = useState<string>('');
  const [sessionNum, setSessionNum] = useState<number>(5);

  const [studentsState, setStudentsState] = useState<CheckInStudent[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<CheckInStudent | null>(null);

  // Set default date to today only on client
  useEffect(() => {
    setSessionDate(new Date().toISOString().split('T')[0]);
  }, []);

  // Khởi tạo & tính toán Tọa độ ghế khi chọn lớp mới
  useEffect(() => {
    const rawStudents = mockStudents.filter(s => s.className === selectedClass).slice(0, 20);
    
    const mapped: CheckInStudent[] = rawStudents.map((s, idx) => {
      // Giả sử có 4 hàng (A, B, C, D) chia cho 5 cột
      const rowLabels = ['A', 'B', 'C', 'D'];
      const row = rowLabels[Math.floor(idx / 5)] || 'E';
      const col = (idx % 5) + 1;
      
      return {
        id: s.id,
        name: s.name,
        className: s.className,
        seat: `${row}${col}`,
      };
    });
    setStudentsState(mapped);
  }, [selectedClass]);

  // Cập nhật state sau khi Đánh giá trong Modal
  const handleSaveAssessment = (id: string, updates: Partial<CheckInStudent>) => {
    setStudentsState(prev => prev.map(st => 
      st.id === id ? { ...st, ...updates } : st
    ));
    setSelectedStudent(null);
  };

  // Helper cho màu Indicator dots
  const getAttendanceColor = (att?: string) => {
    switch (att) {
      case 'PRESENT': return 'bg-emerald-500';
      case 'LATE': return 'bg-amber-500';
      case 'EXCUSED': return 'bg-orange-500';
      case 'UNEXCUSED': return 'bg-rose-500';
      default: return 'bg-slate-200';
    }
  };

  const getHomeworkColor = (hw?: string) => {
    switch (hw) {
      case 'GOOD': return 'bg-emerald-500';
      case 'DONE': return 'bg-amber-500';
      case 'NONE': return 'bg-rose-500';
      default: return 'bg-slate-200';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20 font-sans">
      
      {/* GLOBAL CONTROLS */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm p-4 md:p-6 lg:px-8">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-4 items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Sơ Đồ Lớp Học</h1>
            <p className="text-sm text-slate-500 font-medium">
              {role === 'SUPER_ADMIN' ? 'Giám sát chéo tất cả các lớp' : 'Quản lý điểm danh lớp của bạn'}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            {role === 'SUPER_ADMIN' && (
              <select 
                className="flex-1 md:w-40 bg-purple-50 border border-purple-200 rounded-lg h-10 px-3 text-sm font-bold text-purple-700 focus:outline-none"
                value={filterTeacher}
                onChange={(e) => setFilterTeacher(e.target.value)}
              >
                <option value="ALL">Tất cả Giảng viên</option>
                {mockUsers.filter(u => u.role === 'TEACHER').map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}

            <select 
              className="flex-1 md:w-32 bg-slate-50 border border-slate-200 rounded-lg h-10 px-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              {visibleClasses.length === 0 ? <option value="">Không có lớp</option> : null}
              {visibleClasses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <input 
              type="date"
              className="flex-1 md:w-40 bg-slate-50 border border-slate-200 rounded-lg h-10 px-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
            />
          </div>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-4xl mx-auto flex flex-col gap-8 mt-4">
        
        {/* KHU VỰC BẢNG (SCREEN/BOARD) */}
        <div className="flex justify-center mb-4">
          <div className="w-3/4 max-w-md bg-white border-2 border-slate-200 shadow-sm rounded-b-3xl rounded-t-sm h-12 flex items-center justify-center relative">
            <span className="text-sm font-black tracking-widest text-slate-400">BẢNG / GIÁO VIÊN</span>
            <div className="absolute top-full mt-2 w-full h-[1px] bg-gradient-to-r from-transparent via-slate-300 to-transparent opacity-50"></div>
          </div>
        </div>

        {/* LƯỚI CHỖ NGỒI (GRID LAYOUT) */}
        <div className="grid grid-cols-4 md:grid-cols-5 gap-3 md:gap-5">
          {studentsState.map((student) => {
            const isAssessed = student.attendance || student.homework;

            // Xử lý lấy tên ngắn (VD: "Nguyễn Khương Duy" -> "Khương Duy" hoặc "Duy")
            const nameParts = student.name.split(' ');
            const shortName = nameParts.length > 2 
              ? `${nameParts[nameParts.length - 2]} ${nameParts[nameParts.length - 1]}` 
              : student.name;

            return (
              <button
                key={student.id}
                onClick={() => setSelectedStudent(student)}
                className={`relative aspect-square md:aspect-auto md:h-28 bg-white border-2 rounded-xl sm:rounded-2xl p-2 flex flex-col items-center justify-center transition-all duration-200 hover:-translate-y-1 hover:shadow-md group ${
                  isAssessed ? 'border-slate-300' : 'border-slate-200 border-dashed hover:border-blue-400'
                }`}
              >
                {/* ID Ghế Góc trên bên trái */}
                <span className="absolute top-1.5 left-2 text-[10px] sm:text-xs font-black text-slate-300 group-hover:text-blue-400 transition-colors">
                  {student.seat}
                </span>

                {/* Avatar Text (Chữ cái đầu Tiên) */}
                <div className={`mt-2 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-sm sm:text-base border transition-colors ${
                  isAssessed ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-100 text-slate-500 border-slate-200 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-200'
                }`}>
                  {nameParts[nameParts.length - 1].charAt(0).toUpperCase()}
                </div>

                {/* Tên ngắn */}
                <span className="mt-1.5 sm:mt-2 text-[11px] sm:text-xs font-bold text-slate-700 text-center leading-tight truncate w-full px-1">
                  {shortName}
                </span>

                {/* Indicator Dots Góc dưới bên phải */}
                <div className="absolute bottom-1.5 right-1.5 sm:bottom-2 sm:right-2 flex gap-1 sm:gap-1.5">
                  {/* Chấm 1: Điểm danh */}
                  <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${getAttendanceColor(student.attendance)}`} title="Điểm danh"></div>
                  {/* Chấm 2: BTVN */}
                  <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${getHomeworkColor(student.homework)}`} title="Bài tập"></div>
                </div>
              </button>
            );
          })}
        </div>
        
        {/* Chú thích trạng thái dưới cùng */}
        <div className="mt-8 flex flex-wrap justify-center gap-6 text-[11px] sm:text-xs font-semibold text-slate-500">
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span> Tốt / Có mặt</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span> Làm đủ / Trễ</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-orange-500 inline-block"></span> Phép</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-rose-500 inline-block"></span> Không làm / Vắng</div>
        </div>

      </main>

      {/* DETAIL MODAL THẲNG Ở LAYER NÀY KHI TRUYỀN DATA */}
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

// ---------------------------------------------------------
// MODAL COMPONENT (Trực quan trên Modal riêng)
// ---------------------------------------------------------
function AssessmentModal({ 
  student, 
  onClose, 
  onSave 
}: { 
  student: CheckInStudent;
  onClose: () => void;
  onSave: (id: string, updates: Partial<CheckInStudent>) => void;
}) {
  const [attendance, setAttendance] = useState(student.attendance || 'PRESENT');
  const [homework, setHomework] = useState(student.homework || 'DONE');
  const [note, setNote] = useState(student.note || '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      {/* Nền bấm để đóng */}
      <div className="absolute inset-0 z-[-1]" onClick={onClose}></div>

      {/* Frame Giao diện Modal */}
      <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl flex flex-col border border-slate-200 animate-in zoom-in-95 duration-200">
        
        {/* Header Modal */}
        <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50 rounded-t-3xl">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 leading-tight">{student.name}</h2>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-xs font-bold text-slate-500">Ghế: {student.seat}</span>
              <span className="text-xs font-semibold text-slate-400">Class: {student.className}</span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-slate-200 text-slate-600 rounded-full hover:bg-slate-300 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* Nội dung đánh giá */}
        <div className="p-6 flex flex-col gap-6">
          
          {/* Cụm ĐIỂM DANH */}
          <div className="flex flex-col gap-3">
            <label className="text-sm font-extrabold text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <div className="w-1.5 h-4 bg-blue-500 rounded-full"></div>
              TRẠNG THÁI ĐIỂM DANH
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setAttendance('PRESENT')} 
                className={`h-12 sm:h-14 font-extrabold text-sm sm:text-base rounded-xl transition-all border-2 ${
                  attendance === 'PRESENT' ? 'bg-emerald-500 border-emerald-500 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50'
                }`}>
                Có mặt
              </button>
              <button 
                onClick={() => setAttendance('LATE')} 
                className={`h-12 sm:h-14 font-extrabold text-sm sm:text-base rounded-xl transition-all border-2 ${
                  attendance === 'LATE' ? 'bg-amber-500 border-amber-500 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300 hover:bg-amber-50'
                }`}>
                Trễ 10p
              </button>
              <button 
                onClick={() => setAttendance('EXCUSED')} 
                className={`h-12 sm:h-14 font-extrabold text-sm sm:text-base rounded-xl transition-all border-2 ${
                  attendance === 'EXCUSED' ? 'bg-orange-500 border-orange-500 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-orange-300 hover:bg-orange-50'
                }`}>
                Vắng phép
              </button>
              <button 
                onClick={() => setAttendance('UNEXCUSED')} 
                className={`h-12 sm:h-14 font-extrabold text-sm sm:text-base rounded-xl transition-all border-2 ${
                  attendance === 'UNEXCUSED' ? 'bg-rose-500 border-rose-500 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-rose-300 hover:bg-rose-50'
                }`}>
                Không phép
              </button>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Cụm BÀI TẬP */}
          <div className="flex flex-col gap-3">
            <label className="text-sm font-extrabold text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <div className="w-1.5 h-4 bg-purple-500 rounded-full"></div>
              BÀI TẬP VỀ NHÀ
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button 
                onClick={() => setHomework('GOOD')} 
                className={`h-12 sm:h-14 font-extrabold text-sm sm:text-base rounded-xl transition-all border-2 ${
                  homework === 'GOOD' ? 'bg-emerald-500 border-emerald-500 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50'
                }`}>
                Tốt
              </button>
              <button 
                onClick={() => setHomework('DONE')} 
                className={`h-12 sm:h-14 font-extrabold text-sm sm:text-base rounded-xl transition-all border-2 ${
                  homework === 'DONE' ? 'bg-amber-500 border-amber-500 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300 hover:bg-amber-50'
                }`}>
                Đạt
              </button>
              <button 
                onClick={() => setHomework('NONE')} 
                className={`h-12 sm:h-14 font-extrabold text-sm sm:text-base rounded-xl transition-all border-2 ${
                  homework === 'NONE' ? 'bg-rose-500 border-rose-500 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-rose-300 hover:bg-rose-50'
                }`}>
                Không
              </button>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* GHI CHÚ */}
          <div className="flex flex-col gap-3">
            <label className="text-sm font-extrabold text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <div className="w-1.5 h-4 bg-slate-400 rounded-full"></div>
              NHẬN XÉT CHI TIẾT
            </label>
            <textarea
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-4 text-sm sm:text-base text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:bg-white resize-none shadow-sm transition-all"
              rows={2}
              placeholder="Ghi chú thêm nếu cần thiết..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

        </div>

        {/* Nút LƯU ĐÁNH GIÁ */}
        <div className="p-6 bg-white border-t border-slate-100 rounded-b-3xl">
          <button
            onClick={() => onSave(student.id, { attendance, homework, note })}
            className="w-full h-14 sm:h-16 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black text-lg sm:text-xl tracking-wide rounded-2xl shadow-[0_4px_14px_rgba(37,99,235,0.3)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.4)] transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            LƯU ĐÁNH GIÁ
          </button>
        </div>

      </div>
    </div>
  );
}
