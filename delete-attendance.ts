import { Client } from 'pg';
import { config } from "dotenv";
config();

async function main() {
  const connectionString = process.env.DIRECT_URL;
  if (!connectionString) throw new Error("Missing DIRECT_URL");
  
  const client = new Client({ connectionString });
  await client.connect();

  console.log("Connected to DB. Deleting all attendance logs...");

  // Delete all attendance logs
  const res = await client.query(`DELETE FROM attendance_logs`);
  console.log(`Successfully deleted ${res.rowCount} rows from attendance_logs.`);

  // Reset session flags
  const res2 = await client.query(`
    UPDATE class_sessions 
    SET "isAttendanceSubmitted" = false, "attendanceSubmittedAt" = NULL
  `);
  console.log(`Successfully reset isAttendanceSubmitted for ${res2.rowCount} class_sessions.`);

  await client.end();
}

main().catch(e => console.error(e)).finally(() => process.exit(0));
