const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DIRECT_URL || "postgresql://postgres.cpzrjkwwnsdymeglwiyh:@nguyenha17022005@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
});

async function run() {
  await client.connect();
  
  // 1. Mark room rentals as PAID for teachers with salaryBalance >= 0
  const roomRes = await client.query(`
    UPDATE "public"."room_rental_logs"
    SET status = 'PAID'
    WHERE status = 'PENDING' AND "teacherId" IN (
      SELECT id FROM "public"."users" WHERE role = 'TEACHER' AND "salaryBalance" >= 0
    );
  `);
  console.log(`Updated ${roomRes.rowCount} room rental logs to PAID`);

  // 2. Mark class sessions as PAID for teachers with salaryBalance <= 0
  const sessionRes = await client.query(`
    UPDATE "public"."class_sessions"
    SET "isPaid" = true
    WHERE "isPaid" = false AND status = 'COMPLETED' AND "teacherId" IN (
      SELECT id FROM "public"."users" WHERE role = 'TEACHER' AND "salaryBalance" <= 0
    );
  `);
  console.log(`Updated ${sessionRes.rowCount} class sessions to PAID`);

  await client.end();
}

run().catch(console.error);
