- [ ] Cập nhật submitAttendanceAndCalculateFinance trong src/actions/mutations.ts
  - [ ] Xóa salaryCalculated cũ (attendanceData.length * pricePerSession)
  - [ ] Trong transaction: query enrollments theo classId + studentIds, select {studentId, remainingSessions}
  - [ ] Tính “giá trị 1 phiếu” = (class.pricePerSession * class.sessionsPerPackage) / remainingSessions (remainingSessions<=0 => 0)
  - [ ] Cộng salaryCalculated mới = tổng phiếuValue của tất cả học sinh trong attendanceData
  - [ ] Giữ nguyên logic: trừ roomFee, increment salaryBalance, decrement remainingSessions, feeStatus UNPAID khi remainingSessions <= 0
- [ ] Typecheck/build (npm run build) hoặc lint nếu có

