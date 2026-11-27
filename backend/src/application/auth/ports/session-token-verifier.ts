import type { SessionUser } from "../../../domain/auth/entities/session-user";

export const SESSION_TOKEN_VERIFIER = Symbol("SESSION_TOKEN_VERIFIER");

export interface SessionTokenVerifier {
  verify(token: string): Promise<SessionUser | null>;
}
