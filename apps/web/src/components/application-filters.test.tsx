import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApplicationFilters } from "./application-filters";

describe("ApplicationFilters", () => {
  it("is a GET form back to the board", () => {
    render(<ApplicationFilters filters={{}} techOptions={[]} />);

    const form = screen.getByRole("search", { name: "Filter applications" });
    expect(form.getAttribute("method")).toBe("get");
    expect(form.getAttribute("action")).toBe("/applications");
    expect(screen.getByRole("link", { name: "Clear" }).getAttribute("href")).toBe("/applications");
  });

  it("prefills inputs from the current filters", () => {
    render(
      <ApplicationFilters
        filters={{ q: "acme", status: ["OFFER"], tech: "Go", workMode: "REMOTE", from: "2026-11-01", to: "2026-11-30" }}
        techOptions={["Go", "React"]}
      />,
    );

    expect(screen.getByRole<HTMLInputElement>("searchbox", { name: "Search" }).value).toBe("acme");
    expect(screen.getByRole<HTMLSelectElement>("combobox", { name: "Tech" }).value).toBe("Go");
    expect(screen.getByRole<HTMLSelectElement>("combobox", { name: "Work mode" }).value).toBe("REMOTE");
    expect(screen.getByLabelText<HTMLInputElement>("Applied from").value).toBe("2026-11-01");
    expect(screen.getByLabelText<HTMLInputElement>("Applied to").value).toBe("2026-11-30");
    expect(screen.getByRole<HTMLInputElement>("checkbox", { name: "Offer" }).checked).toBe(true);
    expect(screen.getByRole<HTMLInputElement>("checkbox", { name: "Applied" }).checked).toBe(false);
  });

  it("offers 'Any' plus each tech option, keeping a selected value that's no longer listed", () => {
    render(<ApplicationFilters filters={{ tech: "Elixir" }} techOptions={["Go", "React"]} />);

    const tech = screen.getByRole<HTMLSelectElement>("combobox", { name: "Tech" });
    const options = within(tech).getAllByRole<HTMLOptionElement>("option").map((option) => option.textContent);
    expect(options).toEqual(["Any", "Elixir", "Go", "React"]);
    expect(tech.value).toBe("Elixir");
  });

  it("offers 'Any' plus each work mode, defaulting to 'Any'", () => {
    render(<ApplicationFilters filters={{}} techOptions={[]} />);

    const workMode = screen.getByRole<HTMLSelectElement>("combobox", { name: "Work mode" });
    const options = within(workMode).getAllByRole<HTMLOptionElement>("option").map((option) => option.textContent);
    expect(options).toEqual(["Any", "On-site", "Hybrid", "Remote"]);
    expect(workMode.value).toBe("");
  });
});
