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
  console.log("⏳ Bắt đầu nạp dữ liệu (Phiên bản Full Field Học Sinh)...");

  // -------------------------------------------------------------
  // 0. DỌN DẸP DỮ LIỆU CŨ
  // -------------------------------------------------------------
  console.log("🧹 Đang dọn dẹp dữ liệu cũ...");
  await prisma.enrollment.deleteMany();
  await prisma.classTeacher.deleteMany();
  await prisma.classSession.deleteMany();
  await prisma.student.deleteMany();
  await prisma.class.deleteMany();

  // -------------------------------------------------------------
  // 1. TẠO TÀI KHOẢN (1 ADMIN + 3 GIÁO VIÊN)
  // -------------------------------------------------------------
  console.log("👤 Đang tạo Users (1 Admin & 3 Giáo viên)...");
  const defaultPassword = await bcrypt.hash("123456", 10);

  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: { fullName: "Hoàn Thiện" }, 
    create: {
      username: "admin",
      passwordHash: defaultPassword,
      fullName: "Hoàn Thiện",
      role: "SUPER_ADMIN",
      isActive: true,
    },
  });

  const teacherData = [
    { username: "gv_toan", fullName: "Thầy Nguyễn Văn Toán" },
    { username: "gv_ly", fullName: "Cô Trần Thị Lý" },
    { username: "gv_hoa", fullName: "Thầy Lê Hóa Học" },
  ];

  const teachers = [];
  for (const t of teacherData) {
    const teacher = await prisma.user.upsert({
      where: { username: t.username },
      update: { salaryBalance: 5000000 }, 
      create: {
        username: t.username,
        passwordHash: defaultPassword,
        fullName: t.fullName,
        role: "TEACHER",
        isActive: true,
        salaryBalance: 5000000, 
      },
    });
    teachers.push(teacher);
  }

  // -------------------------------------------------------------
  // 2. TẠO 10 LỚP HỌC & PHÂN CÔNG GIÁO VIÊN
  // -------------------------------------------------------------
  console.log("🏫 Đang tạo 10 Lớp học & Phân công giáo viên...");
  
  const classConfigs = [
    { name: "Toán 10 Cơ Bản", category: "Cấp 3", roomFee: 50000, price: 150000, sessions: 12, teacher: teachers[0] },
    { name: "Toán 12 Cấp Tốc", category: "Cấp 3", roomFee: 60000, price: 150000, sessions: 15, teacher: teachers[0] },
    { name: "Toán 9 HSG", category: "Đội Tuyển", roomFee: 0, price: 200000, sessions: 20, teacher: teachers[0] },
    
    { name: "Lý 11 Nâng Cao", category: "Cấp 3", roomFee: 50000, price: 150000, sessions: 12, teacher: teachers[1] },
    { name: "Lý 12 Luyện Thi", category: "Cấp 3", roomFee: 60000, price: 150000, sessions: 15, teacher: teachers[1] },
    
    { name: "Hóa 10 Mất Gốc", category: "Cấp 3", roomFee: 50000, price: 120000, sessions: 12, teacher: teachers[2] },
    { name: "Hóa 11 Hữu Cơ", category: "Cấp 3", roomFee: 50000, price: 150000, sessions: 12, teacher: teachers[2] },
    { name: "Hóa 9 Đội Tuyển", category: "Đội Tuyển", roomFee: 0, price: 200000, sessions: 20, teacher: teachers[2] },
    
    { name: "KHTN 8 Cơ Bản", category: "Cấp 2", roomFee: 40000, price: 100000, sessions: 12, teacher: teachers[1] },
    { name: "KHTN 9 Ôn Thi", category: "Cấp 2", roomFee: 40000, price: 120000, sessions: 15, teacher: admin }, 
  ];

  const createdClasses: { id: string }[] = [];
  
  for (const c of classConfigs) {
    const newClass = await prisma.class.create({
      data: {
        name: c.name,
        category: c.category,
        roomFeePerSession: c.roomFee,
        pricePerSession: c.price,
        sessionsPerPackage: c.sessions,
        teachers: {
          create: { teacherId: c.teacher.id } 
        }
      }
    });
    createdClasses.push(newClass);
  }

  // -------------------------------------------------------------
  // 3. TẠO 200 HỌC SINH VỚI ĐẦY ĐỦ FIELD
  // -------------------------------------------------------------
  console.log("🎓 Đang tạo 200 Học sinh với Full thông tin...");
  
  const schoolsList = ["THPT Phan Châu Trinh", "THPT Hoàng Hoa Thám", "THPT Trần Phú", "THCS Nguyễn Huệ", "THCS Tây Sơn", "THCS Trưng Vương"];

  const studentData = Array.from({ length: 200 }).map((_, index) => {
    // Random ngày sinh từ năm 2008 đến 2012
    const randomYear = Math.floor(Math.random() * (2012 - 2008 + 1)) + 2008;
    const randomMonth = Math.floor(Math.random() * 12);
    const randomDay = Math.floor(Math.random() * 28) + 1; // Để an toàn không lố ngày tháng 2
    const dob = new Date(randomYear, randomMonth, randomDay);

    // Random trường học
    const school = schoolsList[Math.floor(Math.random() * schoolsList.length)];

    return {
      fullName: `Học Sinh Test ${index + 1}`,
      phoneStudent: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
      parentName: `Phụ Huynh HS ${index + 1}`,
      phoneParent: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
      gender: index % 2 === 0 ? "MALE" : "FEMALE" as any, 
      dob: dob,
      school: school,
    };
  });

  await prisma.student.createMany({ data: studentData });
  const allStudents = await prisma.student.findMany(); 

  // -------------------------------------------------------------
  // 4. GHI DANH 200 HỌC SINH VÀO 10 LỚP HỌC
  // -------------------------------------------------------------
  console.log("📝 Đang ghi danh học sinh vào lớp...");
  
  const enrollmentData = allStudents.map((student, index) => {
    const classIndex = index % 10;
    const targetClass = createdClasses[classIndex]; 
    const classConfig = classConfigs[classIndex];
    
    return {
      studentId: student.id,
      classId: targetClass.id,
      status: "ACTIVE" as any,
      feeStatus: "PAID" as any,
      remainingSessions: classConfig.sessions, 
    };
  });

  await prisma.enrollment.createMany({ data: enrollmentData });

  console.log("✅ HOÀN TẤT! Đã nạp thành công 200 HS, 10 Lớp, 4 User.");
}

main()
  .catch((e) => {
    console.error("❌ Có lỗi xảy ra:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });