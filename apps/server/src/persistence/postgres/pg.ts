import { Pool } from "pg";

type SslMode = "disable" | "require" | "prefer" | "allow";

export function createPgPool(
  databaseUrl: string,
  opts?: {
    sslMode?: SslMode;
  }
) {
  // Supabase-hosted Postgres typically requires TLS.
  // Node-postgres needs an explicit ssl option to negotiate TLS in many environments.
  // If you have a proper CA bundle, prefer `rejectUnauthorized: true`.
  const sslMode = opts?.sslMode;
  const ssl = sslMode === "require" ? { rejectUnauthorized: false } : undefined;

  return new Pool({ connectionString: databaseUrl, ssl });
}
