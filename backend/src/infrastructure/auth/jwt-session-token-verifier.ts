import { jwtVerify } from "jose";
import { SessionUser } from "../../domain/auth/entities/session-user";
import type { SessionTokenVerifier } from "../../application/auth/ports/session-token-verifier";

export class JwtSessionTokenVerifier implements SessionTokenVerifier {
  async verify(token: string): Promise<SessionUser | null> {
    const secret = process.env.AUTH_SECRET;
    if (!secret || secret.length < 32) return null;

    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
        algorithms: ["HS256"],
      });
      if (!payload.sub || typeof payload.email !== "string") return null;

      return new SessionUser({ id: payload.sub, email: payload.email });
    } catch {
      return null;
    }
  }
}
