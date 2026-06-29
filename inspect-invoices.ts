import { Client } from 'pg';
import { config } from "dotenv";
config();

async function main() {
  const connectionString = process.env.DIRECT_URL;
  const client = new Client({ connectionString });
  await client.connect();

  const res = await client.query("SELECT id, \"expectedAmount\", details, \"studentId\", \"createdAt\" FROM invoices WHERE status = 'PENDING'");
  console.log(JSON.stringify(res.rows, null, 2));

  await client.end();
}

main().catch(e => console.error(e)).finally(() => process.exit(0));
