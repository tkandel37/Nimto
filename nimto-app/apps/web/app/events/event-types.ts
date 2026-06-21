export type UserEvent = {
  id: string;
  title: string;
  type: string;
  eventDate?: string | null;
  venue?: string | null;
  description?: string | null;
  coverImage?: string | null;
  slug: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  designVersion?: {
    id: string;
    versionNumber: number;
    status?: string;
    design?: { id: string; name: string; slug: string; status: string } | null;
  } | null;
  _count?: { invitees: number };
};

export type InvitationInvitee = {
  id: string;
  eventId: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
};

export type InviteeDraft = {
  name: string;
  status:
    | "Ready"
    | "Duplicate"
    | "Empty name"
    | "Invalid character"
    | "Too long";
};

export function formatEventDate(
  value?: string | null,
  prefix?: string,
) {
  if (!value) return "Not set";
  const formatted = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
  return prefix ? `${prefix} ${formatted}` : formatted;
}
