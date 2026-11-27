import type { AuthUserRecord, AuthUserRepository } from "../../../application/auth/ports/auth-user-repository";
import { pgPool } from "./pg-pool";

export class PgAuthUserRepository implements AuthUserRepository {
  async findByEmail(email: string): Promise<AuthUserRecord | null> {
    const { rows } = await pgPool.query<{
      id: string;
      email: string;
      password_hash: string;
    }>(
      "select id, email, password_hash from app_users where email = $1 limit 1",
      [email],
    );
    const row = rows[0];
    return row ? { id: row.id, email: row.email, passwordHash: row.password_hash } : null;
  }
}
