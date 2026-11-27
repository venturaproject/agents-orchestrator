import { describe, expect, it } from "vitest";
import { messages } from "../lib/translations";

describe("UI translations", () => {
  it("keeps English and Spanish dictionaries in sync", () => {
    expect(Object.keys(messages.en).sort()).toEqual(Object.keys(messages.es).sort());
  });

  it("provides non-empty values for every supported locale", () => {
    for (const locale of [messages.en, messages.es]) {
      for (const value of Object.values(locale)) {
        expect(value.trim()).not.toBe("");
      }
    }
  });
});
