import { scryptSync, timingSafeEqual } from "node:crypto";
import type { PasswordVerifier } from "../../application/auth/ports/password-verifier";

export class ScryptPasswordVerifier implements PasswordVerifier {
  verify(password: string, encodedHash: string): boolean {
    const separator = encodedHash.indexOf(":");
    if (separator <= 0 || password.length > 200) return false;

    const salt = encodedHash.slice(0, separator);
    const expectedHex = encodedHash.slice(separator + 1);
    if (!/^[a-f0-9]{128}$/i.test(expectedHex)) return false;

    const actual = scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
