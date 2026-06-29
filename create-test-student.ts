import { Client } from 'pg';
import { config } from "dotenv";
config();

async function main() {
  const connectionString = process.env.DIRECT_URL;
  if (!connectionString) throw new Error("Missing DIRECT_URL");
  
  const client = new Client({ connectionString });
  await client.connect();

  console.log("Connected to DB. Creating test student...");

  // 1. Lấy 1 classId bất kỳ
  const classRes = await client.query(`SELECT id FROM classes LIMIT 1`);
  if (classRes.rowCount === 0) throw new Error("No class found in the DB.");
  const classId = classRes.rows[0].id;

  // 2. Insert Student
  const studentRes = await client.query(`
    INSERT INTO students ("fullName", "phoneParent", "school")
    VALUES ($1, $2, $3)
    RETURNING id
  `, ['test', '0903536212', 'Test School']);
  const studentId = studentRes.rows[0].id;
  console.log("Created student:", studentId);

  // 3. Insert Enrollment (with feeStatus = UNPAID)
  await client.query(`
    INSERT INTO enrollments ("studentId", "classId", "currentVoucher", "remainingSessions", "feeStatus")
    VALUES ($1, $2, 2, 0, 'UNPAID')
  `, [studentId, classId]);
  console.log("Created enrollment for student with UNPAID fee.");

  await client.end();
}

main().catch(e => console.error(e)).finally(() => process.exit(0));
