import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Contact } from "@job-tracker/types";
import { ContactList } from "./contact-list";

function contact(overrides: Partial<Contact>): Contact {
  return {
    id: "con-1",
    name: "Jane Doe",
    role: null,
    email: null,
    phone: null,
    linkedinUrl: null,
    notes: null,
    createdAt: "2026-11-23T10:00:00.000Z",
    updatedAt: "2026-11-23T10:00:00.000Z",
    ...overrides,
  };
}

const actions = {
  createAction: vi.fn(),
  updateAction: () => vi.fn(),
  deleteAction: () => vi.fn(),
};

describe("ContactList", () => {
  it("shows each contact with mail, phone and LinkedIn links", () => {
    render(
      <ContactList
        contacts={[
          contact({
            id: "a",
            name: "Jane Doe",
            role: "Recruiter",
            email: "jane@acme.example",
            phone: "+49 30 1234",
            linkedinUrl: "https://www.linkedin.com/in/jane-doe",
            notes: "Met at a meetup",
          }),
          contact({ id: "b", name: "Bob" }),
        ]}
        {...actions}
      />,
    );

    const items = within(screen.getByRole("list", { name: "Contacts" })).getAllByRole("listitem");
    expect(items.map((item) => item.querySelector(".font-medium")?.textContent)).toEqual(["Jane Doe", "Bob"]);

    const jane = within(items[0]!);
    expect(jane.getByText("Recruiter")).toBeTruthy();
    expect(jane.getByRole("link", { name: "jane@acme.example" }).getAttribute("href")).toBe("mailto:jane@acme.example");
    expect(jane.getByRole("link", { name: "+49 30 1234" }).getAttribute("href")).toBe("tel:+49301234");
    const linkedin = jane.getByRole("link", { name: "LinkedIn" });
    expect(linkedin.getAttribute("href")).toBe("https://www.linkedin.com/in/jane-doe");
    expect(linkedin.getAttribute("rel")).toBe("noopener noreferrer");
    expect(jane.getByText("Met at a meetup", { selector: "p" })).toBeTruthy();

    // Bob has nothing but a name: no links.
    expect(within(items[1]!).queryAllByRole("link")).toHaveLength(0);
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(2);
  });

  it("shows an empty state but still offers to add one", () => {
    render(<ContactList contacts={[]} {...actions} />);

    expect(screen.getByText("No contacts yet.")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Contacts" })).toBeNull();
    expect(screen.getByText("Add a contact")).toBeTruthy();
  });
});
