import { defineConfig } from "@prisma/config";
import "dotenv/config";

// Kiểm tra xem biến môi trường có load lên được không
if (!process.env.DIRECT_URL) {
  console.error("❌ LỖI: Không tìm thấy DIRECT_URL trong file .env!");
  process.exit(1); // Dừng lại nếu không có URL
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
      // ĐÃ SỬA: Dùng tsx để chạy file seed.ts
      seed: "npx tsx prisma/seed.ts",
    },
  datasource: {
    // Nên dùng process.env.DIRECT_URL thay vì hardcode chuỗi để bảo mật nhé!
    url: "postgresql://postgres.cpzrjkwwnsdymeglwiyh:@nguyenha17022005@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
  },
});