require('dotenv').config({ path: '.env.local' });
require('dotenv').config(); // fallback

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    console.log("Deleting old sessions via PG...");
    await pool.query('DELETE FROM public.attendance_logs');
    await pool.query('DELETE FROM public.room_rental_logs');
    await pool.query('DELETE FROM public.class_sessions');
    console.log("Done deleting.");
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
