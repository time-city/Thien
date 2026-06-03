import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config"; 

const connectionString = "postgresql://postgres.cpzrjkwwnsdymeglwiyh:@nguyenha17022005@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("⏳ Bắt đầu nạp dữ liệu Seed (Bản Full Schema Mới)...");

  // =============================================================
  // 0. DỌN DẸP DỮ LIỆU CŨ (Tránh lỗi Duplicate)
  // Xóa theo thứ tự từ bảng con (chứa khóa ngoại) lên bảng cha
  // =============================================================
  console.log("🧹 Đang dọn dẹp dữ liệu cũ...");
  await prisma.attendanceLog.deleteMany();
  await prisma.roomRentalLog.deleteMany();
  await prisma.classSession.deleteMany();
  await prisma.paymentHistory.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.classTeacher.deleteMany();
  await prisma.pendingTransaction.deleteMany();
  await prisma.student.deleteMany();
  await prisma.class.deleteMany();
  await prisma.room.deleteMany();
  await prisma.salaryPayment.deleteMany();
  await prisma.user.deleteMany();

  // =============================================================
  // 1. TẠO TÀI KHOẢN (1 ADMIN + 2 GIÁO VIÊN)
  // =============================================================
  console.log("👤 Đang tạo Users (1 Admin & 2 Giáo viên)...");
  const defaultPassword = await bcrypt.hash("123456", 10);

  const admin = await prisma.user.create({
    data: {
      username: "admin",
      passwordHash: defaultPassword,
      fullName: "Hoàn Thiện",
      role: "SUPER_ADMIN",
      isActive: true,
    },
  });

  const teacher1 = await prisma.user.create({
    data: {
      username: "gv_toan",
      passwordHash: defaultPassword,
      fullName: "Thầy Nguyễn Văn Toán",
      role: "TEACHER",
      isActive: true,
      salaryBalance: 1500000, 
    },
  });

  const teacher2 = await prisma.user.create({
    data: {
      username: "gv_anh",
      passwordHash: defaultPassword,
      fullName: "Cô Trần Thị Anh",
      role: "TEACHER",
      isActive: true,
      salaryBalance: 2000000, 
    },
  });

  // =============================================================
  // 2. TẠO PHÒNG HỌC (2 PHÒNG)
  // =============================================================
  console.log("🏫 Đang tạo 2 Phòng học...");
  const room1 = await prisma.room.create({
    data: { name: "Phòng Cơ Sở 1", capacity: 25, isActive: true }
  });

  const room2 = await prisma.room.create({
    data: { name: "Phòng Cơ Sở 2", capacity: 30, isActive: true }
  });

  // =============================================================
  // 3. TẠO LỚP HỌC (5 LỚP) GÁN CHO GIÁO VIÊN
  // =============================================================
  console.log("📚 Đang tạo 5 Lớp học...");
  const classConfigs = [
    { name: "Toán 10 Cơ Bản", category: "Cấp 3", price: 500000, roomFee: 50000, sessions: 12, teacherId: teacher1.id },
    { name: "Toán 12 Luyện Thi", category: "Cấp 3", price: 800000, roomFee: 60000, sessions: 15, teacherId: teacher1.id },
    { name: "Toán 9 Cấp Tốc", category: "Cấp 2", price: 400000, roomFee: 40000, sessions: 10, teacherId: teacher1.id },
    { name: "IELTS Foundation", category: "Tiếng Anh", price: 1200000, roomFee: 80000, sessions: 20, teacherId: teacher2.id },
    { name: "Anh Văn Giao Tiếp", category: "Tiếng Anh", price: 900000, roomFee: 50000, sessions: 15, teacherId: teacher2.id },
  ];

  const createdClasses = [];
  for (const c of classConfigs) {
    const newClass = await prisma.class.create({
      data: {
        name: c.name,
        category: c.category,
        pricePerSession: c.price,
        roomFeePerSession: c.roomFee,
        sessionsPerPackage: c.sessions,
        status: "APPROVED", // Đã duyệt
        createdById: admin.id,
        teachers: {
          create: { teacherId: c.teacherId }
        }
      }
    });
    createdClasses.push(newClass);
  }

  // =============================================================
  // 4. TẠO 100 HỌC SINH (MỖI LỚP CHÍNH XÁC 20 HỌC SINH)
  // =============================================================
  console.log("🎓 Đang tạo 100 Học sinh và ghi danh (Mỗi lớp 20 HS)...");
  const schoolsList = ["THPT Phan Châu Trinh", "THPT Hoàng Hoa Thám", "THCS Trưng Vương", "THCS Tây Sơn"];
  
  for (let i = 0; i < createdClasses.length; i++) {
    const targetClass = createdClasses[i];
    const classConfig = classConfigs[i];

    // Tạo 20 học sinh cho từng lớp
    const studentData = Array.from({ length: 20 }).map((_, index) => {
      const studentNumber = i * 20 + index + 1;
      return {
        fullName: `Học Sinh Lớp ${i + 1} - ${index + 1}`,
        phoneStudent: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
        parentName: `Phụ Huynh HS ${studentNumber}`,
        phoneParent: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
        gender: index % 2 === 0 ? "MALE" : "FEMALE" as any,
        school: schoolsList[Math.floor(Math.random() * schoolsList.length)],
        dob: new Date(2008, 5, 15),
      };
    });

    // Insert 20 học sinh vào Database
    await prisma.student.createMany({ data: studentData });

    // Lấy 20 học sinh vừa insert (mẹo: lấy 20 người mới nhất theo fullName)
    const insertedStudents = await prisma.student.findMany({
      where: { fullName: { startsWith: `Học Sinh Lớp ${i + 1} -` } }
    });

    // Tạo ghi danh (Enrollment) cho 20 bé này vào Lớp tương ứng
    const enrollmentData = insertedStudents.map(student => ({
      studentId: student.id,
      classId: targetClass.id,
      status: "ACTIVE" as any,
      feeStatus: "PAID" as any, // Mặc định đã đóng tiền
      remainingSessions: classConfig.sessions, 
    }));

    await prisma.enrollment.createMany({ data: enrollmentData });
  }

  // =============================================================
  // 5. TẠO SẴN MỘT VÀI CA HỌC (SESSIONS) ĐỂ TEST LỊCH & PHÒNG
  // =============================================================
  console.log("📅 Đang xếp một vài lịch dạy demo vào phòng học...");
  const today = new Date();
  
  await prisma.classSession.createMany({
    data: [
      {
        classId: createdClasses[0].id,
        teacherId: teacher1.id,
        roomId: room1.id, // Dạy phòng 1
        date: today,
        slot: 1, // Ca 1 (vd: 17:30 - 19:00)
        status: "SCHEDULED"
      },
      {
        classId: createdClasses[3].id,
        teacherId: teacher2.id,
        roomId: room2.id, // Dạy phòng 2 cùng giờ Ca 1
        date: today,
        slot: 1, 
        status: "SCHEDULED"
      }
    ]
  });

  console.log("✅ HOÀN TẤT! Đã nạp thành công bộ dữ liệu chuẩn.");
}

main()
  .catch((e) => {
    console.error("❌ Có lỗi xảy ra:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });