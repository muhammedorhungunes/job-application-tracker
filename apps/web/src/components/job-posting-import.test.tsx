import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getJobPostingParse, requestJobPostingParse } from "@/app/applications/new/actions";
import { JobPostingImport, POLL_INTERVAL_MS } from "./job-posting-import";

// The real module is a server action file that imports next/headers.
vi.mock("@/app/applications/new/actions", () => ({
  requestJobPostingParse: vi.fn(),
  getJobPostingParse: vi.fn(),
}));

const extraction = {
  companyName: "Acme Inc",
  position: "Backend Engineer",
  techStack: ["TypeScript"],
  location: null,
  url: null,
};

const parse = (status: "PENDING" | "COMPLETED" | "FAILED", extra: Record<string, unknown> = {}) => ({
  id: "parse-1",
  status,
  result: null,
  errorMessage: null,
  createdAt: "2026-11-04T10:00:00.000Z",
  ...extra,
});

async function pasteAndExtract() {
  fireEvent.change(screen.getByLabelText(/paste a job posting/i), { target: { value: "A long job posting text" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /extract with ai/i }));
  });
}

describe("JobPostingImport", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("polls until the parse completes and hands the extraction to the parent", async () => {
    vi.mocked(requestJobPostingParse).mockResolvedValue({ parse: parse("PENDING") });
    vi.mocked(getJobPostingParse)
      .mockResolvedValueOnce({ parse: parse("PENDING") })
      .mockResolvedValueOnce({ parse: parse("COMPLETED", { result: extraction }) });
    const onExtracted = vi.fn();
    render(<JobPostingImport onExtracted={onExtracted} />);

    await pasteAndExtract();
    expect(requestJobPostingParse).toHaveBeenCalledWith("A long job posting text");
    expect(screen.getByRole("button", { name: /extracting/i })).toBeDisabled();

    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));
    expect(onExtracted).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));
    expect(getJobPostingParse).toHaveBeenCalledTimes(2);
    expect(onExtracted).toHaveBeenCalledWith(extraction);
    expect(screen.getByRole("button", { name: /extract with ai/i })).toBeEnabled();
  });

  it("shows the API's message when the parse failed", async () => {
    vi.mocked(requestJobPostingParse).mockResolvedValue({ parse: parse("PENDING") });
    vi.mocked(getJobPostingParse).mockResolvedValue({
      parse: parse("FAILED", { errorMessage: "Couldn't read this posting." }),
    });
    const onExtracted = vi.fn();
    render(<JobPostingImport onExtracted={onExtracted} />);

    await pasteAndExtract();
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't read this posting.");
    expect(onExtracted).not.toHaveBeenCalled();
  });

  it("shows a validation error from the request without polling", async () => {
    vi.mocked(requestJobPostingParse).mockResolvedValue({ error: "Paste the full posting" });
    render(<JobPostingImport onExtracted={vi.fn()} />);

    await pasteAndExtract();
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));

    expect(screen.getByRole("alert")).toHaveTextContent("Paste the full posting");
    expect(getJobPostingParse).not.toHaveBeenCalled();
  });
});
