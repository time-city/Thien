import { PrismaClient } from '@prisma/client'
import bcrypt from "bcryptjs"
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

// 🛑 Đã sửa: Dùng trực tiếp biến môi trường từ file .env
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("🚨 THIẾU DATABASE_URL TRONG FILE .env");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Bắt đầu dọn dẹp dữ liệu cũ (Reset DB)...')
  await prisma.attendanceLog.deleteMany()
  await prisma.roomRentalLog.deleteMany()
  await prisma.classSession.deleteMany()
  await prisma.paymentHistory.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.enrollment.deleteMany()
  await prisma.classTeacher.deleteMany()
  await prisma.pendingTransaction.deleteMany()
  await prisma.student.deleteMany()
  await prisma.class.deleteMany()
  await prisma.room.deleteMany()
  await prisma.salaryPayment.deleteMany()
  await prisma.user.deleteMany()

  console.log('Đang tạo dữ liệu mẫu (Seeding)...')

  const pass = '123456'
  const hashedPassword = await bcrypt.hash(pass, 10)

  // 1. TẠO USERS (Admin & Giáo viên)
  const admin = await prisma.user.create({
    data: { username: 'admin', passwordHash: hashedPassword, fullName: 'Quản Trị Viên', role: 'SUPER_ADMIN' },
  })

  const teacher1 = await prisma.user.create({
    data: { username: 'gv.nguyenvan', passwordHash: hashedPassword, fullName: 'Nguyễn Văn A', role: 'TEACHER' },
  })

  // 2. TẠO PHÒNG HỌC & LỚP HỌC
  const room1 = await prisma.room.create({ data: { name: 'Phòng 101', capacity: 20 } })
  const classToan = await prisma.class.create({
    data: { name: 'Toán Lớp 10 - Tăng Cường', category: 'Toán Học', roomFeePerSession: 50000, pricePerSession: 100000, sessionsPerPackage: 12, createdById: admin.id },
  })
  const classIelts = await prisma.class.create({
    data: { name: 'IELTS Foundation', category: 'Tiếng Anh', roomFeePerSession: 80000, pricePerSession: 150000, sessionsPerPackage: 24, createdById: admin.id },
  })

  await prisma.classTeacher.create({ data: { classId: classToan.id, teacherId: teacher1.id, subModule: 'Đại Số' } })

  // 3. DANH SÁCH NHIỀU HỌC SINH MẪU
  const listHocSinh = [
    { fullName: 'Trần Thị B', dob: '2010-05-15', gender: 'FEMALE', qrCodeId: 'HS-001' },
    { fullName: 'Nguyễn Hoàng Nam', dob: '2009-08-20', gender: 'MALE', qrCodeId: 'HS-002' },
    { fullName: 'Lê Minh Khang', dob: '2011-01-10', gender: 'MALE', qrCodeId: 'HS-003' },
    { fullName: 'Phạm Phương Trinh', dob: '2010-11-25', gender: 'FEMALE', qrCodeId: 'HS-004' },
    { fullName: 'Vũ Hải Yến', dob: '2008-03-08', gender: 'FEMALE', qrCodeId: 'HS-005' },
    { fullName: 'Đinh Tuấn Kiệt', dob: '2010-09-09', gender: 'MALE', qrCodeId: 'HS-006' },
    { fullName: 'Bùi Thị Thu Hà', dob: '2009-12-12', gender: 'FEMALE', qrCodeId: 'HS-007' },
    { fullName: 'Hoàng Quốc Việt', dob: '2011-04-30', gender: 'MALE', qrCodeId: 'HS-008' },
  ]

  const students = []
  for (const raw of listHocSinh) {
    const st = await prisma.student.create({
      data: { ...raw, gender: raw.gender as 'MALE' | 'FEMALE' | 'OTHER', dob: new Date(raw.dob), phoneStudent: '090100000' + raw.qrCodeId.slice(-1) }
    })
    students.push(st)
  }

  // 4. GHI DANH & TẠO HÓA ĐƠN CHO TỪNG HỌC SINH
  console.log('Đang phân bổ lớp học và tạo hóa đơn (Đủ/Thiếu/Dư)...')

  for (let i = 0; i < students.length; i++) {
    const student = students[i]

    if (i === 0) {
      // Trường hợp 1: Học sinh có 1 lớp cạn buổi học (chưa có hóa đơn)
      await prisma.enrollment.create({
        data: {
          studentId: student.id, classId: classToan.id, remainingSessions: 0, feeStatus: 'UNPAID', status: 'ACTIVE',
        }
      })
    } else if (i === 1) {
      // Trường hợp 2: Học sinh học 2 lớp song song và cả 2 lớp đều cạn buổi học
      await prisma.enrollment.create({
        data: { studentId: student.id, classId: classToan.id, remainingSessions: 0, feeStatus: 'UNPAID', status: 'ACTIVE' }
      })
      await prisma.enrollment.create({
        data: { studentId: student.id, classId: classIelts.id, remainingSessions: 0, feeStatus: 'UNPAID', status: 'ACTIVE' }
      })
    } else if (i === 2) {
      // Trường hợp 3: 1 hóa đơn nợ cũ (UNDERPAID) + 1 lớp cạn buổi
      await prisma.enrollment.create({
        data: { studentId: student.id, classId: classToan.id, remainingSessions: 0, feeStatus: 'UNPAID', status: 'ACTIVE' }
      })
      await prisma.invoice.create({
        data: {
          studentId: student.id, expectedAmount: 100000, amountPaid: 0, status: 'UNDERPAID', isDebt: true,
          details: [{ type: "DEBT", amount: 100000 }]
        }
      })
    } else if (i === 3) {
      // Trường hợp 4: Học sinh chỉ có 1 khoản nợ duy nhất (lớp vẫn còn buổi)
      await prisma.enrollment.create({
        data: { studentId: student.id, classId: classIelts.id, remainingSessions: 10, feeStatus: 'PAID', status: 'ACTIVE' }
      })
      await prisma.invoice.create({
        data: {
          studentId: student.id, expectedAmount: 200000, amountPaid: 0, status: 'UNDERPAID', isDebt: true,
          details: [{ type: "DEBT", amount: 200000 }]
        }
      })
    } else {
      // Các học sinh còn lại: Bình thường (đã đóng đủ)
      const targetClass = i % 2 === 0 ? classToan : classIelts
      const expectedAmount = targetClass.pricePerSession * targetClass.sessionsPerPackage
      const enrollment = await prisma.enrollment.create({
        data: { studentId: student.id, classId: targetClass.id, remainingSessions: targetClass.sessionsPerPackage, feeStatus: 'PAID', status: 'ACTIVE' }
      })
      await prisma.invoice.create({
        data: {
          enrollmentId: enrollment.id, studentId: student.id, expectedAmount: expectedAmount, amountPaid: expectedAmount,
          status: 'PAID', transactionCode: `SEPAY-${1000 + i}`,
          details: [{ enrollmentId: enrollment.id, amount: expectedAmount, type: "TUITION" }]
        }
      })
    }
  }

  // 5. TẠO LỊCH HỌC VÀ ĐIỂM DANH (Cho một lớp để test)
  const session1 = await prisma.classSession.create({
    data: { classId: classToan.id, teacherId: teacher1.id, roomId: room1.id, date: new Date(), slot: 1, status: 'COMPLETED' }
  })

  for (let i = 0; i < students.length; i += 2) {
    await prisma.attendanceLog.create({
      data: { classSessionId: session1.id, studentId: students[i].id, attendanceStatus: 'PRESENT', homeworkStatus: 'DONE' }
    })
  }

  console.log('✅ Seeding thành công! Đã thêm 8 học sinh với đủ các trạng thái Hóa đơn.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })