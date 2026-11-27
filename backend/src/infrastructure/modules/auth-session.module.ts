import { Module } from "@nestjs/common";
import {
  SESSION_TOKEN_VERIFIER,
  type SessionTokenVerifier,
} from "../../application/auth/ports/session-token-verifier";
import { AUTH_USER_REPOSITORY, type AuthUserRepository } from "../../application/auth/ports/auth-user-repository";
import { PASSWORD_VERIFIER, type PasswordVerifier } from "../../application/auth/ports/password-verifier";
import { SESSION_TOKEN_ISSUER, type SessionTokenIssuer } from "../../application/auth/ports/session-token-issuer";
import { LoginHandler } from "../../application/auth/commands/login.command";
import { GetCurrentSessionHandler } from "../../application/auth/queries/get-current-session.query";
import { JwtSessionTokenVerifier } from "../auth/jwt-session-token-verifier";
import { JwtSessionTokenIssuer } from "../auth/jwt-session-token-issuer";
import { ScryptPasswordVerifier } from "../auth/scrypt-password-verifier";
import { PgAuthUserRepository } from "../persistence/postgres/pg-auth-user.repository";
import { AuthSessionController } from "../http/auth/auth-session.controller";

@Module({
  controllers: [AuthSessionController],
  providers: [
    { provide: SESSION_TOKEN_VERIFIER, useClass: JwtSessionTokenVerifier },
    { provide: SESSION_TOKEN_ISSUER, useClass: JwtSessionTokenIssuer },
    { provide: PASSWORD_VERIFIER, useClass: ScryptPasswordVerifier },
    { provide: AUTH_USER_REPOSITORY, useClass: PgAuthUserRepository },
    {
      provide: LoginHandler,
      useFactory: (
        users: AuthUserRepository,
        passwords: PasswordVerifier,
        sessions: SessionTokenIssuer,
      ) => new LoginHandler(users, passwords, sessions),
      inject: [AUTH_USER_REPOSITORY, PASSWORD_VERIFIER, SESSION_TOKEN_ISSUER],
    },
    {
      provide: GetCurrentSessionHandler,
      useFactory: (tokenVerifier: SessionTokenVerifier) => new GetCurrentSessionHandler(tokenVerifier),
      inject: [SESSION_TOKEN_VERIFIER],
    },
  ],
  exports: [GetCurrentSessionHandler],
})
export class AuthSessionModule {}
