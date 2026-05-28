import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config"; 

const connectionString = process.env.DATABASE_URL as string;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("⏳ Bắt đầu nạp dữ liệu mẫu (Phiên bản Full Schema)...");

  // -------------------------------------------------------------
  // 0. DỌN DẸP DỮ LIỆU CŨ (Để chạy seed nhiều lần không bị rác)
  // -------------------------------------------------------------
  console.log("🧹 Đang dọn dẹp dữ liệu Lớp học & Học sinh cũ...");
  await prisma.enrollment.deleteMany();
  await prisma.classTeacher.deleteMany();
  await prisma.classSession.deleteMany();
  await prisma.student.deleteMany();
  await prisma.class.deleteMany();
  await prisma.subject.deleteMany();
  // KHÔNG xóa User để tránh mất tài khoản nếu ông đã đổi pass thật

  // -------------------------------------------------------------
  // 1. TẠO TÀI KHOẢN (USERS)
  // -------------------------------------------------------------
  console.log("👤 Đang tạo Users (Admin & Giáo viên)...");
  const adminPassword = await bcrypt.hash("admin123", 10);
  const teacherPassword = await bcrypt.hash("123456", 10);

  // Super Admin (Sẽ kiêm luôn việc dạy 1 lớp)
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: { fullName: "Hoàn Thiện" }, 
    create: {
      username: "admin",
      passwordHash: adminPassword,
      fullName: "Hoàn Thiện",
      role: "SUPER_ADMIN",
      isActive: true,
      roomFeePerSession: 0, 
    },
  });

  // 3 Giáo viên
  const teacherData = [
    { username: "gv_toan", fullName: "Thầy Nguyễn Văn Toán", fee: 50000 },
    { username: "gv_ly", fullName: "Cô Trần Thị Lý", fee: 60000 },
    { username: "gv_hoa", fullName: "Thầy Lê Hóa Học", fee: 50000 },
  ];

  const teachers = [];
  for (const t of teacherData) {
    const teacher = await prisma.user.upsert({
      where: { username: t.username },
      update: { salaryBalance: 5000000 }, // Bơm 5 củ test thanh toán
      create: {
        username: t.username,
        passwordHash: teacherPassword,
        fullName: t.fullName,
        role: "TEACHER",
        isActive: true,
        roomFeePerSession: t.fee,
        salaryBalance: 5000000, 
      },
    });
    teachers.push(teacher);
  }

  // -------------------------------------------------------------
  // 2. TẠO MÔN HỌC (SUBJECTS)
  // -------------------------------------------------------------
  console.log("📚 Đang tạo Môn học...");
  const subToan = await prisma.subject.create({ data: { name: "Toán Học", pricePerSession: 150000, sessionsPerPackage: 12 }});
  const subLy = await prisma.subject.create({ data: { name: "Vật Lý", pricePerSession: 150000, sessionsPerPackage: 12 }});
  const subHoa = await prisma.subject.create({ data: { name: "Hóa Học", pricePerSession: 150000, sessionsPerPackage: 12 }});
  const subKynang = await prisma.subject.create({ data: { name: "Kỹ năng Lập trình", pricePerSession: 200000, sessionsPerPackage: 8 }});

  // -------------------------------------------------------------
  // 3. TẠO LỚP HỌC (CLASSES) & PHÂN CÔNG GIÁO VIÊN (CLASS_TEACHERS)
  // -------------------------------------------------------------
  console.log("🏫 Đang tạo Lớp học & Phân công giáo viên...");
  
  // Lớp của Thầy Toán
  const classToan = await prisma.class.create({ data: { subjectId: subToan.id, name: "Toán 12 Cấp tốc", category: "Lớp 12" }});
  await prisma.classTeacher.create({ data: { classId: classToan.id, teacherId: teachers[0].id, subModule: "Giải tích" }});

  // Lớp của Cô Lý
  const classLy = await prisma.class.create({ data: { subjectId: subLy.id, name: "Lý 11 Nâng cao", category: "Lớp 11" }});
  await prisma.classTeacher.create({ data: { classId: classLy.id, teacherId: teachers[1].id, subModule: "Động lực học" }});

  // Lớp của Thầy Hóa
  const classHoa = await prisma.class.create({ data: { subjectId: subHoa.id, name: "Hóa 10 Mất gốc", category: "Lớp 10" }});
  await prisma.classTeacher.create({ data: { classId: classHoa.id, teacherId: teachers[2].id, subModule: "Hóa vô cơ" }});

  // Lớp VIP của SUPER ADMIN (Hoàn Thiện)
  const classAdmin = await prisma.class.create({ data: { subjectId: subKynang.id, name: "Tư duy Lập trình Next.js", category: "VIP" }});
  await prisma.classTeacher.create({ data: { classId: classAdmin.id, teacherId: admin.id, subModule: "Fullstack" }});

  const allClasses = [classToan, classLy, classHoa, classAdmin];

  // -------------------------------------------------------------
  // 4. TẠO HỌC SINH (STUDENTS) & GHI DANH (ENROLLMENTS)
  // -------------------------------------------------------------
  console.log("🎓 Đang tạo 12 Học sinh và Ghi danh vào lớp...");
  
  const studentNames = [
    "Trần Hữu Khang", "Lê Phương Trinh", "Nguyễn Minh Khôi", // Lớp Toán
    "Vũ Hải Yến", "Bùi Quốc Anh", "Đặng Thị Mai",           // Lớp Lý
    "Phạm Gia Huy", "Hồ Thanh Hà", "Đỗ Văn Nhật",             // Lớp Hóa
    "Trương Tuấn Tài", "Ngô Đức Mạnh", "Đoàn Hải Yến"         // Lớp Admin (Next.js)
  ];

  for (let i = 0; i < studentNames.length; i++) {
    // 1. Tạo Học sinh
    const student = await prisma.student.create({
      data: {
        fullName: studentNames[i],
        phoneStudent: `090${Math.floor(1000000 + Math.random() * 9000000)}`,
        gender: i % 2 === 0 ? "MALE" : "FEMALE",
      }
    });

    // 2. Xác định Học sinh này sẽ vào lớp nào (Cứ 3 học sinh / 1 lớp)
    const targetClass = allClasses[Math.floor(i / 3)];

    // 3. Tạo record Ghi danh (Enrollment)
    await prisma.enrollment.create({
      data: {
        studentId: student.id,
        classId: targetClass.id,
        status: "ACTIVE",
        feeStatus: "PAID",
        remainingSessions: targetClass === classAdmin ? 8 : 12, // Dựa theo số buổi của môn học
      }
    });
  }

  console.log("🎉 HOÀN TẤT! Toàn bộ dữ liệu đã được nạp thành công vào Database.");
}

main()
  .catch((e) => {
    console.error("❌ Có lỗi xảy ra:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });