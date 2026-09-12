import 'server-only';
import { neon } from '@neondatabase/serverless';
import { databaseUrl } from './server-env';

type SqlClient = ReturnType<typeof neon>;

let client: SqlClient | null = null;

/**
 * Neon HTTP client, created once per serverless instance.
 *
 * The HTTP driver is a good fit here: every query in this app is a short,
 * self-contained statement, so there is no connection pool to exhaust when
 * Vercel scales the function out.
 */
export function db(): SqlClient {
  if (!client) {
    client = neon(databaseUrl());
  }
  return client;
}
