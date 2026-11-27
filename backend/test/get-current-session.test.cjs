const { test } = require("node:test");
const assert = require("node:assert/strict");
const { SignJWT } = require("jose");
const {
  GetCurrentSessionHandler,
  GetCurrentSessionQuery,
} = require("../dist/application/auth/queries/get-current-session.query");
const { SessionUser } = require("../dist/domain/auth/entities/session-user");
const { JwtSessionTokenVerifier } = require("../dist/infrastructure/auth/jwt-session-token-verifier");
const { readSessionCookie } = require("../dist/infrastructure/http/auth/session-cookie");

test("session query returns null when no cookie token is provided", async () => {
  let verifierCalled = false;
  const handler = new GetCurrentSessionHandler({
    async verify() {
      verifierCalled = true;
      return null;
    },
  });

  assert.equal(await handler.execute(new GetCurrentSessionQuery(null)), null);
  assert.equal(verifierCalled, false);
});

test("session query maps a verified domain user to the API view", async () => {
  const handler = new GetCurrentSessionHandler({
    async verify(token) {
      assert.equal(token, "valid-token");
      return new SessionUser({ id: "user-1", email: "Crew@Example.test" });
    },
  });

  assert.deepEqual(await handler.execute(new GetCurrentSessionQuery("valid-token")), {
    id: "user-1",
    email: "crew@example.test",
  });
});

test("session query returns null when the token is invalid", async () => {
  const handler = new GetCurrentSessionHandler({ async verify() { return null; } });
  assert.equal(await handler.execute(new GetCurrentSessionQuery("invalid-token")), null);
});

test("cookie parser reads only the Crew session cookie", () => {
  assert.equal(readSessionCookie("other=first; crew_session=abc.def_ghi; theme=dark"), "abc.def_ghi");
  assert.equal(readSessionCookie("crew_session="), null);
  assert.equal(readSessionCookie("other=abc"), null);
});

test("JWT adapter verifies the existing HS256 session contract", async () => {
  const originalSecret = process.env.AUTH_SECRET;
  const secret = "unit-test-session-secret-that-is-at-least-32-chars";
  process.env.AUTH_SECRET = secret;

  try {
    const token = await new SignJWT({ email: "user@example.test" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-42")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode(secret));

    const verified = await new JwtSessionTokenVerifier().verify(token);
    assert.deepEqual(verified.toPrimitives(), { id: "user-42", email: "user@example.test" });
    assert.equal(await new JwtSessionTokenVerifier().verify(`${token}invalid`), null);
  } finally {
    if (originalSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = originalSecret;
  }
});
