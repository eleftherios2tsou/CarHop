import pg from "pg";

const { Client } = pg;

function normalizeDbUrl(raw) {
  if (!raw) return "postgresql://carhop:carhop@localhost:5432/carhop";
  return raw
    .replace("postgresql+psycopg://", "postgresql://")
    .replace("postgresql+asyncpg://", "postgresql://");
}

function databaseUrl() {
  return normalizeDbUrl(
    process.env.E2E_DATABASE_URL || process.env.DATABASE_URL || ""
  );
}

export async function verifyLicenseInDb(userId) {
  const client = new Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    await client.query(
      "UPDATE driver_licenses SET is_verified = TRUE WHERE user_id = $1",
      [userId]
    );
  } finally {
    await client.end();
  }
}

export async function getVerificationToken(email) {
  const client = new Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    const res = await client.query(
      `SELECT evt.token
       FROM email_verification_tokens evt
       JOIN users u ON u.id = evt.user_id
       WHERE u.email = $1
       LIMIT 1`,
      [email]
    );
    return res.rows[0]?.token ?? null;
  } finally {
    await client.end();
  }
}

export async function createVerifiedLicenseInDb(userId) {
  const client = new Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    await client.query(
      `INSERT INTO driver_licenses
         (user_id, license_number, issuing_country, expiry_date, is_verified, verification_status, verified_at)
       VALUES ($1, 'E2E-TEST', 'UK', NOW() + INTERVAL '365 days', TRUE, 'approved', NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET is_verified = TRUE,
             verification_status = 'approved',
             verified_at = NOW()`,
      [userId]
    );
  } finally {
    await client.end();
  }
}
