"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, X, BookOpen, Tag, DollarSign, CalendarDays, Layers, Loader2 } from "lucide-react";
import { createClass, updateClass, deleteClass, createSubject, updateSubject, deleteSubject, getSubjectDeletionImpact, getClassDeletionImpact } from "@/actions/mutations";
import { ClassData } from "@/actions/queries";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useconfirm"; // <-- Import hook xịn xò
import { useRouter } from "next/navigation";

type Subject = {
  id: string;
  name: string;
  pricePerSession: number;
  sessionsPerPackage: number;
  createdAt: Date;
};

export default function ClassesClient({
  initialClasses,
  subjects,
}: {
  initialClasses: ClassData[];
  subjects: Subject[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"classes" | "subjects">("classes");

  // ====== STATE LỚP HỌC ======
  const [classes, setClasses] = useState<ClassData[]>(initialClasses);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassData | null>(null);
  const [className, setClassName] = useState("");
  const [category, setCategory] = useState("");
  const [subjectId, setSubjectId] = useState("");

  // ====== STATE MÔN HỌC ======
  const [localSubjects, setLocalSubjects] = useState<Subject[]>(subjects);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjectName, setSubjectName] = useState("");
  const [pricePerSession, setPricePerSession] = useState<number>(0);
  const [sessionsPerPackage, setSessionsPerPackage] = useState<number>(12);

  // ====== STATE CHUNG & HOOK ======
  const [loading, setLoading] = useState(false);
  const [isCheckingImpact, setIsCheckingImpact] = useState<string | null>(null);
  const { confirm } = useConfirm(); // <-- Khởi tạo hook

  // ====== HANDLERS LỚP HỌC ======
  const openAddClassModal = () => {
    setEditingClass(null);
    setClassName("");
    setCategory("");
    setSubjectId(localSubjects.length > 0 ? localSubjects[0].id : "");
    setIsClassModalOpen(true);
  };

  const openEditClassModal = (c: ClassData) => {
    setEditingClass(c);
    setClassName(c.name);
    setCategory(c.category);
    setSubjectId(c.subjectId);
    setIsClassModalOpen(true);
  };

  const handleClassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (editingClass) {
      const res = await updateClass(editingClass.id, { name: className, category, subjectId });
      if (res?.success) {
        toast.success("Cập nhật lớp học thành công!");
        const updatedSubject = localSubjects.find(s => s.id === subjectId);
        setClasses(classes.map(c => 
          c.id === editingClass.id 
            ? { ...c, name: className, category, subjectId, subjectName: updatedSubject?.name || c.subjectName } 
            : c
        ));
        setIsClassModalOpen(false);
      } else {
        toast.error(res?.error || "Lỗi cập nhật lớp học");
      }
    } else {
      const res = await createClass({ name: className, category, subjectId });
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

  // ====== HANDLERS MÔN HỌC ======
  const openAddSubjectModal = () => {
    setEditingSubject(null);
    setSubjectName("");
    setPricePerSession(0);
    setSessionsPerPackage(12);
    setIsSubjectModalOpen(true);
  };

  const openEditSubjectModal = (s: Subject) => {
    setEditingSubject(s);
    setSubjectName(s.name);
    setPricePerSession(s.pricePerSession);
    setSessionsPerPackage(s.sessionsPerPackage);
    setIsSubjectModalOpen(true);
  };

  const handleSubjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (editingSubject) {
      const res = await updateSubject(editingSubject.id, { 
        name: subjectName, 
        pricePerSession, 
        sessionsPerPackage 
      });
      if (res?.success) {
        toast.success("Cập nhật môn học thành công!");
        setLocalSubjects(localSubjects.map(s => 
          s.id === editingSubject.id 
            ? { ...s, name: subjectName, pricePerSession, sessionsPerPackage } 
            : s
        ));
        setIsSubjectModalOpen(false);
      } else {
        toast.error(res?.error || "Lỗi cập nhật môn học");
      }
    } else {
      const res = await createSubject({ name: subjectName, pricePerSession, sessionsPerPackage });
      if (res?.success) {
        toast.success("Thêm môn học mới thành công!");
        setIsSubjectModalOpen(false);
        router.refresh();
      } else {
        toast.error(res?.error || "Lỗi tạo môn học");
      }
    }
    setLoading(false);
  };

  // ====== HANDLER XÓA KẾT HỢP GLOBAL CONFIRM ======
  const confirmDelete = async (type: "class" | "subject", id: string, name: string) => {
    setIsCheckingImpact(id); // Bật loading spinner tại nút bấm
    try {
      const res = type === "class" ? await getClassDeletionImpact(id) : await getSubjectDeletionImpact(id);
      
      if (!res.success) {
        toast.error(res.error || "Không thể kiểm tra dữ liệu liên quan.");
        return;
      }

      const impactData = res.impact as any ;
      let totalImpact = 0;
      if (type === "subject") {
        totalImpact = impactData.classCount + impactData.enrollmentCount + impactData.sessionCount;
      } else {
        totalImpact = impactData.classTeacherCount + impactData.enrollmentCount + impactData.sessionCount + impactData.paymentCount;
      }

      // Khởi tạo giao diện cảnh báo để truyền vào Modal
    const impactMessage = (
        <div className="space-y-3">
          <p>Bạn có chắc chắn muốn xóa <strong>{name}</strong> không?</p>
          {totalImpact === 0 ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-[13px] leading-relaxed">
              <strong>✅ Dữ liệu an toàn:</strong> {type === "subject" ? "Môn học" : "Lớp học"} này hiện chưa có bất kỳ dữ liệu ràng buộc nào. Bạn có thể xóa an toàn.
            </div>
          ) : (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-[13px] leading-relaxed">
              <strong>⚠️ CẢNH BÁO NGHIÊM TRỌNG:</strong> Việc xóa sẽ tự động làm mất:
              <ul className="list-disc pl-5 mt-2 space-y-1 mb-2 font-medium">
                {type === "subject" ? (
                  <>
                    {impactData?.classCount > 0 && <li>{impactData.classCount} lớp học</li>}
                    {impactData?.enrollmentCount > 0 && <li>{impactData.enrollmentCount} học sinh ghi danh</li>}
                    {impactData?.sessionCount > 0 && <li>{impactData.sessionCount} lịch dạy</li>}
                  </>
                ) : (
                  <>
                    {impactData?.classTeacherCount > 0 && <li>{impactData.classTeacherCount} giáo viên được phân công</li>}
                    {impactData?.enrollmentCount > 0 && <li>{impactData.enrollmentCount} học sinh ghi danh</li>}
                    {impactData?.sessionCount > 0 && <li>{impactData.sessionCount} lịch dạy</li>}
                    {impactData?.paymentCount > 0 && <li>{impactData.paymentCount} lịch sử thanh toán</li>}
                  </>
                )}
              </ul>
              Hành động này <strong>KHÔNG THỂ hoàn tác!</strong>
            </div>
          )}
        </div>
      );

      // Gọi Global Modal
      confirm({
        title: `Xóa ${type === "class" ? "Lớp Học" : "Môn Học"}`,
        message: impactMessage,
        confirmText: "Vẫn Xóa Dữ Liệu",
        cancelText: "Hủy bỏ",
        isDestructive: true,
        onConfirm: async () => {
          if (type === "class") {
            const deleteRes = await deleteClass(id);
            if (deleteRes?.success) {
              toast.success("Đã xóa lớp học thành công!");
              setClasses(prev => prev.filter(c => c.id !== id));
            } else {
              toast.error(deleteRes?.error || "Lỗi xóa lớp học");
            }
          } else {
            const deleteRes = await deleteSubject(id);
            if (deleteRes?.success) {
              toast.success("Đã xóa môn học thành công!");
              setLocalSubjects(prev => prev.filter(s => s.id !== id));
            } else {
              toast.error(deleteRes?.error || "Không thể xóa môn học đang có lớp hoạt động.");
            }
          }
        }
      });

    } catch (error) {
      toast.error("Lỗi khi kiểm tra dữ liệu ảnh hưởng.");
    } finally {
      setIsCheckingImpact(null); // Tắt loading spinner ở nút bấm
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto pb-8 font-sans">
      
      {/* Header & Tabs */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 md:p-5 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900">
              Cấu Hình Đào Tạo
            </h1>
            <p className="text-sm text-slate-500 font-medium mt-1">
              Quản lý danh mục Môn học và danh sách Lớp học
            </p>
          </div>
          
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-fit border border-slate-200">
            <button
              onClick={() => setActiveTab("classes")}
              className={`px-5 py-2 rounded-lg text-[13px] font-bold transition-all flex items-center gap-2 ${
                activeTab === "classes" 
                  ? "bg-white shadow-sm text-blue-600 border border-slate-200/50" 
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
              }`}
            >
              <Layers size={16} /> Lớp Học
            </button>
            <button
              onClick={() => setActiveTab("subjects")}
              className={`px-5 py-2 rounded-lg text-[13px] font-bold transition-all flex items-center gap-2 ${
                activeTab === "subjects" 
                  ? "bg-white shadow-sm text-blue-600 border border-slate-200/50" 
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
              }`}
            >
              <BookOpen size={16} /> Môn Học
            </button>
          </div>
        </div>

        {/* Nút hành động tương ứng với Tab */}
        <div className="flex justify-end pt-4 border-t border-slate-100">
          {activeTab === "classes" ? (
            <button 
              onClick={openAddClassModal} 
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm flex items-center gap-2 transition-all"
            >
              <Plus size={18} strokeWidth={3} /> Thêm Lớp Mới
            </button>
          ) : (
            <button 
              onClick={openAddSubjectModal} 
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm flex items-center gap-2 transition-all"
            >
              <Plus size={18} strokeWidth={3} /> Thêm Môn Học
            </button>
          )}
        </div>
      </div>

      {/* ================= BẢNG LỚP HỌC ================= */}
      {activeTab === "classes" && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden animate-in fade-in duration-300">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-widest font-extrabold text-slate-500">
                  <th className="py-3 px-4 w-12 text-center">STT</th>
                  <th className="py-3 px-4">Tên Lớp</th>
                  <th className="py-3 px-4 w-40">Danh mục</th>
                  <th className="py-3 px-4 w-48">Môn học</th>
                  <th className="py-3 px-4">Giáo viên phụ trách</th>
                  <th className="py-3 px-4 w-28 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-500 font-medium">
                      Chưa có lớp học nào trong hệ thống.
                    </td>
                  </tr>
                ) : (
                  classes.map((c, index) => (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="py-2.5 px-4 text-center font-bold text-slate-400 text-xs">{index + 1}</td>
                      <td className="py-2.5 px-4"><div className="font-bold text-slate-800 text-sm">{c.name}</div></td>
                      <td className="py-2.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                          <Tag size={12} /> {c.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded-md border border-blue-100 w-fit">
                          <BookOpen size={14} /> {c.subjectName}
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        {c.teachers && c.teachers.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {c.teachers.map((t, i) => (
                              <span key={i} className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200">
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
                          <button onClick={() => openEditClassModal(c)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Sửa">
                            <Edit2 size={16} />
                          </button>
                          <button disabled={isCheckingImpact === c.id} onClick={() => confirmDelete("class", c.id, c.name)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-md transition-colors disabled:opacity-50" title="Xóa">
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
      )}

      {/* ================= BẢNG MÔN HỌC ================= */}
      {activeTab === "subjects" && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden animate-in fade-in duration-300">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-widest font-extrabold text-slate-500">
                  <th className="py-3 px-4 w-12 text-center">STT</th>
                  <th className="py-3 px-4">Tên môn học</th>
                  <th className="py-3 px-4 w-48">Học phí / Buổi</th>
                  <th className="py-3 px-4 w-40">Số buổi / Khóa</th>
                  <th className="py-3 px-4 w-28 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {localSubjects.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-500 font-medium">
                      Chưa có môn học nào trong hệ thống.
                    </td>
                  </tr>
                ) : (
                  localSubjects.map((s, index) => (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="py-3 px-4 text-center font-bold text-slate-400 text-xs">{index + 1}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                          <BookOpen size={16} className="text-slate-400" /> {s.name}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                        {s.pricePerSession.toLocaleString("vi-VN")}đ
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 text-xs font-bold border border-purple-200">
                          <CalendarDays size={14} /> {s.sessionsPerPackage} buổi
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1 transition-opacity">
                          <button onClick={() => openEditSubjectModal(s)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Sửa">
                            <Edit2 size={16} />
                          </button>
                          <button disabled={isCheckingImpact === s.id} onClick={() => confirmDelete("subject", s.id, s.name)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-md transition-colors disabled:opacity-50" title="Xóa">
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
      )}

      {/* ================= MODAL LỚP HỌC ================= */}
      {isClassModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
              <h2 className="text-lg font-extrabold text-slate-800">
                {editingClass ? "Sửa Lớp Học" : "Thêm Lớp Học Mới"}
              </h2>
              <button onClick={() => setIsClassModalOpen(false)} className="p-1.5 bg-slate-200 hover:bg-slate-300 rounded-full text-slate-600 transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleClassSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tên lớp</label>
                <input required value={className} onChange={(e) => setClassName(e.target.value)} placeholder="VD: Toán 9A..." className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Danh mục</label>
                <input required value={category} onChange={(e) => setCategory(e.target.value)} placeholder="VD: Cơ bản, Nâng cao..." className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Thuộc Môn học</label>
                <select required value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all cursor-pointer">
                  <option value="" disabled>-- Chọn môn học --</option>
                  {localSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button type="button" onClick={() => setIsClassModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-lg transition-colors">Hủy</button>
                <button type="submit" disabled={loading} className="px-5 py-2 min-w-[100px] text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all disabled:opacity-70 flex justify-center items-center">
                  {loading ? "Đang lưu..." : "Lưu Lớp Học"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL MÔN HỌC ================= */}
      {isSubjectModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
              <h2 className="text-lg font-extrabold text-slate-800">
                {editingSubject ? "Sửa Môn Học" : "Thêm Môn Học Mới"}
              </h2>
              <button onClick={() => setIsSubjectModalOpen(false)} className="p-1.5 bg-slate-200 hover:bg-slate-300 rounded-full text-slate-600 transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubjectSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tên môn học</label>
                <input required value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="VD: Tiếng Anh, Toán học..." className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Học phí / Buổi (VNĐ)</label>
                <div className="relative">
                  <DollarSign size={16} className="absolute left-3 top-3 text-slate-400" />
                  <input required type="number" min={0} value={pricePerSession} onChange={(e) => setPricePerSession(Number(e.target.value))} className="w-full h-10 pl-9 pr-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Số buổi / Khóa</label>
                <div className="relative">
                  <CalendarDays size={16} className="absolute left-3 top-3 text-slate-400" />
                  <input required type="number" min={1} value={sessionsPerPackage} onChange={(e) => setSessionsPerPackage(Number(e.target.value))} className="w-full h-10 pl-9 pr-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all" />
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button type="button" onClick={() => setIsSubjectModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-lg transition-colors">Hủy</button>
                <button type="submit" disabled={loading} className="px-5 py-2 min-w-[100px] text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all disabled:opacity-70 flex justify-center items-center">
                  {loading ? "Đang lưu..." : "Lưu Môn Học"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}