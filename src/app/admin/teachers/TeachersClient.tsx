"use client";

import { useMemo, useState, useOptimistic, startTransition } from "react";
import {
  Loader2,
  Pencil,
  Plus,
  Trash2,
  User as UserIcon,
  X,
  Ban,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { useConfirm } from "@/hooks/useconfirm"; // Đã sửa tên file chuẩn
import {
  createTeacher,
  updateTeacher,
  deleteTeacher,
  banTeacher,
  getTeacherDeletionImpact,
  getTeacherBanImpact,
} from "@/actions/mutations";

import { TeacherData as BaseTeacherData } from "@/actions/queries";
export type TeacherData = BaseTeacherData & { pending?: boolean };

function formatRole(role: string) {
  if (role === "SUPER_ADMIN") return "Super Admin";
  if (role === "TEACHER") return "Giáo viên";
  return role;
}

export default function TeachersClient({
  initialTeachers,
}: {
  initialTeachers: BaseTeacherData[];
}) {
  const router = useRouter();
  const { confirm } = useConfirm();

  const [search, setSearch] = useState("");
  const [isCheckingImpact, setIsCheckingImpact] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherData | null>(null);

  // Optimistic UI State
  const [optimisticTeachers, addOptimisticTeacher] = useOptimistic(
    initialTeachers as TeacherData[],
    (state, action: { type: "ADD" | "UPDATE" | "DELETE" | "BAN"; payload: any }) => {
      switch (action.type) {
        case "ADD":
          return [action.payload, ...state];
        case "UPDATE":
          return state.map((t) => (t.id === action.payload.id ? { ...t, ...action.payload } : t));
        case "DELETE":
          return state.filter((t) => t.id !== action.payload.id);
        case "BAN":
          return state.map((t) => (t.id === action.payload.id ? { ...t, isActive: !t.isActive } : t));
        default:
          return state;
      }
    }
  );

  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const [isActive, setIsActive] = useState(true);
  const [password, setPassword] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return optimisticTeachers; 
    return optimisticTeachers.filter((t) => { 
      return (
        t.username.toLowerCase().includes(q) ||
        t.fullName.toLowerCase().includes(q) ||
        formatRole(t.role).toLowerCase().includes(q)
      );
    });
  }, [search, optimisticTeachers]); 

  const openAddModal = () => {
    setEditingTeacher(null);
    setUsername("");
    setFullName("");
    setPhone("");
    setIsActive(true);
    setPassword("");
    setIsModalOpen(true);
  };

  const openEditModal = (t: TeacherData) => {
    setEditingTeacher(t);
    setUsername(t.username);
    setFullName(t.fullName);
    setPhone(t.phone || "");

    setIsActive(t.isActive);
    setPassword("");
    setIsModalOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !username.trim()) {
      toast.error("Tên đăng nhập và Họ tên là bắt buộc");
      return;
    }

    if (!phone.trim()) {
      toast.error("Số điện thoại là bắt buộc");
      return;
    }

    setLoading(true);
    if (editingTeacher) {
      setIsModalOpen(false);
      startTransition(async () => {
        addOptimisticTeacher({ type: "UPDATE", payload: { ...editingTeacher, fullName, phone: phone.trim() || null, isActive, pending: true } });
        const res = await updateTeacher(editingTeacher.id, {
          fullName,
          phone: phone.trim() || undefined,
          isActive,
        });

        if (res?.success) {
          toast.success("Cập nhật giáo viên thành công");
          router.refresh(); 
        } else {
          toast.error(res?.error || "Lỗi cập nhật giáo viên");
        }
        setLoading(false);
      });
    } else {
      if (!password.trim()) {
        toast.error("Mật khẩu là bắt buộc khi tạo giáo viên");
        setLoading(false);
        return;
      }
      if (!phone.trim()) {
        toast.error("Số điện thoại là bắt buộc");
        setLoading(false);
        return;
      }
      setIsModalOpen(false);
      startTransition(async () => {
        const tempId = `temp-${Date.now()}`;
        const tempTeacher: TeacherData = {
          id: tempId,
          username,
          fullName,
          phone: phone.trim() || null,
          isActive,
          role: "TEACHER",
          salaryBalance: 0,
          pending: true
        };
        addOptimisticTeacher({ type: "ADD", payload: tempTeacher });
        
        const res = await createTeacher({
          username,
          password,
          fullName,
          phone: phone.trim() || undefined,
          isActive,
        });

        if (res?.success) {
          toast.success("Tạo giáo viên thành công");
          router.refresh();
        } else {
          toast.error(res?.error || "Lỗi tạo giáo viên");
        }
        setLoading(false);
      });
    }
  };

  const confirmBan = async (teacherId: string) => {
    setIsCheckingImpact(teacherId);
    try {
      const res = await getTeacherBanImpact(teacherId);
      if (!res.success) {
        toast.error(res.error || "Không thể kiểm tra dữ liệu liên quan");
        return;
      }

      const impact = (res.impact as {
        activeFutureSessionsCount: number;
        roomRentalLogsCount: number;
        classSessionsCount: number;
        salaryPaymentsCount: number;
        classTeacherLinksCount: number;
      }) ?? {
        activeFutureSessionsCount: 0,
        roomRentalLogsCount: 0,
        classSessionsCount: 0,
        salaryPaymentsCount: 0,
        classTeacherLinksCount: 0,
      };

      confirm({
        title: "BẠN CÓ CHẮC CHẮN BAN GIÁO VIÊN KHÔNG?",
        message: (
          <div className="space-y-3">
            <p>
              Bạn sắp <strong>ban</strong> giáo viên này (chỉ tắt tài khoản, không xóa dữ liệu).
            </p>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-[13px] leading-relaxed">
              ⚠️ Khi ban:
              <ul className="list-disc pl-5 mt-2 space-y-1 font-medium">
                {(impact.activeFutureSessionsCount || 0) > 0 && (
                  <li>
                    {impact.activeFutureSessionsCount} lịch dạy trong tương lai sẽ không thể thực hiện bởi giáo viên.
                  </li>
                )}
                {(impact.roomRentalLogsCount || 0) > 0 && (
                  <li>{impact.roomRentalLogsCount} bản ghi thuê phòng vẫn được giữ nguyên.</li>
                )}
              </ul>
              Không mất dữ liệu lịch sử.
            </div>
          </div>
        ),
        confirmText: "Vẫn Ban Tài Khoản",
        cancelText: "Hủy bỏ",
        isDestructive: true,
        onConfirm: () => {
          const t = optimisticTeachers.find((x) => x.id === teacherId); 
          startTransition(async () => {
            addOptimisticTeacher({ type: "BAN", payload: { id: teacherId } });
            const res2 = await banTeacher(teacherId);
            if (res2?.success) {
              toast.success(`Đã ban giáo viên: ${t?.fullName || "(không rõ)"}`);
              router.refresh();
            } else {
              toast.error(res2?.error || "Lỗi ban giáo viên");
            }
          });
        },
      });
    } finally {
      setIsCheckingImpact(null);
    }
  };

  const confirmDelete = async (teacherId: string) => {
    setIsCheckingImpact(teacherId);
    try {
      const res = await getTeacherDeletionImpact(teacherId);
      if (!res.success) {
        toast.error(res.error || "Không thể kiểm tra dữ liệu liên quan");
        return;
      }

      const impact = (res.impact ?? {}) as {
        classSessionsCount?: number;
        roomRentalLogsCount?: number;
        salaryPaymentsCount?: number;
        classTeacherLinksCount?: number;
      };

      const total =
        (impact.classSessionsCount || 0) +
        (impact.roomRentalLogsCount || 0) +
        (impact.salaryPaymentsCount || 0) +
        (impact.classTeacherLinksCount || 0);

      confirm({
        title: "XÓA GIÁO VIÊN?",
        message: (
          <div className="space-y-3">
            <p>
              Bạn sắp <strong>XÓA HOÀN TOÀN</strong> tài khoản giáo viên này khỏi hệ thống.
            </p>
            {total === 0 ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-[13px] leading-relaxed">
                <strong>✅ Dữ liệu an toàn:</strong> giáo viên này không còn ràng buộc dữ liệu nào.
              </div>
            ) : (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-[13px] leading-relaxed">
                <strong>⚠️ CẢNH BÁO NGHIÊM TRỌNG:</strong> Việc xóa sẽ làm mất:
                <ul className="list-disc pl-5 mt-2 space-y-1 mb-2 font-medium">
                  {(impact.classSessionsCount || 0) > 0 && (
                    <li>{impact.classSessionsCount} lịch dạy</li>
                  )}
                  {(impact.roomRentalLogsCount || 0) > 0 && (
                    <li>{impact.roomRentalLogsCount} bản ghi thuê phòng</li>
                  )}
                  {(impact.salaryPaymentsCount || 0) > 0 && (
                    <li>{impact.salaryPaymentsCount} lịch sử chi trả lương</li>
                  )}
                  {(impact.classTeacherLinksCount || 0) > 0 && (
                    <li>{impact.classTeacherLinksCount} quan hệ lớp–giáo viên</li>
                  )}
                </ul>
                Hành động này <strong>KHÔNG THỂ hoàn tác!</strong>
              </div>
            )}
          </div>
        ),
        confirmText: "Vẫn Xóa Dữ Liệu",
        cancelText: "Hủy bỏ",
        isDestructive: true,
        onConfirm: () => {
          const t = optimisticTeachers.find((x) => x.id === teacherId); 
          startTransition(async () => {
            addOptimisticTeacher({ type: "DELETE", payload: { id: teacherId } });
            const res2 = await deleteTeacher(teacherId);
            if (res2?.success) {
              toast.success(`Đã xóa giáo viên: ${t?.fullName || "(không rõ)"}`);
              router.refresh();
            } else {
              toast.error(res2?.error || "Lỗi xóa giáo viên");
            }
          });
        },
      });
    } finally {
      setIsCheckingImpact(null);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto pb-8 font-sans">
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 md:p-5 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900">
              Quản Lý Giáo Viên
            </h1>
            <p className="text-sm text-slate-500 font-medium mt-1">
              Thêm/sửa, ban hoặc xóa giáo viên với cảnh báo đầy đủ.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <label className="relative flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 h-10 w-full sm:w-auto">
              <Search size={16} className="text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên hoặc username..."
                className="w-full sm:w-[220px] outline-none bg-transparent text-sm font-semibold placeholder:text-slate-400"
              />
            </label>

            <button
              onClick={openAddModal}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm flex items-center gap-2 transition-all w-full sm:w-auto justify-center"
            >
              <Plus size={18} strokeWidth={3} /> Thêm Giáo Viên
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-4">
        <div className="overflow-x-auto">
          {/* Bỏ min-w-[900px] để bảng co lại trên Mobile */}
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-widest font-extrabold text-slate-500">
                <th className="py-3 px-4 w-10 sm:w-14 text-center">#</th>
                <th className="py-3 px-4">Họ và Tên</th>
                {/* Ẩn trên Mobile, hiện từ PC trở lên */}
                <th className="py-3 px-4 hidden md:table-cell w-40 lg:w-52">Username</th>
                {/* Ẩn trên Mobile, hiện từ Tablet trở lên */}
                <th className="py-3 px-4 hidden sm:table-cell w-32 lg:w-40">Vai trò</th>
                <th className="py-3 px-4 w-28 sm:w-32 text-center">Trạng thái</th>
                <th className="py-3 px-4 w-24 sm:w-28 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500 font-medium">
                    Không tìm thấy giáo viên.
                  </td>
                </tr>
              ) : (
                filtered.map((t, idx) => (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="py-3 px-4 text-center font-bold text-slate-400 text-xs">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4">
                      <div className={`font-bold text-sm whitespace-nowrap flex items-center gap-2 ${t.pending ? "text-slate-400" : "text-slate-800"}`}>
                        {t.fullName}
                        {t.pending && <Loader2 size={12} className="animate-spin text-blue-500" />}
                      </div>
                      {/* Trên Mobile, hiển thị luôn Username ở dưới tên cho gọn */}
                      <div className={`text-[11px] md:hidden mt-0.5 font-medium tracking-wide ${t.pending ? "text-slate-300" : "text-slate-500"}`}>
                        @{t.username}
                      </div>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <span className="text-sm font-semibold text-slate-700 block">@{t.username}</span>
                      {t.phone && <span className="text-xs text-slate-500 block mt-0.5">{t.phone}</span>}
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell">
                      <span className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold">
                        {formatRole(t.role)}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center justify-center px-2 py-1 rounded-md text-[10px] sm:text-xs font-bold border whitespace-nowrap ${
                          t.isActive
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}
                      >
                        {t.isActive ? "Hoạt động" : "Bị ban"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1 sm:gap-1.5 transition-opacity">
                        <button
                          onClick={() => openEditModal(t)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50"
                          title="Sửa"
                          disabled={loading || t.pending}
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          onClick={() => confirmBan(t.id)}
                          disabled={isCheckingImpact === t.id || t.pending}
                          className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-md transition-colors disabled:opacity-50"
                          title={t.isActive ? "Ban tài khoản" : "Mở ban tài khoản"}
                        >
                          <Ban size={16} className={!t.isActive ? "text-slate-400" : ""} />
                        </button>

                        <button
                          onClick={() => confirmDelete(t.id)}
                          disabled={isCheckingImpact === t.id || t.pending}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-md transition-colors disabled:opacity-50"
                          title="Xóa"
                        >
                          {isCheckingImpact === t.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Trash2 size={16} />
                          )}
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

      {/* Modal Thêm/Sửa */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
              <h2 className="text-lg font-extrabold text-slate-800">
                {editingTeacher ? "Sửa Giáo Viên" : "Thêm Giáo Viên"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 bg-slate-200 hover:bg-slate-300 rounded-full text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submit} className="p-6 space-y-4">
              {!editingTeacher && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Mật khẩu (bắt buộc)
                  </label>
                  <input
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    placeholder="Nhập mật khẩu"
                    className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Username
                  </label>
                  <input
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="VD: gv.thien"
                    disabled={!!editingTeacher}
                    className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all disabled:opacity-70"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Trạng thái
                  </label>
                  <select
                    value={isActive ? "active" : "inactive"}
                    onChange={(e) => setIsActive(e.target.value === "active")}
                    className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all cursor-pointer"
                    disabled={!editingTeacher}
                    title={editingTeacher ? "" : "Mặc định hoạt động"}
                  >
                    <option value="active">Hoạt động</option>
                    <option value="inactive">Bị ban</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Họ và Tên
                </label>
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nhập họ và tên"
                  className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Số điện thoại (Zalo) <span className="text-rose-500">*</span>
                </label>
                <input
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="Nhập số điện thoại"
                  className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-lg transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 min-w-[130px] text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all disabled:opacity-70 flex justify-center items-center"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin mr-2" /> Đang xử lý...
                    </>
                  ) : (
                    <> {editingTeacher ? "Lưu Thay Đổi" : "Tạo Giáo Viên"} </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}