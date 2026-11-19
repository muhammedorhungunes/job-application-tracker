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

  it("shows a stored salary without trailing .00 and defaults a new one to EUR per year", () => {
    const { unmount } = render(
      <ApplicationForm
        action={vi.fn()}
        application={{
          id: "app-1",
          position: "Dev",
          status: "APPLIED",
          source: null,
          url: null,
          appliedAt: null,
          notes: null,
          techStack: [],
          location: "Berlin",
          workMode: "REMOTE",
          salaryMin: "60000.00",
          salaryMax: "75000.50",
          salaryCurrency: "USD",
          salaryPeriod: "MONTH",
          createdAt: "2026-09-01T00:00:00.000Z",
          updatedAt: "2026-09-01T00:00:00.000Z",
          company: { id: "company-1", name: "Acme Inc" },
        }}
        submitLabel="Save changes"
      />,
    );

    expect(screen.getByLabelText("Location")).toHaveValue("Berlin");
    expect(screen.getByLabelText("Work mode")).toHaveValue("REMOTE");
    expect(screen.getByLabelText("From")).toHaveValue("60000");
    expect(screen.getByLabelText("To")).toHaveValue("75000.50");
    expect(screen.getByLabelText("Currency")).toHaveValue("USD");
    expect(screen.getByLabelText("Per")).toHaveValue("MONTH");
    unmount();

    render(<ApplicationForm action={vi.fn()} submitLabel="Add application" />);
    expect(screen.getByLabelText("Work mode")).toHaveValue("");
    expect(screen.getByLabelText("Currency")).toHaveValue("EUR");
    expect(screen.getByLabelText("Per")).toHaveValue("YEAR");
  });
});
