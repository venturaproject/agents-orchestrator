const { test } = require("node:test");
const assert = require("node:assert/strict");
const { jwtVerify } = require("jose");
const { SessionUser } = require("../dist/domain/auth/entities/session-user");
const {
  LoginCommand,
  LoginHandler,
} = require("../dist/application/auth/commands/login.command");
const { JwtSessionTokenIssuer } = require("../dist/infrastructure/auth/jwt-session-token-issuer");
const { JwtSessionTokenVerifier } = require("../dist/infrastructure/auth/jwt-session-token-verifier");
const { ScryptPasswordVerifier } = require("../dist/infrastructure/auth/scrypt-password-verifier");
const {
  buildClearedSessionCookie,
  buildSessionCookie,
  isTrustedOrigin,
  readSessionCookie,
} = require("../dist/infrastructure/http/auth/session-cookie");

function withEnv(name, value, callback) {
  const old = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  return Promise.resolve().then(callback).finally(() => {
    if (old === undefined) delete process.env[name];
    else process.env[name] = old;
  });
}

test("JWT adapter preserves the existing HS256 subject/email session contract", async () => {
  const secret = "unit-test-session-secret-that-is-at-least-32-chars";
  await withEnv("AUTH_SECRET", secret, async () => {
    const user = new SessionUser({ id: "user-42", email: "User@Example.test" });
    const token = await new JwtSessionTokenIssuer().issue(user, false);
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    assert.equal(payload.sub, "user-42");
    assert.equal(payload.email, "user@example.test");
    assert.equal(payload.exp - payload.iat, 12 * 60 * 60);
    assert.deepEqual((await new JwtSessionTokenVerifier().verify(token)).toPrimitives(), {
      id: "user-42",
      email: "user@example.test",
    });
    assert.equal(await new JwtSessionTokenVerifier().verify(`${token}invalid`), null);
  });
});

test("remember-me keeps the compatible 30-day token and cookie lifetime", async () => {
  const secret = "unit-test-session-secret-that-is-at-least-32-chars";
  await withEnv("AUTH_SECRET", secret, async () => {
    const token = await new JwtSessionTokenIssuer().issue(
      new SessionUser({ id: "user-42", email: "user@example.test" }),
      true,
    );
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    assert.equal(payload.exp - payload.iat, 30 * 24 * 60 * 60);
    assert.match(buildSessionCookie(token, true), /Max-Age=2592000/);
  });
});

test("login handler looks up the existing account and issues a session after password verification", async () => {
  let lookedUpEmail;
  let issuedFor;
  const handler = new LoginHandler(
    { async findByEmail(email) {
      lookedUpEmail = email;
      return { id: "existing-user", email: "crew@example.test", passwordHash: "salt:hash" };
    } },
    { verify(password, hash) { return password === "correct" && hash === "salt:hash"; } },
    { async issue(user, rememberMe) {
      issuedFor = { user: user.toPrimitives(), rememberMe };
      return "signed-token";
    } },
  );

  const result = await handler.execute(new LoginCommand(" Crew@Example.test ", "correct", true));
  assert.equal(lookedUpEmail, "crew@example.test");
  assert.deepEqual(issuedFor, {
    user: { id: "existing-user", email: "crew@example.test" },
    rememberMe: true,
  });
  assert.deepEqual(result, {
    user: { id: "existing-user", email: "crew@example.test" },
    token: "signed-token",
  });
});

test("login handler rejects missing users and invalid passwords without issuing tokens", async () => {
  let issueCalled = false;
  const handler = new LoginHandler(
    { async findByEmail() { return null; } },
    { verify() { return false; } },
    { async issue() { issueCalled = true; return "token"; } },
  );
  assert.equal(await handler.execute(new LoginCommand("missing@example.test", "bad", false)), null);
  assert.equal(issueCalled, false);
});

test("scrypt verifier checks the stored salt:hex hash format safely", () => {
  const crypto = require("node:crypto");
  const salt = "existing-account-salt";
  const hash = crypto.scryptSync("correct horse", salt, 64).toString("hex");
  const verifier = new ScryptPasswordVerifier();
  assert.equal(verifier.verify("correct horse", `${salt}:${hash}`), true);
  assert.equal(verifier.verify("wrong", `${salt}:${hash}`), false);
  assert.equal(verifier.verify("correct horse", "malformed"), false);
});

test("cookie parsing, parent-domain sharing, and origin validation preserve browser protections", async () => {
  await withEnv("NODE_ENV", "production", async () => {
    await withEnv("SESSION_COOKIE_DOMAIN", ".prostiner.serv00.net", async () => {
      await withEnv("FRONTEND_ORIGIN", "https://demo.prostiner.serv00.net", async () => {
        const cookie = buildSessionCookie("abc.def_ghi", false);
        assert.match(cookie, /^crew_session=abc\.def_ghi;/);
        assert.match(cookie, /HttpOnly/);
        assert.match(cookie, /SameSite=Lax/);
        assert.match(cookie, /Secure/);
        assert.match(cookie, /Domain=\.prostiner\.serv00\.net/);
        assert.match(buildClearedSessionCookie(), /Max-Age=0/);
        assert.equal(readSessionCookie("other=first; crew_session=abc.def_ghi; theme=dark"), "abc.def_ghi");
        assert.equal(readSessionCookie("crew_session=%"), null);
        assert.equal(isTrustedOrigin("https://demo.prostiner.serv00.net"), true);
        assert.equal(isTrustedOrigin("https://attacker.invalid"), false);
      });
    });
  });
});
