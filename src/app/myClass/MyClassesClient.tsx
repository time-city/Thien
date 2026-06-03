"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { 
  Eye, BookOpen, CreditCard, Users, Plus, Edit2, Trash2, 
  Search, UserSquare2, LayoutGrid, X, Loader2, AlertCircle, Phone, Calendar, School, Filter
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/hooks/useconfirm";
import { 
  createClass, updateClassByTeacher, deleteClassByTeacher,
  addStudentByTeacher, updateStudentByTeacher, deleteStudentByTeacher
} from "@/actions/mutations";

// --- Types Chuẩn ---
export type ClassData = {
  id: string;
  name: string;
  category: string;
  pricePerSession: number;
  roomFeePerSession: number;
  sessionsPerPackage: number;
  status: "APPROVED" | "PENDING" | "REJECTED";
  createdById: string | null;
  teachers?: { teacherId: string; teacherName: string }[];
};

export type StudentData = {
  id: string;
  fullName: string;
  phone?: string | null;
  phoneStudent?: string | null;
  parentName?: string | null;
  parentPhone?: string | null;
  phoneParent?: string | null;
  gender?: string | null;
  dob?: Date | string | null;
  school?: string | null;
  enrolledCourses?: {
    classId: string;
    className: string;
    feeStatus: string;
    remainingSessions: number;
  }[];
};

type SelectedClassInfo = {
  classId: string;
  feeStatus: "PAID" | "UNPAID";
};

const DA_NANG_SCHOOLS = [
  "THPT Phan Châu Trinh", "THPT Hoàng Hoa Thám", "THPT Trần Phú",
  "THPT Thái Phiên", "THPT Nguyễn Trãi", "THPT Tôn Thất Tùng",
  "THPT Ngô Quyền", "THPT Cẩm Lệ", "THPT Liên Chiểu",
  "THCS Trưng Vương", "THCS Tây Sơn", "THCS Nguyễn Huệ",
  "Khác"
];

export default function MyClassesClient({
  initialClasses,
  initialStudents,
  teacherId,
}: {
  initialClasses: ClassData[];
  initialStudents: StudentData[];
  teacherId: string;
}) {
  const router = useRouter();
  const { confirm } = useConfirm();

  const [activeTab, setActiveTab] = useState<"classes" | "students">("classes");
  const [search, setSearch] = useState("");
  const [filterClassId, setFilterClassId] = useState<string>("ALL"); 
  const [loading, setLoading] = useState(false);

  // Modal States
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassData | null>(null);
  
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentData | null>(null);

  // Form States - Class
  const [className, setClassName] = useState("");
  const [classCategory, setClassCategory] = useState("Cấp 3");
  const [classPrice, setClassPrice] = useState<number | "">("");
  const [classRoomFee, setClassRoomFee] = useState<number | "">("");
  const [classSessions, setClassSessions] = useState<number | "">(12);

  // Form States - Student
  const [studentName, setStudentName] = useState("");
  const [studentPhone, setStudentPhone] = useState("");
  const [gender, setGender] = useState<string>("");
  const [dob, setDob] = useState<string>("");
  const [school, setSchool] = useState<string>("");
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");

  const [selectedClasses, setSelectedClasses] = useState<SelectedClassInfo[]>([]);

  const selectedFeeForClass = (classId: string): "PAID" | "UNPAID" => {
    const found = selectedClasses.find((x) => x.classId === classId);
    return found?.feeStatus ?? "UNPAID";
  };

  // --- Filters ---
  const filteredClasses = useMemo(() => {
    if (!search.trim()) return initialClasses;
    return initialClasses.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  }, [initialClasses, search]);

  const filteredStudents = useMemo(() => {
    let result = initialStudents;
    if (filterClassId !== "ALL") {
      result = result.filter(s => s.enrolledCourses?.some(ec => ec.classId === filterClassId));
    }
    if (search.trim()) {
      result = result.filter(s => s.fullName.toLowerCase().includes(search.toLowerCase()));
    }
    return result;
  }, [initialStudents, search, filterClassId]);

  // --- Handlers: Class ---
  const openAddClass = () => {
    setEditingClass(null); setClassName(""); setClassCategory("Cấp 3");
    setClassPrice(""); setClassRoomFee(""); setClassSessions(12);
    setIsClassModalOpen(true);
  };

  const openEditClass = (c: ClassData) => {
    setEditingClass(c); setClassName(c.name); setClassCategory(c.category);
    setClassPrice(c.pricePerSession); setClassRoomFee(c.roomFeePerSession); setClassSessions(c.sessionsPerPackage);
    setIsClassModalOpen(true);
  };

  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const payload = {
      name: className, category: classCategory,
      pricePerSession: Number(classPrice) || 0,
      roomFeePerSession: Number(classRoomFee) || 0,
      sessionsPerPackage: Number(classSessions) || 12,
    };

    const res = editingClass ? await updateClassByTeacher(editingClass.id, payload) : await createClass(payload);
    setLoading(false);
    if (res.success) {
      toast.success(editingClass ? "Đã cập nhật lớp học!" : "Đã gửi yêu cầu tạo lớp!");
      setIsClassModalOpen(false); router.refresh();
    } else {
      toast.error(res.error || "Lỗi lưu lớp học");
    }
  };

  const handleDeleteClass = async (c: ClassData) => {
    confirm({
      title: "Xóa Lớp Học",
      message: `Bạn có chắc chắn muốn xóa lớp "${c.name}"? Hành động này không thể hoàn tác.`,
      isDestructive: true,
      onConfirm: async () => {
        const res = await deleteClassByTeacher(c.id);
        if (res.success) {
          toast.success("Đã xóa lớp học!"); router.refresh();
        } else {
          toast.error(res.error || "Không thể xóa lớp này");
        }
      }
    });
  };

  // --- Handlers: Student ---
  const openAddStudent = () => {
    setEditingStudent(null);
    setStudentName(""); setStudentPhone(""); setGender(""); setDob("");
    setSchool(""); setParentName(""); setParentPhone(""); setSelectedClasses([]);
    setIsStudentModalOpen(true);
  };

  const openEditStudent = (s: StudentData) => {
    setEditingStudent(s);
    setStudentName(s.fullName || "");
    setStudentPhone(s.phone || s.phoneStudent || "");
    setGender(s.gender || "");
    setDob(s.dob ? new Date(s.dob).toISOString().slice(0, 10) : "");
    setSchool(s.school || "");
    setParentName(s.parentName || "");
    setParentPhone(s.parentPhone || s.phoneParent || "");
    const enrolled = (s.enrolledCourses ?? []).map((ec) => ({
      classId: ec.classId, feeStatus: ec.feeStatus === "PAID" ? "PAID" : "UNPAID",
    })) as SelectedClassInfo[];
    setSelectedClasses(enrolled);
    setIsStudentModalOpen(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedClasses.length === 0) return toast.error("Vui lòng chọn ít nhất 1 lớp cho học sinh");
    setLoading(true);
    const payload = {
      fullName: studentName, phoneStudent: studentPhone || undefined,
      gender: gender || undefined, dob: dob || undefined, school: school || undefined,
      parentName: parentName || undefined, phoneParent: parentPhone || undefined,
      classEnrollments: selectedClasses,
    };
    const res = editingStudent ? await updateStudentByTeacher(editingStudent.id, payload) : await addStudentByTeacher(payload);
    setLoading(false);
    if (res.success) {
      toast.success(editingStudent ? "Đã cập nhật học sinh!" : "Đã thêm học sinh!");
      setIsStudentModalOpen(false); router.refresh();
    } else {
      toast.error(res.error || "Lỗi lưu học sinh");
    }
  };

  const handleDeleteStudent = async (s: StudentData) => {
    confirm({
      title: "Xóa Học Sinh",
      message: `Xóa dữ liệu của học sinh "${s.fullName}"?`,
      isDestructive: true,
      onConfirm: async () => {
        const res = await deleteStudentByTeacher(s.id);
        if (res.success) {
          toast.success("Đã xóa học sinh!"); router.refresh();
        } else {
          toast.error(res.error || "Không thể xóa học sinh này");
        }
      }
    });
  };

  return (
    <div className="w-full font-sans">
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-3 md:p-4 mb-4 md:mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex bg-slate-100 p-1 rounded-lg w-full lg:w-auto overflow-x-auto hide-scrollbar shrink-0">
            <button
              onClick={() => { setActiveTab("classes"); setSearch(""); setFilterClassId("ALL"); }}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-md font-bold text-sm transition-all whitespace-nowrap ${activeTab === "classes" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              <LayoutGrid size={16} /> Lớp Của Tôi
            </button>
            <button
              onClick={() => { setActiveTab("students"); setSearch(""); setFilterClassId("ALL"); }}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-md font-bold text-sm transition-all whitespace-nowrap ${activeTab === "students" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              <UserSquare2 size={16} /> Học Sinh
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto">
            {activeTab === "students" && (
              <div className="relative w-full sm:w-auto shrink-0">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <select
                  value={filterClassId}
                  onChange={(e) => setFilterClassId(e.target.value)}
                  className="w-full sm:w-44 pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-blue-100 outline-none appearance-none cursor-pointer"
                >
                  <option value="ALL">Tất cả lớp học</option>
                  {initialClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            <div className="relative w-full sm:flex-1 lg:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={`Tìm ${activeTab === "classes" ? "lớp..." : "học sinh..."}`}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 outline-none"
              />
            </div>
            
            <div className="w-full sm:w-auto shrink-0">
              {activeTab === "classes" ? (
                <button onClick={openAddClass} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-1.5 transition-all">
                  <Plus size={16} /> <span>Tạo Lớp</span>
                </button>
              ) : (
                <button onClick={openAddStudent} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-1.5 transition-all">
                  <Plus size={16} /> <span>Thêm HS</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {/* TAB LỚP HỌC */}
        {activeTab === "classes" && (
          <>
            {filteredClasses.length === 0 ? <div className="p-8 text-center text-sm text-slate-500 font-medium">Không tìm thấy lớp học nào.</div> : (
              <>
                <div className="block md:hidden divide-y divide-slate-100">
                  {filteredClasses.map((c) => (
                    <div key={c.id} className="p-3 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-[13px] text-slate-800 truncate mb-1">
                          {c.name}
                          <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold ${c.status === "APPROVED" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : c.status === "PENDING" ? "bg-amber-50 text-amber-600 border border-amber-100" : "bg-rose-50 text-rose-600 border border-rose-100"}`}>
                            {c.status === "APPROVED" ? "Đã duyệt" : c.status === "PENDING" ? "Chờ duyệt" : "Từ chối"}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-slate-500">
                          <span className="flex items-center gap-1"><BookOpen size={12} /> {c.category} ({c.sessionsPerPackage} buổi)</span>
                          <span className="flex items-center gap-1"><CreditCard size={12} /> {Number(c.pricePerSession || 0).toLocaleString('vi-VN')}đ</span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0 flex-col sm:flex-row">
                        <Link href={`/myClass/${c.id}`} className="p-2 text-cyan-600 bg-cyan-50 hover:bg-cyan-100 rounded-lg flex items-center justify-center"><Eye size={16} strokeWidth={2.5} /></Link>
                        {c.createdById === teacherId && (
                          <>
                            <button onClick={() => openEditClass(c)} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center justify-center"><Edit2 size={16} strokeWidth={2.5} /></button>
                            <button onClick={() => handleDeleteClass(c)} className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg flex items-center justify-center"><Trash2 size={16} strokeWidth={2.5} /></button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider font-extrabold text-slate-500">
                        <th className="py-2.5 px-3">Lớp Học</th>
                        <th className="py-2.5 px-3 w-32">Danh mục</th>
                        <th className="py-2.5 px-3 w-32">Học phí</th>
                        <th className="py-2.5 px-3 w-28 text-center">Trạng thái</th>
                        <th className="py-2.5 px-3 w-32 text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredClasses.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2 px-3 font-bold text-[13px] text-slate-800">{c.name}</td>
                          <td className="py-2 px-3 text-[12px] font-medium text-slate-600">{c.category}</td>
                          <td className="py-2 px-3 text-[12px] font-bold text-slate-700">{Number(c.pricePerSession || 0).toLocaleString('vi-VN')}đ</td>
                          <td className="py-2 px-3 text-center">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${c.status === "APPROVED" ? "bg-emerald-50 text-emerald-600" : c.status === "PENDING" ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"}`}>
                              {c.status === "APPROVED" ? "Đã duyệt" : c.status === "PENDING" ? "Chờ duyệt" : "Từ chối"}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center justify-center gap-1.5">
                              <Link href={`/myClass/${c.id}`} className="p-1.5 text-cyan-600 hover:bg-cyan-50 rounded" title="Xem chi tiết"><Eye size={16} /></Link>
                              {c.createdById === teacherId && (
                                <>
                                  <button onClick={() => openEditClass(c)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Sửa"><Edit2 size={16} /></button>
                                  <button onClick={() => handleDeleteClass(c)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded" title="Xóa"><Trash2 size={16} /></button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        {/* TAB HỌC SINH */}
        {activeTab === "students" && (
          <>
            {filteredStudents?.length === 0 ? <div className="p-8 text-center text-sm text-slate-500 font-medium">Không tìm thấy học sinh nào phù hợp.</div> : (
              <>
                <div className="block md:hidden divide-y divide-slate-100">
                  {filteredStudents.map((s) => (
                    <div key={s.id} className="p-3 hover:bg-slate-50/80 transition-colors flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-[14px] text-slate-800 truncate mb-0.5">{s.fullName}</div>
                          <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                            <Phone size={10}/> {s.phone || s.phoneStudent || "Chưa có"} | PH: {s.parentPhone || s.phoneParent || "Chưa có"}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => openEditStudent(s)} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center justify-center"><Edit2 size={14} strokeWidth={2.5} /></button>
                          <button onClick={() => handleDeleteStudent(s)} className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg flex items-center justify-center"><Trash2 size={14} strokeWidth={2.5} /></button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {s.enrolledCourses?.map((ec: any) => {
                          const isZero = ec.remainingSessions <= 0;
                          const isLow = ec.remainingSessions > 0 && ec.remainingSessions <= 2;
                          return (
                            <span key={ec.classId} className={`text-[10px] font-bold px-2 py-1 rounded border ${isZero ? "text-rose-700 bg-rose-50 border-rose-200" : isLow ? "text-amber-700 bg-amber-50 border-amber-200" : "text-blue-700 bg-blue-50 border-blue-200"}`}>
                              {ec.className}: <span className={isZero ? "font-extrabold underline" : ""}>Còn {ec.remainingSessions} buổi</span>
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider font-extrabold text-slate-500">
                        <th className="py-2.5 px-4 w-48">Học Sinh</th>
                        <th className="py-2.5 px-4 w-48">Liên hệ</th>
                        <th className="py-2.5 px-4">Thông tin lớp học & Số buổi</th>
                        <th className="py-2.5 px-4 w-20 text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStudents.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-bold text-[13px] text-slate-800">{s.fullName}</td>
                          <td className="py-3 px-4 text-[12px] font-medium text-slate-600">
                            HS: {s.phone || s.phoneStudent || "-"} <br/>
                            <span className="text-[10px] text-slate-400">PH: {s.parentName} ({s.parentPhone || s.phoneParent || "-"})</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1.5">
                              {s.enrolledCourses?.map((ec: any) => {
                                const isZero = ec.remainingSessions <= 0;
                                const isLow = ec.remainingSessions > 0 && ec.remainingSessions <= 2;
                                return (
                                  <span key={ec.classId} className={`text-[10px] font-bold px-2 py-1 rounded border ${isZero ? "text-rose-700 bg-rose-50 border-rose-200" : isLow ? "text-amber-700 bg-amber-50 border-amber-200" : "text-blue-700 bg-blue-50 border-blue-200"}`}>
                                    {ec.className} <span className="opacity-60">|</span> <span className={isZero ? "font-extrabold underline" : ""}>Còn {ec.remainingSessions} buổi</span>
                                  </span>
                                )
                              })}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-1.5">
                              <button onClick={() => openEditStudent(s)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Sửa"><Edit2 size={16} /></button>
                              <button onClick={() => handleDeleteStudent(s)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded" title="Xóa"><Trash2 size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* MODALS */}
      {isClassModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
              <h2 className="font-bold text-slate-800">{editingClass ? "Sửa Lớp Học" : "Yêu Cầu Tạo Lớp"}</h2>
              <button onClick={() => setIsClassModalOpen(false)} className="p-1 bg-slate-200 rounded-full"><X size={16} /></button>
            </div>
            <form onSubmit={handleSaveClass} className="p-5 space-y-4">
              {editingClass && editingClass.status === "APPROVED" && (
                <div className="p-2.5 bg-amber-50 text-amber-700 text-[11px] font-medium rounded-lg flex gap-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" /> Việc chỉnh sửa sẽ đưa lớp về trạng thái chờ Admin duyệt lại.
                </div>
              )}
              <input required value={className} onChange={e => setClassName(e.target.value)} placeholder="Tên lớp (VD: Toán 10)" className="w-full h-10 px-3 border rounded-lg text-sm" />
              <input required type="number" value={classPrice} onChange={e => setClassPrice(e.target.value ? Number(e.target.value) : "")} placeholder="Học phí một khóa (VD: 500000)" className="w-full h-10 px-3 border rounded-lg text-sm" />
              <input required type="number" value={classSessions} onChange={e => setClassSessions(e.target.value ? Number(e.target.value) : "")} placeholder="Số buổi (VD: 12)" className="w-full h-10 px-3 border rounded-lg text-sm" />
              <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsClassModalOpen(false)} className="px-4 py-2 text-sm font-bold bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">Hủy</button>
                <button type="submit" disabled={loading} className="px-5 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center min-w-[80px]">{loading ? <Loader2 size={16} className="animate-spin" /> : "Lưu"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isStudentModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[95vh]">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
              <h2 className="text-lg font-extrabold text-slate-800">{editingStudent ? "Sửa Học Sinh" : "Thêm Học Sinh Mới"}</h2>
              <button onClick={() => setIsStudentModalOpen(false)} className="p-1.5 bg-slate-200 hover:bg-slate-300 rounded-full text-slate-600 transition-colors"><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveStudent} className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Họ và Tên *</label>
                <input required value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Nhập tên học sinh" className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Số điện thoại</label>
                  <input value={studentPhone} onChange={(e) => setStudentPhone(e.target.value)} placeholder="SĐT học sinh" className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all" />
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
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2"><Calendar size={14} className="text-slate-400" /> Ngày sinh</label>
                  <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all text-slate-700" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2"><School size={14} className="text-slate-400" /> Trường học</label>
                  <input list="danang-schools" value={school} onChange={(e) => setSchool(e.target.value)} placeholder="Chọn hoặc nhập trường..." className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all" />
                  <datalist id="danang-schools">{DA_NANG_SCHOOLS.map(s => <option key={s} value={s} />)}</datalist>
                </div>
              </div>
              <div className="space-y-1.5 pt-2 border-t border-slate-100 mt-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tên Phụ huynh</label>
                <input value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="Tên phụ huynh" className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">SĐT Phụ huynh</label>
                <input value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} placeholder="SĐT phụ huynh" className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all" />
              </div>
              <div className="space-y-1.5 pt-2 border-t border-slate-100 mt-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">Ghi danh vào lớp (Tùy chọn)</label>
                <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl bg-slate-50 p-2 space-y-1">
                  {initialClasses.length === 0 ? <p className="text-xs text-slate-500 p-2 text-center">Bạn chưa có lớp học nào.</p> : initialClasses.map((c) => {
                    const checked = selectedClasses.some((x) => x.classId === c.id);
                    return (
                      <div key={c.id} className={`flex flex-col p-3 rounded-lg transition-colors border ${checked ? "bg-white border-blue-200 shadow-sm" : "border-transparent hover:bg-slate-100"}`}>
                        <label className="flex items-center gap-2.5 cursor-pointer w-full">
                          <input type="checkbox" checked={checked} onChange={(e) => {
                            if (e.target.checked) setSelectedClasses([...selectedClasses, { classId: c.id, feeStatus: "UNPAID" }]);
                            else setSelectedClasses(selectedClasses.filter((x) => x.classId !== c.id));
                          }} className="rounded border-slate-300 text-blue-600 focus:ring-blue-600 w-4 h-4" />
                          <span className={`text-sm font-bold ${checked ? "text-blue-700" : "text-slate-700"}`}>{c.name}</span>
                        </label>
                        {checked && (
                          <div className="mt-3 ml-6 flex items-center gap-2">
                            <select value={selectedFeeForClass(c.id)} onChange={(e) => setSelectedClasses(selectedClasses.map((x) => x.classId === c.id ? { ...x, feeStatus: e.target.value as "PAID" | "UNPAID" } : x))} className={`text-xs font-bold rounded-md px-2 py-1.5 w-full outline-none border cursor-pointer ${selectedFeeForClass(c.id) === "PAID" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
                              <option value="UNPAID">Chưa nộp (Hệ thống cấp 0 buổi)</option>
                              <option value="PAID">Đã nộp (+{c.sessionsPerPackage} buổi học)</option>
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-6 pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsStudentModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-lg transition-colors">Hủy</button>
                <button type="submit" disabled={loading} className="px-5 py-2 min-w-[100px] text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all disabled:opacity-70 flex justify-center items-center">{loading ? <Loader2 size={16} className="animate-spin" /> : "Lưu Học Sinh"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}