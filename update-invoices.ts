import { Client } from 'pg';
import { config } from "dotenv";
config();

async function main() {
  const connectionString = process.env.DIRECT_URL;
  const client = new Client({ connectionString });
  await client.connect();

  const res = await client.query("UPDATE invoices SET status = 'PAID', \"amountPaid\" = \"expectedAmount\" WHERE status = 'PENDING' AND EXTRACT(MONTH FROM \"createdAt\") = 6 AND EXTRACT(YEAR FROM \"createdAt\") = 2026 RETURNING id");
  console.log(`Updated ${res.rowCount} invoices to PAID.`);
  
  await client.query("UPDATE enrollments SET \"feeStatus\" = 'PAID' WHERE id IN (SELECT \"enrollmentId\" FROM invoices WHERE status = 'PAID')");
  console.log("Updated corresponding enrollments to feeStatus = PAID.");

  await client.end();
}

main().catch(e => console.error(e)).finally(() => process.exit(0));
