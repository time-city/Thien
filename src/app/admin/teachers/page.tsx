import { getTeachers } from "@/actions/queries";
import TeachersClient from "./TeachersClient";

export default async function TeachersPage() {
  // Lấy thẳng giáo viên từ DB, khỏi cần .filter() thủ công nữa
  const teachers = await getTeachers();

  return <TeachersClient initialTeachers={teachers} />;
}