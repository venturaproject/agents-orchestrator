export type SessionUserProperties = {
  id: string;
  email: string;
};

export class SessionUser {
  readonly id: string;
  readonly email: string;

  constructor(properties: SessionUserProperties) {
    const id = properties.id.trim();
    const email = properties.email.trim().toLowerCase();
    if (!id || !email) {
      throw new Error("A session user requires an id and email.");
    }

    this.id = id;
    this.email = email;
  }

  toPrimitives(): SessionUserProperties {
    return { id: this.id, email: this.email };
  }
}
