// this file contains helper functions that talk directly to the database during E2E tests
// we need direct DB access for things like reading email tokens (which aren't returned by the API)
// and seeding test data that would be too complex to set up through the UI

import pg from "pg";

const { Client } = pg;

// the DATABASE_URL in .env uses a SQLAlchemy-style prefix that the pg client doesn't understand
// this function strips it off so we get a valid postgresql:// URL
function normalizeDbUrl(raw) {
  if (!raw) return "postgresql://carhop:carhop@localhost:5432/carhop"; // default for local dev
  return raw
    .replace("postgresql+psycopg://", "postgresql://")
    .replace("postgresql+asyncpg://", "postgresql://");
}

// reads the DB connection string from environment variables
// E2E_DATABASE_URL takes priority so CI can use a different DB than local dev
function databaseUrl() {
  return normalizeDbUrl(
    process.env.E2E_DATABASE_URL || process.env.DATABASE_URL || ""
  );
}

// marks a user's driver licence as verified in the database
// used when we've already inserted a licence record and just need to flip the flag
export async function verifyLicenseInDb(userId) {
  const client = new Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    await client.query(
      "UPDATE driver_licenses SET is_verified = TRUE WHERE user_id = $1",
      [userId]
    );
  } finally {
    await client.end(); // always disconnect even if the query throws
  }
}

// fetches the email verification token for a user so tests can verify without sending a real email
// the backend sends the token by email, but in tests we read it straight from the DB
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
    return res.rows[0]?.token ?? null; // return null if no token found (user probably didn't register)
  } finally {
    await client.end();
  }
}

// inserts a fully verified licence record for a user so they can make bookings in tests
// we use ON CONFLICT so it's safe to call even if a record already exists (it just updates it)
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

// promotes a user to ADMIN role so tests can exercise admin-only features
// we do this via DB because there's no public API endpoint for self-promotion (for obvious reasons)
export async function makeUserAdmin(email) {
  const client = new Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    await client.query(
      "UPDATE users SET role = 'ADMIN' WHERE email = $1",
      [email]
    );
  } finally {
    await client.end();
  }
}

// fetches the most recent password reset token for a user
// same idea as getVerificationToken — the backend emails it, but tests read it from the DB
export async function getPasswordResetToken(email) {
  const client = new Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    const res = await client.query(
      `SELECT prt.token
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE u.email = $1
       ORDER BY prt.id DESC
       LIMIT 1`, // take the latest one in case there are multiple (e.g. user requested twice)
      [email]
    );
    return res.rows[0]?.token ?? null;
  } finally {
    await client.end();
  }
}
