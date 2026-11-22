import type { Contact } from "@job-tracker/types";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { ContactForm } from "@/components/contact-form";
import type { FormState } from "@/lib/form-state";

type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;

/** Server component; the per-contact actions are passed in as factories so this stays testable. */
export function ContactList({
  contacts,
  createAction,
  updateAction,
  deleteAction,
}: {
  /** Oldest first, as the API returns them. */
  contacts: Contact[];
  createAction: FormAction;
  updateAction: (contactId: string) => FormAction;
  deleteAction: (contactId: string) => () => Promise<void>;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <h2 className="font-medium">Contacts</h2>
      {contacts.length === 0 && <p className="text-sm text-muted-foreground">No contacts yet.</p>}
      {contacts.length > 0 && (
        <ul aria-label="Contacts" className="flex flex-col gap-2">
          {contacts.map((contact) => (
            <li key={contact.id} className="flex flex-col gap-2 rounded-md border border-border p-3 text-sm">
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-medium">{contact.name}</span>
                {contact.role && <span className="text-muted-foreground">{contact.role}</span>}
              </div>
              {(contact.email || contact.phone || contact.linkedinUrl) && (
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {contact.email && (
                    <a href={`mailto:${contact.email}`} className="underline underline-offset-2">
                      {contact.email}
                    </a>
                  )}
                  {contact.phone && (
                    <a href={`tel:${contact.phone.replace(/\s+/g, "")}`} className="underline underline-offset-2">
                      {contact.phone}
                    </a>
                  )}
                  {contact.linkedinUrl && (
                    <a
                      href={contact.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2"
                    >
                      LinkedIn
                    </a>
                  )}
                </div>
              )}
              {contact.notes && <p className="whitespace-pre-wrap text-muted-foreground">{contact.notes}</p>}
              <div className="flex items-start gap-2">
                <details className="flex-1">
                  <summary className="cursor-pointer text-xs text-muted-foreground">Edit</summary>
                  <div className="pt-3">
                    <ContactForm action={updateAction(contact.id)} contact={contact} submitLabel="Save" />
                  </div>
                </details>
                <ConfirmSubmitButton
                  action={deleteAction(contact.id)}
                  confirmMessage={`Remove ${contact.name} from this application?`}
                  label="Remove"
                  size="sm"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <details>
        <summary className="cursor-pointer text-sm font-medium">Add a contact</summary>
        <div className="pt-3">
          <ContactForm action={createAction} submitLabel="Add contact" />
        </div>
      </details>
    </section>
  );
}
