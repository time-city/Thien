// src/app/admin/classes/page.tsx
import { getAllClasses, getAllAvailableTeachers } from "@/actions/queries";

import ClassesClient from "./ClassesClient";

export default async function ClassesPage() {
  // Gọi đồng thời cả 3 hàm lấy dữ liệu từ DB
  const [initialClasses, availableTeachers] = await Promise.all([
    getAllClasses(),
    getAllAvailableTeachers() // Gọi hàm mới lấy cả Admin + GV
  ]);

  return (
    <ClassesClient initialClasses={initialClasses} teachers={availableTeachers} />
  );
}

