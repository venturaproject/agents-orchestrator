import type { AuthUserRepository } from "../ports/auth-user-repository";
import type { PasswordVerifier } from "../ports/password-verifier";
import type { SessionTokenIssuer } from "../ports/session-token-issuer";
import { SessionUser } from "../../../domain/auth/entities/session-user";

export class LoginCommand {
  constructor(
    readonly email: string,
    readonly password: string,
    readonly rememberMe: boolean,
  ) {}
}

export type LoginResult = { user: { id: string; email: string }; token: string };

export class LoginHandler {
  constructor(
    private readonly users: AuthUserRepository,
    private readonly passwords: PasswordVerifier,
    private readonly sessions: SessionTokenIssuer,
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult | null> {
    const email = command.email.trim().toLowerCase();
    if (!email || command.password.length > 200) return null;

    const record = await this.users.findByEmail(email);
    if (!record || !this.passwords.verify(command.password, record.passwordHash)) return null;

    const user = new SessionUser({ id: record.id, email: record.email });
    return {
      user: user.toPrimitives(),
      token: await this.sessions.issue(user, command.rememberMe),
    };
  }
}
