import { SignJWT } from "jose";
import type { SessionTokenIssuer } from "../../application/auth/ports/session-token-issuer";
import type { SessionUser } from "../../domain/auth/entities/session-user";

const sessionLifetimeSeconds = 60 * 60 * 12;
const rememberedLifetimeSeconds = 60 * 60 * 24 * 30;

export class JwtSessionTokenIssuer implements SessionTokenIssuer {
  async issue(user: SessionUser, rememberMe: boolean): Promise<string> {
    const secret = process.env.AUTH_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error("AUTH_SECRET must be configured with at least 32 characters.");
    }

    return new SignJWT({ email: user.email })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(`${rememberMe ? rememberedLifetimeSeconds : sessionLifetimeSeconds}s`)
      .sign(new TextEncoder().encode(secret));
  }
}
