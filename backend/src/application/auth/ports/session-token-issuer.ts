import type { SessionUser } from "../../../domain/auth/entities/session-user";

export const SESSION_TOKEN_ISSUER = Symbol("SESSION_TOKEN_ISSUER");

export interface SessionTokenIssuer {
  issue(user: SessionUser, rememberMe: boolean): Promise<string>;
}
