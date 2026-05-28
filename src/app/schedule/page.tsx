"use client";

import { useAuth } from '@/lib/AuthContext';
import { mockSchedule, mockRentals, ScheduleItem, RentalSession, mockUsers } from '@/lib/mock-data';
import { useMemo, useState } from 'react';
import { AlertCircle, Key } from 'lucide-react';

const DAYS = [
  { id: 1, name: 'Thứ 2' },
  { id: 2, name: 'Thứ 3' },
  { id: 3, name: 'Thứ 4' },
  { id: 4, name: 'Thứ 5' },
  { id: 5, name: 'Thứ 6' },
  { id: 6, name: 'Thứ 7' },
  { id: 7, name: 'Chủ Nhật' },
];

const SHIFTS = [
  { id: 1, time: '08:00 - 09:30' },
  { id: 2, time: '14:00 - 15:30' },
  { id: 3, time: '17:30 - 19:00' },
  { id: 4, time: '19:30 - 21:00' },
];

type CombinedSession = {
  type: 'INTERNAL' | 'RENTAL';
  room: string;
  displayTitle: string;
  displaySubtitle: string;
  teacherId?: string; // only for internal
};

export default function SchedulePage() {
  const { role, currentUser } = useAuth();
  const [filterTeacher, setFilterTeacher] = useState<string>('ALL');

  // Group classes by shift and day
  // Structure: { [shiftId_dayId]: CombinedSession[] }
  const scheduleMap = useMemo(() => {
    const map: Record<string, CombinedSession[]> = {};
    
    // Internal Classes
    for (const item of mockSchedule) {
      if (role === 'TEACHER' && item.teacherId !== currentUser?.id) continue;
      if (role === 'SUPER_ADMIN' && filterTeacher !== 'ALL' && item.teacherId !== filterTeacher) continue;

      const key = `${item.shift}_${item.dayOfWeek}`;
      if (!map[key]) map[key] = [];
      const teacherName = mockUsers.find(u => u.id === item.teacherId)?.name || 'Unknown';
      map[key].push({
        type: 'INTERNAL',
        room: item.room,
        displayTitle: item.className,
        displaySubtitle: teacherName,
        teacherId: item.teacherId
      });
    }

    // Rental Sessions (only Admin sees rentals OR we can show it to everyone but they can't edit? The prompt says "Tính năng này CHỈ Admin được thấy")
    if (role === 'SUPER_ADMIN') {
      for (const item of mockRentals) {
        const key = `${item.shift}_${item.dayOfWeek}`;
        if (!map[key]) map[key] = [];
        map[key].push({
          type: 'RENTAL',
          room: item.room,
          displayTitle: 'Cho Thuê',
          displaySubtitle: item.renterName
        });
      }
    }

    return map;
  }, [role, currentUser, filterTeacher]);

  if (role !== 'SUPER_ADMIN' && role !== 'TEACHER') {
    return (
      <div className="p-8 text-center text-slate-500">
        Bạn không có quyền truy cập trang này.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto overflow-x-auto">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Lịch Phòng Học</h1>
          <p className="text-slate-500 mt-1 text-sm font-medium">Theo dõi và quản lý phòng trống, phòng trùng giờ.</p>
        </div>

        {role === 'SUPER_ADMIN' && (
          <select 
            className="w-full md:w-48 bg-white border border-slate-200 rounded-lg h-10 px-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
            value={filterTeacher}
            onChange={(e) => setFilterTeacher(e.target.value)}
          >
            <option value="ALL">Tất cả lịch</option>
            {mockUsers.filter(u => u.role === 'TEACHER').map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="min-w-[800px] border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
        {/* Header Row (Days) */}
        <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50">
          <div className="p-4 border-r border-slate-200 flex items-center justify-center font-bold text-slate-600 text-sm">
            Ca học
          </div>
          {DAYS.map(day => (
            <div key={day.id} className="p-4 border-r last:border-r-0 border-slate-200 text-center font-extrabold text-slate-900 text-sm">
              {day.name}
            </div>
          ))}
        </div>

        {/* Body Rows (Shifts) */}
        {SHIFTS.map(shift => (
          <div key={shift.id} className="grid grid-cols-8 border-b last:border-b-0 border-slate-200">
            {/* Shift Column */}
            <div className="p-4 border-r border-slate-200 bg-slate-50/50 flex flex-col justify-center items-center">
              <span className="font-bold text-slate-800">Ca {shift.id}</span>
              <span className="text-xs text-slate-500 font-medium mt-1">{shift.time}</span>
            </div>

            {/* Days Columns */}
            {DAYS.map(day => {
              const key = `${shift.id}_${day.id}`;
              const items = scheduleMap[key] || [];

              // Check conflict based on room
              const roomCounts: Record<string, number> = {};
              items.forEach(it => {
                roomCounts[it.room] = (roomCounts[it.room] || 0) + 1;
              });
              
              const hasConflict = Object.values(roomCounts).some(count => count > 1);

              return (
                <div 
                  key={day.id} 
                  className={`p-2 border-r last:border-r-0 border-slate-100 min-h-[120px] transition-colors ${
                    hasConflict ? 'bg-rose-50/30' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex flex-col gap-2 relative">
                    {hasConflict && (
                      <div className="absolute -top-1 -right-1 text-rose-500" title="Trùng lịch phòng">
                        <AlertCircle size={16} className="fill-white" />
                      </div>
                    )}
                    
                    {items.map((item, idx) => {
                      const isConflictItem = roomCounts[item.room] > 1;
                      
                      const baseClasses = "p-2 rounded border text-xs flex flex-col shadow-sm";
                      let styleClasses = "";

                      if (isConflictItem) {
                        styleClasses = "border-rose-500 bg-rose-50 text-rose-900";
                      } else if (item.type === 'RENTAL') {
                        styleClasses = "border-purple-200 bg-purple-50 text-purple-700";
                      } else {
                        styleClasses = "border-blue-200 bg-blue-50 text-blue-700";
                      }

                      return (
                        <div key={idx} className={`${baseClasses} ${styleClasses}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold">{item.displayTitle}</span>
                            {item.type === 'RENTAL' && <Key size={12} className="text-purple-600" />}
                          </div>
                          <span className={`font-medium mt-0.5 ${isConflictItem ? 'text-rose-700' : (item.type === 'RENTAL' ? 'text-purple-600' : 'text-blue-600')}`}>
                            {item.room}
                          </span>
                          <span className={`mt-1 pt-1 border-t ${item.type === 'RENTAL' ? 'border-purple-200/50 text-purple-600/80' : 'border-blue-200/50 text-blue-600/80'}`}>
                            {item.displaySubtitle}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
