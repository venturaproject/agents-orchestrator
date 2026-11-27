export const AUTH_USER_REPOSITORY = Symbol("AUTH_USER_REPOSITORY");

export type AuthUserRecord = {
  id: string;
  email: string;
  passwordHash: string;
};

export interface AuthUserRepository {
  findByEmail(email: string): Promise<AuthUserRecord | null>;
}
