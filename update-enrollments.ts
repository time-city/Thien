import { Client } from 'pg';
import { config } from "dotenv";
config();

async function main() {
  const connectionString = process.env.DIRECT_URL;
  if (!connectionString) throw new Error("Missing DIRECT_URL");
  
  const client = new Client({ connectionString });
  await client.connect();

  console.log("Connected to DB. Updating enrollments...");

  // Update currentVoucher to 2 and feeStatus to 'UNPAID' for ALL enrollments
  const res = await client.query(`
    UPDATE enrollments 
    SET "currentVoucher" = 2, "feeStatus" = 'UNPAID'
  `);
  
  console.log(`Successfully updated ${res.rowCount} enrollments.`);

  await client.end();
}

main().catch(e => console.error(e)).finally(() => process.exit(0));
