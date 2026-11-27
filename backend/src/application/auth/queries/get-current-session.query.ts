import type { SessionTokenVerifier } from "../ports/session-token-verifier";

export class GetCurrentSessionQuery {
  constructor(readonly token: string | null) {}
}

export class GetCurrentSessionHandler {
  constructor(private readonly tokenVerifier: SessionTokenVerifier) {}

  async execute(query: GetCurrentSessionQuery) {
    if (!query.token) return null;

    const user = await this.tokenVerifier.verify(query.token);
    return user?.toPrimitives() ?? null;
  }
}
