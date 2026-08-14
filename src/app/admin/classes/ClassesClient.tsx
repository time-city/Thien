"use client";

import { useState } from "react";
import { Eye, Search, ChevronLeft, ChevronRight, Plus, Edit2, Trash2, X, Tag, DollarSign, CalendarDays, Layers, Loader2 } from "lucide-react";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { createClass, updateClass, deleteClass, getClassDeletionImpact } from "@/actions/mutations";
import { ClassData } from "@/actions/queries";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useconfirm"; 
import { useRouter } from "next/navigation";

function formatVnCurrency(amount: number) {
  return Number(amount || 0).toLocaleString("vi-VN");
}

export type TeacherOption = { id: string; fullName: string; role?: string };

export default function ClassesClient({
  initialClasses,
  teachers,
}: {
  initialClasses: ClassData[];
  teachers: TeacherOption[];
}) {
  const router = useRouter();

  // ====== STATE LỚP HỌC ======
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassData | null>(null);
  const [className, setClassName] = useState("");
  const [category, setCategory] = useState("");
  const [pricePerSession, setPricePerSession] = useState<number>(0);
  const [sessionsPerPackage, setSessionsPerPackage] = useState<number>(12);
  const [classTeachers, setClassTeachers] = useState<{ teacherId: string; salaryPerSession: number }[]>([]);

  // ====== STATE CHUNG & HOOK ======
  const [loading, setLoading] = useState(false);
  const [isCheckingImpact, setIsCheckingImpact] = useState<string | null>(null);
  const { confirm } = useConfirm();

  // ====== STATE VIEW MODAL ======
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingClassData, setViewingClassData] = useState<any>(null);
  const [isLoadingView, setIsLoadingView] = useState(false);

  // ====== STATE SEARCH + PAGINATION (Modal) ======
  const [searchStudent, setSearchStudent] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // ====== HANDLERS LỚP HỌC ======
  const openAddClassModal = () => {
    setEditingClass(null);
    setClassName("");
    setCategory("");
    setClassTeachers([]);
    setPricePerSession(0);
    setSessionsPerPackage(12);
    setIsClassModalOpen(true);
  };

  const openEditClassModal = (c: ClassData) => {
    setEditingClass(c);
    setClassName(c.name);
    setCategory(c.category);
    setClassTeachers(c.teachers?.map(t => ({ teacherId: t.teacherId, salaryPerSession: t.salaryPerSession || 0 })) || []);
    setPricePerSession(c.pricePerSession ?? 0);
    setSessionsPerPackage(c.sessionsPerPackage ?? 12);
    setIsClassModalOpen(true);
  };

  const handleViewClass = async (classId: string) => {
    setIsLoadingView(true);
    setIsViewModalOpen(true);
    setSearchStudent("");
    setCurrentPage(1);

    try {
      const res = await fetch(`/api/admin/classes/${classId}/details`, { method: "GET" });
      if (!res.ok) {
        toast.error("Không thể tải dữ liệu lớp học");
        setViewingClassData(null);
        return;
      }
      const data = await res.json();
      setViewingClassData(data);
    } catch {
      toast.error("Lỗi khi tải dữ liệu lớp học");
      setViewingClassData(null);
    } finally {
      setIsLoadingView(false);
    }
  };

  const closeViewModal = () => {
    setIsViewModalOpen(false);
    setViewingClassData(null);
    setSearchStudent("");
    setCurrentPage(1);
  };

  const handleClassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      name: className,
      category,
      pricePerSession,
      sessionsPerPackage,
      teachers: classTeachers.filter(t => t.teacherId), 
    };

    if (editingClass) {
      const res = await updateClass(editingClass.id, payload);
      if (res?.success) {
        toast.success("Cập nhật lớp học thành công!");
        setIsClassModalOpen(false);
        router.refresh(); 
      } else {
        toast.error(res?.error || "Lỗi cập nhật lớp học");
      }
    } else {
      const res = await createClass(payload);
      if (res?.success) {
        toast.success("Thêm lớp học mới thành công!");
        setIsClassModalOpen(false);
        router.refresh(); 
      } else {
        toast.error(res?.error || "Lỗi tạo lớp học");
      }
    }
    setLoading(false);
  };

  // ====== HANDLER XÓA KẾT HỢP GLOBAL CONFIRM ======
  const confirmDelete = async (id: string, name: string) => {
    setIsCheckingImpact(id); 
    try {
      const res = await getClassDeletionImpact(id);
      
      if (!res.success) {
        toast.error(res.error || "Không thể kiểm tra dữ liệu liên quan.");
        return;
      }

      const impactData = res.impact as any ;
      const totalImpact = impactData.classTeacherCount + impactData.enrollmentCount + impactData.sessionCount + impactData.paymentCount;

      const impactMessage = (
        <div className="space-y-3">
          <p>Bạn có chắc chắn muốn xóa <strong>{name}</strong> không?</p>
          {totalImpact === 0 ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-[13px] leading-relaxed">
              <strong>✅ Dữ liệu an toàn:</strong> Lớp học này hiện chưa có bất kỳ dữ liệu ràng buộc nào. Bạn có thể xóa an toàn.
            </div>
          ) : (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-[13px] leading-relaxed">
              <strong>⚠️ CẢNH BÁO NGHIÊM TRỌNG:</strong> Việc xóa sẽ tự động làm mất:
              <ul className="list-disc pl-5 mt-2 space-y-1 mb-2 font-medium">
                {impactData?.classTeacherCount > 0 && <li>{impactData.classTeacherCount} giáo viên được phân công</li>}
                {impactData?.enrollmentCount > 0 && <li>{impactData.enrollmentCount} học sinh ghi danh</li>}
                {impactData?.sessionCount > 0 && <li>{impactData.sessionCount} lịch dạy</li>}
                {impactData?.paymentCount > 0 && <li>{impactData.paymentCount} lịch sử thanh toán</li>}
              </ul>
              Hành động này <strong>KHÔNG THỂ hoàn tác!</strong>
            </div>
          )}
        </div>
      );

      confirm({
        title: "Xóa Lớp Học",
        message: impactMessage,
        confirmText: "Vẫn Xóa Dữ Liệu",
        cancelText: "Hủy bỏ",
        isDestructive: true,
        onConfirm: async () => {
          const deleteRes = await deleteClass(id);
          if (deleteRes?.success) {
            toast.success("Đã xóa lớp học thành công!");
            router.refresh(); 
          } else {
            toast.error(deleteRes?.error || "Lỗi xóa lớp học");
          }
        }
      });

    } catch (error) {
      toast.error("Lỗi khi kiểm tra dữ liệu ảnh hưởng.");
    } finally {
      setIsCheckingImpact(null); 
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto pb-8 font-sans">
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 md:p-5 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900">Cấu Hình Đào Tạo</h1>
            <p className="text-sm text-slate-500 font-medium mt-1">Quản lý danh sách Lớp học</p>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-fit border border-slate-200">
            <span className="px-5 py-2 rounded-lg text-[13px] font-bold transition-all flex items-center gap-2 bg-white shadow-sm text-blue-600 border border-slate-200/50">
              <Layers size={16} /> Lớp Học
            </span>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100">
          <button
            onClick={openAddClassModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm flex items-center gap-2 transition-all w-full sm:w-auto justify-center"
          >
            <Plus size={18} strokeWidth={3} /> Thêm Lớp Mới
          </button>
        </div>
      </div>

      {/* ================= BẢNG LỚP HỌC ================= */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden animate-in fade-in duration-300">
        <div className="overflow-x-auto">
          {/* Bỏ min-w-[800px] để bảng Responsive */}
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-widest font-extrabold text-slate-500">
                <th className="py-3 px-4 w-10 sm:w-12 text-center hidden sm:table-cell">STT</th>
                <th className="py-3 px-4">Lớp Học</th>
                <th className="py-3 px-4 w-32 hidden md:table-cell">Danh mục</th>
                <th className="py-3 px-4 hidden lg:table-cell">Học phí/Tháng</th>
                <th className="py-3 px-4 hidden lg:table-cell">Số buổi/Khóa</th>
                <th className="py-3 px-4 hidden sm:table-cell">Giáo viên</th>
                <th className="py-3 px-4 w-28 sm:w-32 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {initialClasses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500 font-medium">
                    Chưa có lớp học nào trong hệ thống.
                  </td>
                </tr>
              ) : (
                initialClasses.map((c, index) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="py-2.5 px-4 text-center font-bold text-slate-400 text-xs hidden sm:table-cell">{index + 1}</td>
                    <td className="py-2.5 px-4">
                      <div className="font-bold text-slate-800 text-sm">{c.name}</div>
                      
                      {/* Responsive Mobile: Hiển thị thêm thông tin Danh mục và Giáo viên dưới tên lớp */}
                      <div className="flex flex-col gap-1 mt-1.5 sm:hidden">
                        <span className="inline-flex items-center gap-1 w-fit px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          <Tag size={10} /> {c.category}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          GV: <span className="font-semibold text-slate-700">{c.teachers?.[0]?.teacherName || "Chưa phân công"}</span>
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 hidden md:table-cell">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200 whitespace-nowrap">
                        <Tag size={12} /> {c.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 hidden lg:table-cell">
                      <span className="text-sm font-bold text-emerald-700 whitespace-nowrap">
                        {formatVnCurrency(c.pricePerSession ?? 0)}đ
                      </span>
                    </td>
                    <td className="py-2.5 px-4 hidden lg:table-cell">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 text-xs font-bold border border-purple-200 whitespace-nowrap">
                        <CalendarDays size={14} /> {c.sessionsPerPackage ?? 0} buổi
                      </span>
                    </td>
                    <td className="py-2.5 px-4 hidden sm:table-cell">
                      {c.teachers && c.teachers.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {c.teachers.map((t, i) => (
                            <span key={i} className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200 whitespace-nowrap">
                              {t.teacherName}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-slate-400 italic">Chưa phân công</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center justify-center gap-1 transition-opacity">
                        <button
                          onClick={() => handleViewClass(c.id)}
                          className="p-1.5 text-cyan-600 hover:bg-cyan-50 rounded-md transition-colors"
                          title="Xem chi tiết"
                          disabled={isLoadingView}
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => openEditClassModal(c)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="Sửa"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          disabled={isCheckingImpact === c.id}
                          onClick={() => confirmDelete(c.id, c.name)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-md transition-colors disabled:opacity-50"
                          title="Xóa"
                        >
                          {isCheckingImpact === c.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
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

      {/* ================= MODAL VIEW LỚP HỌC ================= */}
      {isViewModalOpen && viewingClassData && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={closeViewModal}>
          <div className="bg-white w-[95%] max-w-5xl max-h-[90vh] rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 p-5 border-b border-slate-100 bg-slate-50">
              <div className="min-w-0">
                <h2 className="text-lg md:text-xl font-extrabold text-slate-800 truncate">
                  {viewingClassData?.name || ""}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
                    <Tag size={12} /> {viewingClassData?.category || ""}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    {viewingClassData?.enrollments?.length || 0} học sinh
                  </span>
                </div>
              </div>

              <button
                onClick={closeViewModal}
                className="p-1.5 bg-slate-200 hover:bg-slate-300 rounded-full text-slate-600 transition-colors shrink-0"
                title="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto flex-1">
              {isLoadingView ? (
                <div className="w-full flex items-center justify-center py-10">
                  <div className="flex items-center gap-2 text-slate-600 font-semibold">
                    <Loader2 size={18} className="animate-spin" /> Đang tải...
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Giáo viên phụ trách</div>
                      <div className="mt-2 font-extrabold text-slate-800">
                        {viewingClassData?.teachers?.length
                          ? viewingClassData.teachers.map((t: any, i: number) => (
                              <div key={i} className="text-sm text-slate-700 font-semibold truncate">
                                {t.teacher?.fullName || ""}
                              </div>
                            ))
                          : "Chưa phân công"}
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Học phí/Tháng</div>
                      <div className="mt-2 font-extrabold text-emerald-700 text-lg">
                        {formatVnCurrency(viewingClassData?.pricePerSession ?? 0)}đ
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Số buổi/Khóa</div>
                      <div className="mt-2 font-extrabold text-purple-700 text-lg">
                        {viewingClassData?.sessionsPerPackage ?? 0} <span className="text-sm font-semibold">buổi</span>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Sĩ số hiện tại</div>
                      <div className="mt-2 font-extrabold text-blue-700 text-lg">
                        {viewingClassData?.enrollments?.length || 0} <span className="text-sm font-semibold">học sinh</span>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                      <input
                        value={searchStudent}
                        onChange={(e) => {
                          setSearchStudent(e.target.value);
                          setCurrentPage(1);
                        }}
                        placeholder="Tìm học sinh theo Họ và tên..."
                        className="w-full h-11 pl-9 pr-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-cyan-100 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {(() => {
                    const enrollments = viewingClassData?.enrollments || [];
                    const keyword = searchStudent.trim().toLowerCase();
                    const filtered = !keyword
                      ? enrollments
                      : enrollments.filter((e: any) => (e.student?.fullName || "").toLowerCase().includes(keyword));

                    const total = filtered.length;
                    const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
                    const page = Math.min(currentPage, totalPages);
                    const start = (page - 1) * itemsPerPage;
                    const end = Math.min(start + itemsPerPage, total);

                    const paged = filtered.slice(start, end);

                    return (
                      <>
                        {/* Responsive Table trong Modal - Đã xóa cột Trạng thái */}
                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] sm:text-[11px] uppercase tracking-widest font-extrabold text-slate-500">
                                <th className="py-3 px-3 sm:px-4 w-10 sm:w-16 text-center hidden sm:table-cell">STT</th>
                                <th className="py-3 px-3 sm:px-4">Học sinh</th>
                                <th className="py-3 px-3 sm:px-4 w-32 hidden md:table-cell">Số điện thoại</th>
                                <th className="py-3 px-3 sm:px-4 w-24 hidden sm:table-cell">Giới tính</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {paged.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500 font-medium text-sm">
                                    Không tìm thấy học sinh nào.
                                  </td>
                                </tr>
                              ) : (
                                paged.map((e: any, idx: number) => {
                                  const student = e.student;
                                  const stt = start + idx + 1;
                                  const gender = student?.gender;
                                  const genderLabel = gender === "MALE" ? "Nam" : gender === "FEMALE" ? "Nữ" : "Khác";

                                  return (
                                    <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                                      <td className="py-2.5 px-3 sm:px-4 text-center font-bold text-slate-400 text-xs hidden sm:table-cell">{stt}</td>
                                      <td className="py-2.5 px-3 sm:px-4">
                                        <div className="font-bold text-slate-800 text-[13px] sm:text-sm whitespace-nowrap">{student?.fullName || "-"}</div>
                                        
                                        {/* Mobile: Gộp SĐT và Giới tính hiển thị bên dưới Tên */}
                                        <div className="flex sm:hidden items-center gap-2 mt-1">
                                          <span className="text-[11px] font-medium text-slate-500">{student?.phoneStudent || "Không có SĐT"}</span>
                                          <span className={`w-fit px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                            gender === "MALE" ? "bg-blue-50 text-blue-700 border border-blue-200" : 
                                            gender === "FEMALE" ? "bg-rose-50 text-rose-700 border border-rose-200" : 
                                            "bg-slate-100 text-slate-600 border border-slate-200"
                                          }`}>
                                            {genderLabel}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="py-2.5 px-3 sm:px-4 hidden md:table-cell">
                                        <span className="text-[13px] sm:text-sm font-semibold text-slate-700 whitespace-nowrap">{student?.phoneStudent || "-"}</span>
                                      </td>
                                      <td className="py-2.5 px-3 sm:px-4 hidden sm:table-cell">
                                        <span
                                          className={
                                            gender === "MALE"
                                              ? "inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-[11px] sm:text-xs font-bold border border-blue-200"
                                              : gender === "FEMALE"
                                              ? "inline-flex items-center px-2 py-1 rounded-md bg-rose-50 text-rose-700 text-[11px] sm:text-xs font-bold border border-rose-200"
                                              : "inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-slate-600 text-[11px] sm:text-xs font-bold border border-slate-200"
                                          }
                                        >
                                          {genderLabel}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>

                        <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-slate-600">
                            Đang xem {total === 0 ? 0 : start + 1} - {end} / {total} học sinh
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                              disabled={page <= 1}
                              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              <ChevronLeft size={18} />
                            </button>
                            <button
                              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                              disabled={page >= totalPages}
                              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              <ChevronRight size={18} />
                            </button>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </>
              )}
            </div>

            <div className="p-4 sm:p-5 border-t border-slate-100 bg-white flex justify-end">
              <button
                onClick={closeViewModal}
                className="px-5 py-2 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors w-full sm:w-auto"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL LỚP HỌC ================= */}
      {isClassModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsClassModalOpen(false)}>
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50 shrink-0">
              <h2 className="text-lg font-extrabold text-slate-800">{editingClass ? "Sửa Lớp Học" : "Thêm Lớp Học Mới"}</h2>
              <button
                onClick={() => setIsClassModalOpen(false)}
                className="p-1.5 bg-slate-200 hover:bg-slate-300 rounded-full text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleClassSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tên lớp</label>
                <input
                  required
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="VD: Toán 9A..."
                  className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Danh mục</label>
                <input
                  required
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="VD: Cơ bản, Nâng cao..."
                  className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Học phí/Tháng</label>
                  <div className="relative">
                    <DollarSign size={16} className="absolute left-3 top-3 text-slate-400" />
                    <CurrencyInput
                      required
                      min={0}
                      value={pricePerSession}
                      onChange={(val) => setPricePerSession(val)}
                      className="w-full h-10 pl-9 pr-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Số buổi</label>
                  <div className="relative">
                    <CalendarDays size={16} className="absolute left-3 top-3 text-slate-400" />
                    <input
                      required
                      type="number"
                      min={1}
                      value={sessionsPerPackage}
                      onChange={(e) => setSessionsPerPackage(Number(e.target.value))}
                      className="w-full h-10 pl-9 pr-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Giáo viên phụ trách</label>
                
                {classTeachers.map((t, idx) => (
                  <div key={idx} className="flex flex-col gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50/50 relative group">
                    <button
                      type="button"
                      onClick={() => {
                        const newTeachers = classTeachers.filter((_, i) => i !== idx);
                        setClassTeachers(newTeachers);
                      }}
                      className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Xóa giáo viên này"
                    >
                      <Trash2 size={16} />
                    </button>
                    
                    <div className="space-y-1.5 pr-8">
                      <select
                        value={t.teacherId}
                        onChange={(e) => {
                          const selectedId = e.target.value;
                          const tRole = teachers.find(x => x.id === selectedId)?.role;
                          const newTeachers = [...classTeachers];
                          newTeachers[idx].teacherId = selectedId;
                          if (tRole === "SUPER_ADMIN") {
                            newTeachers[idx].salaryPerSession = 0;
                          }
                          setClassTeachers(newTeachers);
                        }}
                        className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-white text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all cursor-pointer"
                      >
                        <option value="">--- Chọn giáo viên ---</option>
                        {teachers.map((teach) => (
                          <option key={teach.id} value={teach.id} disabled={classTeachers.some((ct, cIdx) => ct.teacherId === teach.id && cIdx !== idx)}>
                            {teach.fullName}
                          </option>
                        ))}
                      </select>
                    </div>

                    {t.teacherId && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Lương cứng / Ca dạy {teachers.find(x => x.id === t.teacherId)?.role === "SUPER_ADMIN" ? "(Admin miễn lương)" : ""}
                        </label>
                        <div className="relative">
                          <DollarSign size={14} className="absolute left-3 top-3 text-slate-400" />
                          <CurrencyInput
                            required={teachers.find(x => x.id === t.teacherId)?.role === "TEACHER"}
                            disabled={teachers.find(x => x.id === t.teacherId)?.role === "SUPER_ADMIN"}
                            min={0}
                            value={t.salaryPerSession}
                            onChange={(val) => {
                              const newTeachers = [...classTeachers];
                              newTeachers[idx].salaryPerSession = val;
                              setClassTeachers(newTeachers);
                            }}
                            className="w-full h-10 pl-9 pr-3 border border-slate-200 rounded-xl bg-white text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                
                <button
                  type="button"
                  onClick={() => setClassTeachers([...classTeachers, { teacherId: "", salaryPerSession: 0 }])}
                  className="w-full py-2.5 border-2 border-dashed border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <Plus size={16} strokeWidth={3} /> Thêm Giáo Viên
                </button>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsClassModalOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-lg transition-colors w-full sm:w-auto"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 min-w-[100px] text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all disabled:opacity-70 flex justify-center items-center w-full sm:w-auto"
                >
                  {loading ? "Đang lưu..." : "Lưu Lớp Học"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}