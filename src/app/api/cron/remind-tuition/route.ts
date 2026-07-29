import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendZaloAndLog } from "@/lib/zalo";

export async function GET(request: Request) {
  try {
    // 1. Tìm tất cả học sinh đang nợ tiền
    const studentsWithDebt = await prisma.student.findMany({
      where: {
        invoices: {
          some: {
            status: "PENDING"
          }
        },
        attendanceLogs: {
          some: {
            isReportSent: true,
            reportedAt: { not: null }
          }
        }
      },
      include: {
        invoices: {
          where: { status: "PENDING" },
          include: { enrollment: { include: { class: true } } }
        },
        attendanceLogs: {
          where: { isReportSent: true, reportedAt: { not: null } },
          orderBy: { reportedAt: "desc" },
          take: 1
        }
      }
    });

    const now = new Date();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    let sentCount = 0;

    for (const student of studentsWithDebt) {
      if (!student.attendanceLogs || student.attendanceLogs.length === 0) continue;

      const lastReportedAt = student.attendanceLogs[0].reportedAt;
      if (!lastReportedAt) continue;

      const lastRemindedAt = student.lastTuitionRemindAt;
      const mostRecentContact = lastRemindedAt ? new Date(Math.max(lastReportedAt.getTime(), lastRemindedAt.getTime())) : lastReportedAt;

      // Kiểm tra xem liên hệ gần nhất (báo cáo hoặc nhắc nợ) đã vượt qua 24 giờ chưa
      const timeSinceLastContact = now.getTime() - mostRecentContact.getTime();

      if (timeSinceLastContact >= twentyFourHours) {
        // Gom danh sách các lớp đang nợ
        const classNames = student.invoices
          .map(inv => inv.enrollment?.class?.name)
          .filter(Boolean)
          .join(", ");

        const classNameDisplay = classNames ? classNames : "Tổng hợp / Nợ cũ";

        // Chỉ nhắc khi ĐÚNG BẰNG 0 buổi:
        // - Âm (<0): Đã nhắc từ lần trước rồi (học lố), không nhắc lặp lại
        // - Dương (>0): Còn buổi học, chưa cần nhắc
        // - Bằng 0: Vừa hết phiếu, đây là lúc thích hợp nhất để nhắc đóng kỳ tới
        const hasZeroSessions = student.invoices.some(
          inv => inv.enrollment !== null && inv.enrollment.remainingSessions === 0
        );

        if (!hasZeroSessions) continue; // Bỏ qua nếu không có enrollment nào đang ở 0 phiếu

        // Gom thông tin lớp + số phiếu để báo cáo rõ ràng
        const classDetails = student.invoices
          .filter(inv => inv.enrollment !== null && inv.enrollment.remainingSessions === 0)
          .map(inv => `${inv.enrollment!.class.name} (0 buổi còn lại)`)
          .join(", ");

        const message = `***NHẮC ĐÓNG HỌC PHÍ KỲ MỚI***
Nông trại Khoa học tự nhiên thông báo học sinh: ***${student.fullName}*** đã hết phiếu học.
Lớp: ***${classDetails || classNameDisplay}***
Số phiếu hiện tại: ***0***

_Vui lòng đóng học phí cho bé ạ. Kính báo./._`;


        if (student.phoneParent) {
          const result = await sendZaloAndLog({
            phone: student.phoneParent,
            message,
            messageType: "ADVANCE_BILLING",
            studentId: student.id,
          });

          if (result.success) {
            console.log(`[Cron] Đã gửi nhắc nợ cho phụ huynh học sinh ${student.fullName} (${student.phoneParent})`);
            sentCount++;

            // Cập nhật lại thời gian nhắc nợ cuối cùng vào bảng Student
            await prisma.student.update({
              where: { id: student.id },
              data: { lastTuitionRemindAt: now }
            });
          } else {
            console.error(`[Cron] Lỗi khi gửi Zalo cho ${student.fullName}: ${result.errorNote}`);
          }
        }
      }
    }

    return NextResponse.json({ success: true, message: `Checked ${studentsWithDebt.length} students with debt. Sent ${sentCount} reminders.` });
  } catch (error: any) {
    console.error("[Cron Remind Tuition] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
