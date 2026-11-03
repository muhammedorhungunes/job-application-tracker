import { describe, expect, it } from "vitest";
import { extractionToFormValues } from "./job-posting";

const base = {
  companyName: "Acme Inc",
  position: "Backend Engineer",
  techStack: ["TypeScript", "PostgreSQL"],
  location: null,
  url: null,
};

describe("extractionToFormValues", () => {
  it("maps company, position and tech stack", () => {
    expect(extractionToFormValues(base)).toEqual({
      companyName: "Acme Inc",
      position: "Backend Engineer",
      techStack: "TypeScript, PostgreSQL",
    });
  });

  it("keeps an http(s) URL and puts the location into notes", () => {
    const values = extractionToFormValues({ ...base, url: "https://acme.example/jobs/1", location: "Remote (EU)" });

    expect(values.url).toBe("https://acme.example/jobs/1");
    expect(values.notes).toBe("Location: Remote (EU)");
  });

  it("drops a URL that isn't http(s)", () => {
    expect(extractionToFormValues({ ...base, url: "acme.example/jobs" }).url).toBeUndefined();
  });
});
