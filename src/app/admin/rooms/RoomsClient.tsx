"use client";

import { useMemo, useState, useEffect } from "react";
import { Plus, Edit2, Trash2, X, Loader2, Building2, CheckCircle2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/hooks/useconfirm";
import { createRoom, updateRoom, deleteRoom, getRoomDeletionImpact } from "@/actions/mutations";

type RoomItem = {
  id: string;
  name: string;
  capacity: number | null;
  isActive: boolean;
  sessionCount: number;
};

type RoomFormState = {
  name: string;
  capacity: string;
  isActive: boolean;
};

export default function RoomsClient({ initialRooms }: { initialRooms: RoomItem[] }) {
  const router = useRouter();
  const { confirm } = useConfirm();

  const [rooms, setRooms] = useState<RoomItem[]>(initialRooms);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomItem | null>(null);
  const [form, setForm] = useState<RoomFormState>({ name: "", capacity: "", isActive: true });
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ĐỒNG BỘ STATE: Tự động cập nhật giao diện khi router.refresh() kéo dữ liệu mới về
  useEffect(() => {
    setRooms(initialRooms);
  }, [initialRooms]);

  const activeCount = useMemo(() => rooms.filter((room) => room.isActive).length, [rooms]);

  const openCreate = () => {
    setEditingRoom(null);
    setForm({ name: "", capacity: "", isActive: true });
    setIsModalOpen(true);
  };

  const openEdit = (room: RoomItem) => {
    setEditingRoom(room);
    setForm({
      name: room.name,
      capacity: room.capacity === null ? "" : String(room.capacity),
      isActive: room.isActive,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRoom(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      name: form.name,
      capacity: form.capacity.trim() === "" ? undefined : Number(form.capacity),
      isActive: form.isActive,
    };

    try {
      if (editingRoom) {
        const res = await updateRoom(editingRoom.id, payload);
        if (!res.success) {
          toast.error(res.error || "Lỗi cập nhật phòng học");
          return;
        }
        toast.success("Cập nhật phòng học thành công");
      } else {
        const res = await createRoom({ name: form.name, capacity: payload.capacity });
        if (!res.success) {
          toast.error(res.error || "Lỗi tạo phòng học");
          return;
        }
        toast.success("Tạo phòng học thành công");
      }

      // Refresh lại server data, useEffect ở trên sẽ bắt được và update UI
      router.refresh();
      closeModal();
    } catch {
      toast.error("Lỗi thao tác phòng học");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (room: RoomItem) => {
    const runDeleteFlow = async () => {
      setDeletingId(room.id);
      try {
        const impactRes = await getRoomDeletionImpact(room.id);
        if (!impactRes.success) {
          toast.error(impactRes.error || "Không thể kiểm tra dữ liệu phòng học");
          return;
        }

        const classSessionCount = impactRes.impact?.classSessionCount ?? 0;

        confirm({
          title: "Xác nhận xóa phòng học",
          message: (
            <div className="space-y-3">
              <p>Bạn có chắc chắn muốn xóa <strong>{room.name}</strong> không?</p>
              <div className={`p-3 rounded-lg text-[13px] leading-relaxed border ${classSessionCount > 0 ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
                {classSessionCount > 0
                  ? `CẢNH BÁO: Phòng này đang có lịch học. Xóa sẽ ảnh hưởng ${classSessionCount} ca học.`
                  : "Dữ liệu an toàn: Phòng này chưa có lịch học. Bạn có thể xóa."}
              </div>
            </div>
          ),
          confirmText: "Vẫn xóa",
          cancelText: "Hủy bỏ",
          isDestructive: true,
          onConfirm: async () => {
            const res = await deleteRoom(room.id);
            if (res.success) {
              toast.success("Đã xóa phòng học");
              router.refresh(); // Cập nhật lại UI sau khi xoá thông qua useEffect
            } else {
              toast.error(res.error || "Lỗi xóa phòng học");
            }
          },
        });
      } finally {
        setDeletingId(null);
      }
    };

    void runDeleteFlow();
  };

  return (
    <div className="w-full max-w-7xl mx-auto pb-8 font-sans">
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 md:p-5 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900">Quản lý Phòng học</h1>
            <p className="text-sm text-slate-500 font-medium mt-1">Danh sách phòng, sức chứa và trạng thái sử dụng</p>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-fit border border-slate-200">
            <span className="px-5 py-2 rounded-lg text-[13px] font-bold transition-all flex items-center gap-2 bg-white shadow-sm text-blue-600 border border-slate-200/50">
              <Building2 size={16} /> Phòng Học
            </span>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100">
          <button
            onClick={openCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm flex items-center gap-2 transition-all w-full sm:w-auto justify-center"
          >
            <Plus size={18} strokeWidth={3} /> Thêm Phòng Mới
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-widest font-extrabold text-slate-500">
                <th className="py-3 px-4">Tên phòng</th>
                <th className="py-3 px-4 hidden sm:table-cell">Sức chứa</th>
                <th className="py-3 px-4 hidden md:table-cell">Trạng thái</th>
                <th className="py-3 px-4 hidden lg:table-cell">Ca đang dùng</th>
                <th className="py-3 px-4 w-28 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rooms.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500 font-medium">
                    Chưa có phòng học nào trong hệ thống.
                  </td>
                </tr>
              ) : (
                rooms.map((room) => (
                  <tr key={room.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800 text-sm">{room.name}</div>
                      <div className="text-xs text-slate-500 mt-1 lg:hidden">
                        {room.sessionCount} ca học đang dùng
                      </div>
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                        {room.capacity ?? "-"} chỗ
                      </span>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border ${room.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                        {room.isActive ? <CheckCircle2 size={12} /> : <Wrench size={12} />}
                        {room.isActive ? "Hoạt động" : "Bảo trì"}
                      </span>
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      <span className="text-sm font-bold text-slate-700">{room.sessionCount}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEdit(room)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="Sửa"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          disabled={deletingId === room.id}
                          onClick={() => handleDelete(room)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-md transition-colors disabled:opacity-50"
                          title="Xóa"
                        >
                          {deletingId === room.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
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

      {isModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="bg-white w-[95%] max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="flex items-start justify-between gap-4 p-5 border-b border-slate-100 bg-slate-50">
              <div>
                <h2 className="text-lg font-extrabold text-slate-800">
                  {editingRoom ? "Sửa Phòng Học" : "Thêm Phòng Học"}
                </h2>
                <p className="text-sm text-slate-500 mt-1">Nhập thông tin phòng học</p>
              </div>
              <button
                onClick={closeModal}
                className="p-1.5 bg-slate-200 hover:bg-slate-300 rounded-full text-slate-600 transition-colors shrink-0"
                title="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Tên phòng</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Ví dụ: Phòng 1"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Sức chứa</label>
                <input
                  type="number"
                  min="0"
                  value={form.capacity}
                  onChange={(e) => setForm((prev) => ({ ...prev, capacity: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Ví dụ: 20"
                />
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-semibold text-slate-700">Hoạt động</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm disabled:opacity-70 flex items-center gap-2"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                  {editingRoom ? "Cập nhật" : "Tạo phòng"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="mt-4 text-sm text-slate-500">
        Tổng phòng: <span className="font-bold text-slate-700">{rooms.length}</span> • Hoạt động: <span className="font-bold text-slate-700">{activeCount}</span>
      </div>
    </div>
  );
}