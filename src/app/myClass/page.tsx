import { auth } from "@/auth";
import { getAllClasses, getStudentsDetailed } from "@/actions/queries"; // SỬA: Lấy từ actions/queries
import MyClassesClient from "./MyClassesClient";

export default async function MyClassPage() {
  const session = await auth();
  if (!session?.user) {
    return <div className="p-8 text-center text-slate-500 font-medium">Vui lòng đăng nhập</div>;
  }

  const userId = session.user.id;
  const userRole = session.user.role;

  if (userRole !== "TEACHER" && userRole !== "SUPER_ADMIN") {
    return <div className="p-8 text-center text-slate-500 font-medium">Không có quyền truy cập.</div>;
  }

  // 1. Kéo toàn bộ dữ liệu Lớp và Học sinh từ DB
  const [classes, students] = await Promise.all([
    getAllClasses(),
    getStudentsDetailed(),
  ]);

  // 2. Lọc danh sách LỚP: Chỉ lấy lớp do Giáo viên này tạo HOẶC được phân công dạy
  const myClasses = userRole === "TEACHER"
    ? classes.filter((c) => c.createdById === userId || c.teachers.some((t) => t.teacherId === userId))
    : classes;

  // 3. Lọc danh sách HỌC SINH: Chỉ lấy học sinh có ghi danh vào các lớp ở trên
  const myClassIds = new Set(myClasses.map((c) => c.id));
  const myStudents = userRole === "TEACHER"
    ? students.filter((student) => student.enrolledCourses.some((course) => myClassIds.has(course.classId)))
    : students;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      {/* SỬA: Đã truyền đủ 3 props xuống Client Component */}
      <MyClassesClient 
        initialClasses={myClasses} 
        initialStudents={myStudents}
        teacherId={userId}
      />
    </div>
  );
}