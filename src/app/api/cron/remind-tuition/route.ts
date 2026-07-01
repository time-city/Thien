import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    // 1. Tìm tất cả học sinh đang nợ tiền
    const studentsWithDebt = await prisma.student.findMany({
      where: {
        invoices: {
          some: {
            status: { in: ["PENDING", "UNDERPAID"] }
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
          where: { status: { in: ["PENDING", "UNDERPAID"] } },
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
    const twentyFourHours = 24 * 60 * 60 * 1000; // Để 0 để test luôn
    let sentCount = 0;

    for (const student of studentsWithDebt) {
      if (!student.attendanceLogs || student.attendanceLogs.length === 0) continue;

      const lastReportedAt = student.attendanceLogs[0].reportedAt;
      if (!lastReportedAt) continue;

      // Kiểm tra xem báo cáo gần nhất đã vượt qua 24 giờ chưa
      const timeSinceLastReport = now.getTime() - lastReportedAt.getTime();

      if (timeSinceLastReport >= twentyFourHours) {
        // Gom danh sách các lớp đang nợ
        const classNames = student.invoices
          .map(inv => inv.enrollment?.class?.name)
          .filter(Boolean)
          .join(", ");

        const classNameDisplay = classNames ? classNames : "Tổng hợp / Nợ cũ";

        const message = `***NHẮC BÁO HỌC PHÍ***
Nông trại Khoa học tự nhiên ***CHƯA NHẬN*** học phí học sinh: ***${student.fullName}***
Lớp: ***${classNameDisplay}***

_Phụ huynh đã nộp nhưng hệ thống chưa cập nhật, vui lòng nhắn tin xác nhận để được kiểm tra lại tình trạng học phí._`;

        if (student.phoneParent) {
          try {
            // Gọi API Zalo Bot
            const zaloResponse = await fetch("http://116.118.9.61:8080/send", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": process.env.NEXT_PUBLIC_ZALO_BOT_API_KEY || ""
              },
              body: JSON.stringify({
                target: student.phoneParent,
                message: message
              })
            });

            if (zaloResponse.ok) {
              console.log(`[Cron] Đã gửi nhắc nợ cho phụ huynh học sinh ${student.fullName} (${student.phoneParent})`);
              sentCount++;

              // Cập nhật lại thời gian reportedAt thành hiện tại để 24h sau mới nhắc tiếp
              await prisma.attendanceLog.updateMany({
                where: {
                  studentId: student.id,
                  isReportSent: true
                },
                data: {
                  reportedAt: now
                }
              });
            } else {
              const errorText = await zaloResponse.text();
              console.error(`[Cron] Lỗi khi gửi Zalo cho ${student.fullName}. Status: ${zaloResponse.status}, Chi tiết: ${errorText}`);
            }
          } catch (zaloError) {
            console.error(`[Cron] Không thể kết nối Zalo Bot cho ${student.fullName}`, zaloError);
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
