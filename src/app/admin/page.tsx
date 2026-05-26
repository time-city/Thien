"use client";

import { useState } from 'react';
import { mockStudents, CLASSES, Student } from '@/lib/mock-data';
import ReportTemplate from '@/components/report-template';

export default function AdminPage() {
  const [selectedClass, setSelectedClass] = useState<string>(CLASSES[0]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const filteredStudents = mockStudents.filter(s => s.className === selectedClass);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row p-4 md:p-6 gap-6 font-sans">
      
      {/* Panel Điều kiẻn (Trái) */}
      <aside className="w-full md:w-[350px] flex flex-col gap-6 flex-shrink-0 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Admin Dashboard</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Hệ thống Xuất Báo cáo Học tập</p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <span className="w-5 h-5 bg-blue-100 text-blue-700 flex items-center justify-center rounded-full">1</span> 
            CHỌN LỚP HỌC
          </label>
          <select 
            className="w-full bg-slate-50 border border-slate-200 rounded-xl h-12 px-4 text-base font-bold text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
            value={selectedClass}
            onChange={(e) => {
              setSelectedClass(e.target.value);
              setSelectedStudent(null);
            }}
          >
            {CLASSES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2 flex-1 md:overflow-hidden">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <span className="w-5 h-5 bg-blue-100 text-blue-700 flex items-center justify-center rounded-full">2</span> 
            CHỌN HỌC SINH ({filteredStudents.length})
          </label>
          <div className="flex-1 md:overflow-y-auto space-y-2 pb-4 pt-1 md:pr-2">
            {filteredStudents.map(student => (
              <button
                key={student.id}
                onClick={() => setSelectedStudent(student)}
                className={`w-full text-left p-3.5 rounded-xl border-2 transition-all flex items-center justify-between ${
                  selectedStudent?.id === student.id 
                    ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-sm' 
                    : 'bg-white border-slate-100 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="font-bold text-sm">{student.name}</div>
                  <div className="text-xs font-semibold text-slate-400 mt-0.5">{student.id}</div>
                </div>
                {selectedStudent?.id === student.id && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><polyline points="20 6 9 17 4 12"></polyline></svg>
                )}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Panel Preview (Phải) */}
      <main className="flex-1 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm relative overflow-hidden">
        {!selectedStudent ? (
          <div className="text-center flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-slate-50 border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" x2="8" y1="13" y2="13"></line><line x1="16" x2="8" y1="17" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </div>
            <div>
              <p className="text-slate-800 font-bold text-lg">Chưa chọn học sinh</p>
              <p className="text-slate-500 font-medium text-sm mt-1">Chọn một học sinh từ danh sách bên trái để tạo Báo cáo</p>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in zoom-in-95 duration-300 w-full flex justify-center">
            <ReportTemplate student={selectedStudent} />
          </div>
        )}
      </main>

    </div>
  );
}
