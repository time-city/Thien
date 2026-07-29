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
    data: { username: 'gv.nguyenvan', passwordHash: hashedPassword, fullName: 'Nguyễn Văn A (Lương cứng)', role: 'TEACHER', salaryBalance: 500000 },
  })

  const teacher2 = await prisma.user.create({
    data: { username: 'gv.tranb', passwordHash: hashedPassword, fullName: 'Trần Văn B (Freelance)', role: 'TEACHER', salaryBalance: 1500000 },
  })

  // 2. TẠO PHÒNG HỌC & LỚP HỌC
  const room1 = await prisma.room.create({ data: { name: 'Phòng 101', capacity: 20, feePerHour: 25000 } })
  const room2 = await prisma.room.create({ data: { name: 'Phòng 202', capacity: 30, feePerHour: 40000 } })

  // Lớp Lương Cứng: Giáo viên được trả lương cứng mỗi buổi.
  const classToan = await prisma.class.create({
    data: { name: 'Toán Lớp 10 - Tăng Cường', category: 'Toán Học', pricePerSession: 100000, sessionsPerPackage: 12, createdById: admin.id },
  })
  
  // Lớp Trung Tâm khác
  const classIelts = await prisma.class.create({
    data: { name: 'IELTS Foundation', category: 'Tiếng Anh', pricePerSession: 150000, sessionsPerPackage: 24, createdById: admin.id },
  })

  // Phân công giáo viên
  await prisma.classTeacher.create({ 
    data: { classId: classToan.id, teacherId: teacher1.id, subModule: 'Đại Số', salaryPerSession: 200000 } 
  })
  await prisma.classTeacher.create({ 
    data: { classId: classIelts.id, teacherId: teacher2.id, subModule: 'Listening', salaryPerSession: 0 } 
  })

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
      // Trường hợp 1: Học sinh có 1 lớp cạn buổi học (chưa có hóa đơn) - Đăng ký lớp Freelance để test webhook
      await prisma.enrollment.create({
        data: {
          studentId: student.id, classId: classIelts.id, remainingSessions: 0, feeStatus: 'UNPAID', status: 'ACTIVE',
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
          studentId: student.id, expectedAmount: 100000, amountPaid: 0, status: 'PENDING',
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
          studentId: student.id, expectedAmount: 200000, amountPaid: 0, status: 'PENDING',
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
          status: "PENDING", transactionCode: `SEPAY-${1000 + i}`,
          details: [{ enrollmentId: enrollment.id, amount: expectedAmount, type: "TUITION" }]
        }
      })
    }
  }

  // 5. TẠO LỊCH HỌC VÀ ĐIỂM DANH (Cho một lớp để test)
  const d1 = new Date();
  const sTime1 = new Date(d1); sTime1.setHours(7, 30, 0, 0);
  const eTime1 = new Date(d1); eTime1.setHours(9, 0, 0, 0);
  const session1 = await prisma.classSession.create({
    data: { classId: classToan.id, teacherId: teacher1.id, roomId: room1.id, date: d1, startTime: sTime1, endTime: eTime1, status: 'COMPLETED', isPaid: false }
  })

  // Đã thanh toán lương thử nghiệm
  await prisma.classSession.update({
    where: { id: session1.id },
    data: { isPaid: true }
  })

  for (let i = 0; i < students.length; i += 2) {
    await prisma.attendanceLog.create({
      data: { classSessionId: session1.id, studentId: students[i].id, attendanceStatus: 'PRESENT', homeworkStatus: 'DONE' }
    })
  }

  // TẠO CÁC BUỔI HỌC SCHEDULED ĐỂ USER TEST TÍNH NĂNG COMPLETED
  const d2 = new Date(); d2.setDate(d2.getDate() + 1);
  const sTime2 = new Date(d2); sTime2.setHours(9, 30, 0, 0);
  const eTime2 = new Date(d2); eTime2.setHours(11, 0, 0, 0);
  await prisma.classSession.create({
    data: { classId: classToan.id, teacherId: teacher1.id, roomId: room1.id, date: d2, startTime: sTime2, endTime: eTime2, status: 'SCHEDULED', isPaid: false }
  })

  const d3 = new Date(); d3.setDate(d3.getDate() + 2);
  const sTime3 = new Date(d3); sTime3.setHours(13, 30, 0, 0);
  const eTime3 = new Date(d3); eTime3.setHours(15, 0, 0, 0);
  await prisma.classSession.create({
    data: { classId: classIelts.id, teacherId: teacher2.id, roomId: room2.id, date: d3, startTime: sTime3, endTime: eTime3, status: 'SCHEDULED', isPaid: false }
  })

  console.log('✅ Seeding thành công! Đã setup đầy đủ lớp Lương cứng, lớp Freelance, và ví giáo viên để test tính lương.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })