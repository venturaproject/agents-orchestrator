export const PASSWORD_VERIFIER = Symbol("PASSWORD_VERIFIER");

export interface PasswordVerifier {
  verify(password: string, encodedHash: string): boolean;
}
