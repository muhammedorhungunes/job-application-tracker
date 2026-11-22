import { describe, expect, it } from "vitest";
import { parseCreateContactForm, parseUpdateContactForm } from "./contact";

function formData(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("parseCreateContactForm", () => {
  it("trims values and leaves out empty optional fields", () => {
    const parsed = parseCreateContactForm(
      formData({ name: " Jane Doe ", role: "Recruiter", email: "", phone: "  ", linkedinUrl: "", notes: "" }),
    );

    expect(parsed.success && parsed.data).toEqual({ name: "Jane Doe", role: "Recruiter" });
  });

  it("requires a name", () => {
    const parsed = parseCreateContactForm(formData({ name: "  " }));

    expect(parsed.success).toBe(false);
    expect(!parsed.success && parsed.error.flatten().fieldErrors.name).toBeDefined();
  });

  it("rejects an invalid e-mail and a non-web LinkedIn link", () => {
    const parsed = parseCreateContactForm(
      formData({ name: "Jane", email: "jane-at-acme", linkedinUrl: "javascript:alert(1)" }),
    );

    expect(!parsed.success && Object.keys(parsed.error.flatten().fieldErrors).sort()).toEqual([
      "email",
      "linkedinUrl",
    ]);
  });
});

describe("parseUpdateContactForm", () => {
  it("sends every field, with empty optional fields as null", () => {
    const parsed = parseUpdateContactForm(
      formData({ name: "Jane", role: "", email: "jane@acme.example", phone: "", linkedinUrl: "", notes: "" }),
    );

    expect(parsed.success && parsed.data).toEqual({
      name: "Jane",
      role: null,
      email: "jane@acme.example",
      phone: null,
      linkedinUrl: null,
      notes: null,
    });
  });
});
