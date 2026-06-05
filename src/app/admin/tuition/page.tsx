import { getTuitionData } from "@/lib/queries"; // (Hoặc import từ "@/actions/queries" tùy cấu trúc thư mục của ông)
import TuitionClient from "./TuitionClient"; // (Hoặc "@/app/admin/tuition/TuitionClient")
import { getTeachersForFinance } from "@/actions/queries";

export const dynamic = 'force-dynamic';

export default async function TuitionPage() {
  // Đổi initialRentalLogs thành initialTeachers cho đúng với dữ liệu trả về
  const [initialStudents, initialTeachers] = await Promise.all([
    getTuitionData(),
    getTeachersForFinance(),
  ]);

  return (
    <TuitionClient
      initialStudents={initialStudents}
      initialTeachers={initialTeachers} // Truyền đúng biến vừa lấy được ở trên vào đây
    />
  );
}