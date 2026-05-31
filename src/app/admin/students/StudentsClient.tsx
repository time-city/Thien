"use client";

import { useState, useMemo, useEffect } from "react";
import { Plus, Edit2, Trash2, X, Search, User as UserIcon, Phone, CheckSquare, Square, Loader2, Eye, Filter, ChevronLeft, ChevronRight, BookOpen, Upload, Calendar, School } from "lucide-react";
import { createStudent, updateStudent, deleteStudent, deleteStudents, getStudentDeletionImpact, importStudentsCsv } from "@/actions/mutations";
import { StudentData, ClassData } from "@/actions/queries";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useconfirm"; 
import { useRouter } from "next/navigation";

// === DATA CỨNG: DANH SÁCH TRƯỜNG ĐÀ NẴNG DÙNG ĐỂ GỢI Ý ===
const DA_NANG_SCHOOLS = [
  "THPT Chuyên Lê Quý Đôn",
  "THPT Phan Châu Trinh",
  "THPT Hoàng Hoa Thám",
  "THPT Trần Phú",
  "THPT Thái Phiên",
  "THPT Nguyễn Trãi",
  "THPT Tôn Thất Tùng",
  "THPT Nguyễn Hiền",
  "THPT Thanh Khê",
  "THCS Trưng Vương",
  "THCS Nguyễn Huệ",
  "THCS Tây Sơn",
  "THCS Lê Lợi",
  "THCS Chu Văn An",
  "THCS Kim Đồng",
  "THCS Nguyễn Bỉnh Khiêm",
  "THCS Hoàng Diệu"
];

export default function StudentsClient({
  initialStudents,
  classes,
}: {
  initialStudents: StudentData[];
  classes: ClassData[];
}) {
  const router = useRouter();
  const { confirm } = useConfirm();

  // ====== STATE ======
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentData | null>(null);
  
  // Form State
  const [fullName, setFullName] = useState("");
  const [phoneStudent, setPhoneStudent] = useState("");
  const [parentName, setParentName] = useState("");
  const [phoneParent, setPhoneParent] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [school, setSchool] = useState("");
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(false);
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Delete State
  const [isCheckingImpact, setIsCheckingImpact] = useState<string | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  
  // View Details
  const [viewStudent, setViewStudent] = useState<StudentData | null>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, classFilter, teacherFilter]);

  // ====== HANDLERS MỞ MODAL ======
  const openAddModal = () => {
    setEditingStudent(null);
    setFullName("");
    setPhoneStudent("");
    setParentName("");
    setPhoneParent("");
    setGender("");
    setDob("");
    setSchool("");
    setSelectedClassIds([]);
    setIsModalOpen(true);
  };

  const openEditModal = (s: StudentData) => {
    setEditingStudent(s);
    setFullName(s.fullName);
    setPhoneStudent(s.phone || "");
    setParentName(s.parentName || "");
    setPhoneParent(s.parentPhone || "");
    setGender(s.gender || "");
    setDob(s.dob ? new Date(s.dob).toISOString().slice(0, 10) : "");
    setSchool(s.school || "");
    setSelectedClassIds(s.enrolledCourses.map(c => c.classId));
    setIsModalOpen(true);
  };

  const openViewModal = (s: StudentData) => {
    setViewStudent(s);
  };

  // ====== CSV IMPORT ======
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      if (lines.length < 2) {
        toast.error("File CSV rỗng hoặc không đúng định dạng!");
        return;
      }
      
      const dataToImport = [];
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const fnIdx = headers.indexOf('fullname');
      const psIdx = headers.indexOf('phonestudent');
      const pnIdx = headers.indexOf('parentname');
      const ppIdx = headers.indexOf('phoneparent');
      const gIdx = headers.indexOf('gender');

      if (fnIdx === -1) {
        toast.error("Cột 'fullname' bắt buộc phải có trong dòng tiêu đề CSV!");
        return;
      }

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const cols = lines[i].split(',').map(c => c.trim());
        dataToImport.push({
          fullName: cols[fnIdx],
          phoneStudent: psIdx !== -1 ? cols[psIdx] : undefined,
          parentName: pnIdx !== -1 ? cols[pnIdx] : undefined,
          phoneParent: ppIdx !== -1 ? cols[ppIdx] : undefined,
          gender: gIdx !== -1 ? cols[gIdx] : undefined,
        });
      }

      if (dataToImport.length > 0) {
        setLoading(true);
        const res = await importStudentsCsv(dataToImport);
        if (res.success) {
          toast.success(`Nhập thành công ${res.count} học sinh!`);
          router.refresh();
        } else {
          toast.error(res.error || "Lỗi nhập file CSV");
        }
        setLoading(false);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  // ====== FORM SUBMIT ======
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      fullName,
      phoneStudent: phoneStudent || undefined,
      parentName: parentName || undefined,
      phoneParent: phoneParent || undefined,
      gender: gender || undefined,
      dob: dob || undefined,
      school: school || undefined,
      classIds: selectedClassIds,
    };

    if (editingStudent) {
      const res = await updateStudent(editingStudent.id, payload);
      if (res?.success) {
        toast.success("Cập nhật học sinh thành công!");
        setIsModalOpen(false);
        router.refresh();
      } else {
        toast.error(res?.error || "Lỗi cập nhật");
      }
    } else {
      const res = await createStudent(payload as any);
      if (res?.success) {
        toast.success("Thêm học sinh thành công!");
        setIsModalOpen(false);
        router.refresh();
      } else {
        toast.error(res?.error || "Lỗi tạo mới");
      }
    }
    setLoading(false);
  };

  // ====== SELECT CHỨC NĂNG ======
  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedStudents.length && paginatedStudents.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedStudents.map(s => s.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  // ====== XÓA GỌI GLOBAL CONFIRM ======
  const confirmDeleteSingle = async (id: string, name: string) => {
    setIsCheckingImpact(id);
    try {
      const res = await getStudentDeletionImpact(id);
      if (!res.success) {
        toast.error(res.error || "Lỗi kiểm tra dữ liệu.");
        return;
      }

      const impact = res.impact || { enrollmentCount: 0, paymentCount: 0, attendanceCount: 0 };
      const isSafe = impact?.enrollmentCount === 0 && impact.paymentCount === 0 && impact.attendanceCount === 0;
      
      confirm({
        title: "Xóa Học Sinh",
        message: (
          <div className="space-y-3">
            <p>Bạn có chắc chắn muốn xóa <strong>{name}</strong>?</p>
            {isSafe ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-[13px] leading-relaxed">
                <strong>✅ Dữ liệu an toàn:</strong> Học sinh này chưa có lịch sử ghi danh, thanh toán hay điểm danh. Bạn có thể xóa an toàn.
              </div>
            ) : (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-[13px] leading-relaxed">
                <strong>⚠️ CẢNH BÁO NGHIÊM TRỌNG:</strong> Xóa học sinh này sẽ làm mất:
                <ul className="list-disc pl-5 mt-2 space-y-1 mb-2 font-medium">
                  {impact.enrollmentCount > 0 && <li>{impact.enrollmentCount} bản ghi danh</li>}
                  {impact.paymentCount > 0 && <li>{impact.paymentCount} lịch sử thanh toán</li>}
                  {impact.attendanceCount > 0 && <li>{impact.attendanceCount} lịch sử điểm danh</li>}
                </ul>
                Hành động này <strong>KHÔNG THỂ hoàn tác!</strong>
              </div>
            )}
          </div>
        ),
        confirmText: "Vẫn Xóa Dữ Liệu",
        cancelText: "Hủy bỏ",
        isDestructive: true,
        onConfirm: async () => {
          const deleteRes = await deleteStudent(id);
          if (deleteRes.success) {
            toast.success("Xóa thành công!");
            router.refresh();
          } else {
            toast.error(deleteRes.error || "Lỗi xóa");
          }
        },
      });
    } catch {
      toast.error("Lỗi khi kiểm tra dữ liệu ảnh hưởng.");
    } finally {
      setIsCheckingImpact(null);
    }
  };

  const confirmDeleteMultiple = () => {
    if (selectedIds.size === 0) return;

    confirm({
      title: "Xóa Nhiều Học Sinh",
      message: (
        <div className="space-y-3">
          <p>Bạn có chắc chắn muốn xóa <strong>{selectedIds.size} học sinh đã chọn</strong>?</p>
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-[13px] leading-relaxed">
            <strong>⚠️ CẢNH BÁO:</strong> Xóa nhiều học sinh có thể làm mất dữ liệu ghi danh, điểm danh và thanh toán liên quan của các học sinh này.
          </div>
        </div>
      ),
      confirmText: "Vẫn Xóa Dữ Liệu",
      cancelText: "Hủy bỏ",
      isDestructive: true,
      onConfirm: async () => {
        const res = await deleteStudents(Array.from(selectedIds));
        if (res.success) {
          toast.success(`Đã xóa ${selectedIds.size} học sinh!`);
          setSelectedIds(new Set());
          router.refresh();
        } else {
          toast.error(res.error || "Lỗi xóa nhiều");
        }
      },
    });
  };

  // ====== FILTER & PAGINATION ======
  const allClasses = useMemo(() => {
    const classSet = new Set<string>();
    initialStudents.forEach(s => s.enrolledCourses.forEach(c => classSet.add(c.className)));
    return Array.from(classSet);
  }, [initialStudents]);

  const allTeachers = useMemo(() => {
    const teachers = new Set<string>();
    initialStudents.forEach(s => s.enrolledCourses.forEach(c => c.teachers.forEach(t => teachers.add(t))));
    return Array.from(teachers);
  }, [initialStudents]);

  const filteredStudents = useMemo(() => {
    return initialStudents.filter(s => {
      const matchSearch = s.fullName.toLowerCase().includes(search.toLowerCase()) || 
                          (s.phone && s.phone.includes(search));
      
      const matchClass = classFilter ? s.enrolledCourses.some(c => c.className === classFilter) : true;
      const matchTeacher = teacherFilter ? s.enrolledCourses.some(c => c.teachers.includes(teacherFilter)) : true;
      
      return matchSearch && matchClass && matchTeacher;
    });
  }, [initialStudents, search, classFilter, teacherFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / ITEMS_PER_PAGE));
  const paginatedStudents = filteredStudents.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="w-full max-w-7xl mx-auto pb-8 font-sans">
      
      {/* Header */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 md:p-5 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900">
              Quản Lý Học Sinh
            </h1>
            <p className="text-sm text-slate-500 font-medium mt-1">
              Danh sách học sinh, tìm kiếm và thao tác
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedIds.size > 0 && (
              <button 
                onClick={confirmDeleteMultiple} 
                className="bg-rose-50 hover:bg-rose-100 text-rose-600 px-4 py-2 rounded-xl font-bold text-sm border border-rose-200 transition-all flex items-center gap-2"
              >
                <Trash2 size={18} /> Xóa ({selectedIds.size})
              </button>
            )}
            <label className="transition-all cursor-pointer  hover:bg-emerald-100 text-emerald-700 px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm flex items-center gap-2 border border-emerald-200">
              <Upload size={18} strokeWidth={3} /> Import CSV
              <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
            </label>
            <button 
              onClick={openAddModal} 
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm flex items-center gap-2 transition-all"
            >
              <Plus size={18} strokeWidth={3} /> Thêm Học Sinh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên hoặc SĐT..." 
              className="w-full h-10 pl-10 pr-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            />
          </div>
          
          <div className="relative">
            <Filter className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <select 
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full h-10 pl-10 pr-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all appearance-none cursor-pointer"
            >
              <option value="">Tất cả lớp học</option>
              {allClasses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="relative">
            <UserIcon className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <select 
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
              className="w-full h-10 pl-10 pr-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all appearance-none cursor-pointer"
            >
              <option value="">Tất cả giáo viên</option>
              {allTeachers.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-4">
        {/* Xóa min-w-[1100px] để bảng co giãn vừa màn hình Mobile */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-widest font-extrabold text-slate-500">
                <th className="py-3 px-4 w-10 text-center">
                  <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-600">
                    {selectedIds.size === paginatedStudents.length && paginatedStudents.length > 0 ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} />}
                  </button>
                </th>
                <th className="py-3 px-4">Học Sinh</th>
                {/* Ẩn trên Mobile & Tablet, chỉ hiện trên PC */}
                <th className="py-3 px-4 hidden lg:table-cell">Ngày Sinh</th>
                <th className="py-3 px-4 hidden lg:table-cell">Trường Học</th>
                {/* Ẩn trên Mobile, hiện từ Tablet trở lên */}
                <th className="py-3 px-4 hidden md:table-cell">Liên Hệ</th>
                <th className="py-3 px-4 hidden lg:table-cell">Phụ Huynh</th>
                <th className="py-3 px-4 hidden md:table-cell min-w-[150px]">Lớp Đang Học</th>
                <th className="py-3 px-4 w-32 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500 font-medium">
                    Không tìm thấy học sinh nào phù hợp.
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="py-3 px-4 text-center">
                      <button onClick={() => toggleSelect(s.id)} className="text-slate-400 hover:text-slate-600">
                        {selectedIds.has(s.id) ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} />}
                      </button>
                    </td>
                    
                    <td className="py-3 px-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                        <span className="font-bold text-slate-800 text-sm whitespace-nowrap">{s.fullName}</span>
                        {s.gender && (
                          <span className={`w-fit px-2 py-0.5 rounded text-[10px] font-bold ${
                            s.gender === "MALE" ? "bg-blue-100 text-blue-700" : 
                            s.gender === "FEMALE" ? "bg-pink-100 text-pink-700" : 
                            "bg-slate-100 text-slate-700"
                          }`}>
                            {s.gender === "MALE" ? "Nam" : s.gender === "FEMALE" ? "Nữ" : "Khác"}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 hidden lg:table-cell">
                      {s.dob ? (
                        <span className="text-sm font-medium text-slate-600 whitespace-nowrap">
                          {new Date(s.dob).toLocaleDateString("vi-VN")}
                        </span>
                      ) : <span className="text-xs text-slate-400 italic">Chưa cập nhật</span>}
                    </td>

                    <td className="py-3 px-4 hidden lg:table-cell">
                      {s.school ? (
                        <span className="text-sm font-medium text-slate-600">
                          {s.school}
                        </span>
                      ) : <span className="text-xs text-slate-400 italic">Chưa cập nhật</span>}
                    </td>

                    <td className="py-3 px-4 hidden md:table-cell">
                      {s.phone ? (
                        <div className="flex items-center gap-1 text-sm font-medium text-slate-600 whitespace-nowrap">
                          <Phone size={14} className="text-slate-400" /> {s.phone}
                        </div>
                      ) : <span className="text-xs text-slate-400 italic">Chưa cập nhật</span>}
                    </td>
                    
                    <td className="py-3 px-4 hidden lg:table-cell">
                      {s.parentName ? (
                        <div>
                          <div className="font-bold text-slate-800 text-sm whitespace-nowrap">{s.parentName}</div>
                          {s.parentPhone && <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 whitespace-nowrap"><Phone size={12}/> {s.parentPhone}</div>}
                        </div>
                      ) : <span className="text-xs text-slate-400 italic">Chưa cập nhật</span>}
                    </td>
                    
                    <td className="py-3 px-4 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {s.enrolledCourses.map((c, i) => (
                          <span key={i} className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded-md border border-blue-100 flex items-center gap-1 whitespace-nowrap">
                            <BookOpen size={12} /> {c.className}
                          </span>
                        ))}
                      </div>
                    </td>
                    
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openViewModal(s)} className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors" title="Xem chi tiết">
                          <Eye size={16} />
                        </button>
                        <button onClick={() => openEditModal(s)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Sửa">
                          <Edit2 size={16} />
                        </button>
                        <button disabled={isCheckingImpact === s.id} onClick={() => confirmDeleteSingle(s.id, s.fullName)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-md transition-colors disabled:opacity-50" title="Xóa">
                          {isCheckingImpact === s.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex-wrap gap-2">
          <div className="text-sm font-medium text-slate-500">
            Hiển thị <span className="font-bold text-slate-800">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> đến <span className="font-bold text-slate-800">{Math.min(currentPage * ITEMS_PER_PAGE, filteredStudents.length)}</span> trong số <span className="font-bold text-slate-800">{filteredStudents.length}</span> HS
          </div>
          <div className="flex gap-1">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="p-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="px-4 py-1.5 font-bold text-sm text-slate-700">
              Trang {currentPage} / {totalPages}
            </div>
            <button 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
              className="p-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Modal Thêm/Sửa */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[95vh]">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
              <h2 className="text-lg font-extrabold text-slate-800">
                {editingStudent ? "Sửa Học Sinh" : "Thêm Học Sinh Mới"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 bg-slate-200 hover:bg-slate-300 rounded-full text-slate-600 transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Họ và Tên *</label>
                <input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nhập tên học sinh" className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Số điện thoại</label>
                  <input value={phoneStudent} onChange={(e) => setPhoneStudent(e.target.value)} placeholder="SĐT học sinh" className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Giới tính</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all appearance-none cursor-pointer">
                    <option value="">Chưa xác định</option>
                    <option value="MALE">Nam</option>
                    <option value="FEMALE">Nữ</option>
                    <option value="OTHER">Khác</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Calendar size={14} className="text-slate-400" /> Ngày sinh
                  </label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <School size={14} className="text-slate-400" /> Trường học
                  </label>
                  <input
                    list="danang-schools"
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                    placeholder="Chọn hoặc nhập trường..."
                    className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  />
                  <datalist id="danang-schools">
                    {DA_NANG_SCHOOLS.map(s => <option key={s} value={s} />)}
                  </datalist>
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-100 mt-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tên Phụ huynh</label>
                <input value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="Tên phụ huynh" className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">SĐT Phụ huynh</label>
                <input value={phoneParent} onChange={(e) => setPhoneParent(e.target.value)} placeholder="SĐT phụ huynh" className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all" />
              </div>

              {/* CHỌN LỚP HỌC ĐỂ GHI DANH */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100 mt-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Ghi danh vào lớp (Tùy chọn)
                </label>
                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl bg-slate-50 p-2 space-y-1">
                  {classes.length === 0 ? (
                    <div className="text-xs text-slate-500 p-2 text-center">Chưa có lớp học nào trên hệ thống.</div>
                  ) : classes.map(c => (
                    <label key={c.id} className="flex items-center gap-2 p-2 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors">
                      <input 
                        type="checkbox" 
                        checked={selectedClassIds.includes(c.id)} 
                        onChange={(e) => {
                          if (e.target.checked) setSelectedClassIds([...selectedClassIds, c.id]);
                          else setSelectedClassIds(selectedClassIds.filter(id => id !== c.id));
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-800">{c.name}</span>
                      </div>
                    </label>
                  ))}
                </div>
                {editingStudent && (
                  <p className="text-[11px] text-slate-500 italic mt-1">
                    * Lưu ý: Cập nhật này sẽ thêm học sinh vào các lớp mới chọn. Nếu muốn hủy ghi danh, vui lòng thao tác ở màn hình chi tiết lớp.
                  </p>
                )}
              </div>

              <div className="mt-6 pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-lg transition-colors">Hủy</button>
                <button type="submit" disabled={loading} className="px-5 py-2 min-w-[100px] text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all disabled:opacity-70 flex justify-center items-center">
                  {loading ? "Đang lưu..." : "Lưu Học Sinh"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal View Detail */}
      {viewStudent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh]">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
              <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                <UserIcon size={20} className="text-blue-600" /> Hồ Sơ Học Sinh
              </h2>
              <button onClick={() => setViewStudent(null)} className="p-1.5 bg-slate-200 hover:bg-slate-300 rounded-full text-slate-600 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 space-y-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <h3 className="text-sm font-bold text-slate-800 mb-3 border-b border-slate-200 pb-2">Thông tin cá nhân</h3>
                    <div className="space-y-2 text-sm">
                      <p className="flex justify-between sm:block"><span className="text-slate-500 font-medium inline-block w-24">Họ và tên:</span> <span className="font-bold text-slate-800">{viewStudent.fullName}</span></p>
                      <p className="flex justify-between sm:block"><span className="text-slate-500 font-medium inline-block w-24">Giới tính:</span> <span className="font-semibold text-slate-700">{viewStudent.gender === "MALE" ? "Nam" : viewStudent.gender === "FEMALE" ? "Nữ" : viewStudent.gender === "OTHER" ? "Khác" : "Chưa cập nhật"}</span></p>
                      <p className="flex justify-between sm:block"><span className="text-slate-500 font-medium inline-block w-24">Điện thoại:</span> <span className="font-semibold text-slate-700">{viewStudent.phone || "Chưa cập nhật"}</span></p>
                      <p className="flex justify-between sm:block"><span className="text-slate-500 font-medium inline-block w-24">Ngày sinh:</span> <span className="font-semibold text-slate-700">{viewStudent.dob ? new Date(viewStudent.dob).toLocaleDateString("vi-VN") : "Chưa cập nhật"}</span></p>
                      <p className="flex justify-between sm:block"><span className="text-slate-500 font-medium inline-block w-24">Trường:</span> <span className="font-semibold text-slate-700">{viewStudent.school || "Chưa cập nhật"}</span></p>
                    </div>
                  </div>
                </div>
                <div className="flex-1 space-y-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 h-full">
                    <h3 className="text-sm font-bold text-slate-800 mb-3 border-b border-slate-200 pb-2">Thông tin Phụ huynh</h3>
                    <div className="space-y-2 text-sm">
                      <p className="flex justify-between sm:block"><span className="text-slate-500 font-medium inline-block w-24">Họ và tên:</span> <span className="font-bold text-slate-800">{viewStudent.parentName || "Chưa cập nhật"}</span></p>
                      <p className="flex justify-between sm:block"><span className="text-slate-500 font-medium inline-block w-24">Điện thoại:</span> <span className="font-semibold text-slate-700">{viewStudent.parentPhone || "Chưa cập nhật"}</span></p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2"><BookOpen size={16} /> Lớp Học Đang Ghi Danh</h3>
                {viewStudent.enrolledCourses.length === 0 ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-sm font-medium text-slate-500">
                    Học sinh chưa đăng ký lớp học nào.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {viewStudent.enrolledCourses.map((c, i) => (
                      <div key={i} className="p-3 border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col gap-1.5">
                        <div className="font-bold text-slate-800 text-sm">{c.className}</div>
                        <div className="text-xs text-slate-500 flex justify-between">
                          <span className={c.feeStatus === "PAID" ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>{c.feeStatus === "PAID" ? "Đã nộp học phí" : "Chưa nộp"}</span>
                        </div>
                        <div className="text-xs text-slate-500">Giáo viên: <b>{c.teachers.join(", ") || "Chưa phân công"}</b></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}