import { ApplicationForm } from "@/components/application-form";
import { createApplication } from "../actions";

export default function NewApplicationPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">New application</h1>
      <ApplicationForm action={createApplication} submitLabel="Add application" />
    </>
  );
}
