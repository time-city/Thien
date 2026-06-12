import TeacherSettingsPage from "./TeacherSettingsPage"; // (Sửa lại đường dẫn import cho đúng thư mục của ông)
import { getTeacherSettingsInfo } from "@/actions/queries"; // (Sửa lại đường dẫn nếu cần)
import { auth } from "@/auth";

export default async function SettingsPage() {
  const session = await auth();
  
  // 1. Kiểm tra đăng nhập
  if (!session?.user?.id) {
    return <div className="p-8 text-center text-slate-500">Vui lòng đăng nhập.</div>;
  }

  // 2. Gọi hàm query lấy thông tin giáo viên và lịch sử
  const data = await getTeacherSettingsInfo(session.user.id);

  // 3. Nếu không tìm thấy trong DB thì báo lỗi
  if (!data?.teacherInfo) {
    return <div className="p-8 text-center text-rose-500">Không tìm thấy dữ liệu giáo viên trong hệ thống!</div>;
  }

  // 4. TRUYỀN ĐÚNG PROPS VÀO COMPONENT (Cái này quan trọng nhất)
  return (
    <TeacherSettingsPage 
      teacherInfo={data.teacherInfo} 
      teachingHistory={data.teachingHistory} 
      isAdmin={session.user?.role === "SUPER_ADMIN" || session.user?.role === "ADMIN"}
    />
  );
}