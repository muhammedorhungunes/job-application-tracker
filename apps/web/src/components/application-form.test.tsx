import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApplicationForm } from "./application-form";

describe("ApplicationForm", () => {
  it("pre-fills a new application from initialValues", () => {
    render(
      <ApplicationForm
        action={vi.fn()}
        initialValues={{ companyName: "Acme Inc", position: "Backend Engineer", techStack: "TypeScript, Go" }}
        submitLabel="Add application"
      />,
    );

    expect(screen.getByLabelText("Company")).toHaveValue("Acme Inc");
    expect(screen.getByLabelText("Position")).toHaveValue("Backend Engineer");
    expect(screen.getByLabelText("Tech stack")).toHaveValue("TypeScript, Go");
  });
});
