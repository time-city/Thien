import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const prismaClientSingleton = () => {
  // 1. Lấy link kết nối (Nhớ là cổng 6543 trong file .env nhé)
  const connectionString = process.env.DATABASE_URL as string;

  // 2. Khởi tạo Pool để quản lý connection
  const pool = new Pool({ connectionString });

  // 3. Truyền Pool vào Adapter
  const adapter = new PrismaPg(pool);

  // 4. Khởi tạo Prisma với Adapter
  return new PrismaClient({ adapter });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = prisma;