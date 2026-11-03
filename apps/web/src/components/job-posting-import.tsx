"use client";

import { useEffect, useState } from "react";
import type { JobPostingExtraction } from "@job-tracker/types";
import { getJobPostingParse, requestJobPostingParse } from "@/app/applications/new/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 30;
const TIMEOUT_ERROR = "This is taking longer than expected. Please try again or fill in the form manually.";

/** Paste a posting, let the API extract it with Claude, and hand the result to the parent. */
export function JobPostingImport({ onExtracted }: { onExtracted: (extraction: JobPostingExtraction) => void }) {
  const [text, setText] = useState("");
  const [parseId, setParseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Polls while a parse is pending. The API answers with 202 and runs the
  // Claude call in a queue job, so there's nothing to await directly.
  useEffect(() => {
    if (!parseId) return;
    let cancelled = false;
    let polls = 0;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      polls += 1;
      const result = await getJobPostingParse(parseId);
      if (cancelled) return;

      if (result.error !== undefined) {
        setError(result.error);
        setParseId(null);
      } else if (result.parse.status === "COMPLETED" && result.parse.result) {
        onExtracted(result.parse.result);
        setParseId(null);
      } else if (result.parse.status === "FAILED") {
        setError(result.parse.errorMessage ?? TIMEOUT_ERROR);
        setParseId(null);
      } else if (polls >= MAX_POLLS) {
        setError(TIMEOUT_ERROR);
        setParseId(null);
      } else {
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    timer = setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [parseId, onExtracted]);

  const handleExtract = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const result = await requestJobPostingParse(text);
      if (result.error !== undefined) {
        setError(result.error);
      } else {
        setParseId(result.parse.id);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const busy = submitting || parseId !== null;

  return (
    <section className="flex w-full max-w-xl flex-col gap-2 rounded-md border border-border p-4">
      <label htmlFor="jobPosting" className="text-sm font-medium">
        Paste a job posting to fill the form
      </label>
      <Textarea
        id="jobPosting"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Paste the full posting text here"
        rows={6}
        disabled={busy}
      />
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={handleExtract} disabled={busy || text.trim().length === 0}>
          {busy ? "Extracting..." : "Extract with AI"}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
