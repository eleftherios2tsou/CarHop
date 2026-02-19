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
