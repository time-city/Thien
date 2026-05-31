import { NextResponse } from "next/server";

import { fetchClassDetailsForView } from "@/actions/queries";

export async function GET(
  _req: Request,
  context: { params: Promise<{ classId: string }> }
) {
  const { classId } = await context.params;
  const data = await fetchClassDetailsForView(classId);

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Chuẩn hóa trạng thái ghi danh theo yêu cầu: thay vì status enum ghi danh,
  // hiển thị theo trường logic nộp tiền (feeStatus). Nếu feeStatus không có,
  // fallback về status.
  const normalizedEnrollments = (data.enrollments || []).map((enr: any) => {
    const feeStatus = enr.feeStatus;

    let normalizedStatus: string = enr.status ?? "Active";
    const normalizedFee = (feeStatus || "").toString().toLowerCase();

    // Mapping theo ý nghĩa "đã nộp tiền chưa" (tối giản, tránh phụ thuộc enum cứng)
    if (normalizedFee.includes("paid") || normalizedFee.includes("paid_up") || normalizedFee.includes("đã") || normalizedFee.includes("hoàn")) {
      normalizedStatus = "Active";
    } else if (normalizedFee.includes("unpaid") || normalizedFee.includes("chưa") || normalizedFee.includes("pending")) {
      normalizedStatus = "Paused";
    }

    return {
      ...enr,
      status: normalizedStatus,
    };
  });

  return NextResponse.json({
    ...data,
    enrollments: normalizedEnrollments,
  });
}

