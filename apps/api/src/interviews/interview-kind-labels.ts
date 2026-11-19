import type { InterviewKind } from "@prisma/client";

export const KIND_LABELS: Record<InterviewKind, string> = {
  PHONE: "Phone interview",
  TECHNICAL: "Technical interview",
  ONSITE: "Onsite interview",
  OTHER: "Interview",
};
