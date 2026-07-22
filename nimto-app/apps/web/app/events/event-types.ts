export type RsvpFieldType =
  | "single_choice"
  | "multiple_choice"
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "email"
  | "phone";

export type RsvpFieldConfig = {
  id: string;
  key: string;
  label: string;
  type: RsvpFieldType;
  required: boolean;
  enabled: boolean;
  builtIn?: boolean;
  options?: string[];
  placeholder?: string | null;
};

export type RsvpConfig = {
  note: string;
  closedMessage: string;
  fields: RsvpFieldConfig[];
};

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
  archivedAt?: string | null;
  openCount?: number;
  firstOpenedAt?: string | null;
  lastOpenedAt?: string | null;
  rsvpDeadline?: string | null;
  organizerNotes?: string | null;
  checklist?: Record<string, boolean> | null;
  featureSettings?: Record<string, unknown> | null;
  draftFeatureSettings?: Record<string, unknown> | null;
  rsvpConfig?: Record<string, unknown> | null;
  designFieldValues?: Record<string, unknown> | null;
  draftDesignVersionId?: string | null;
  draftDesignFieldValues?: Record<string, unknown> | null;
  draftSavedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  designVersion?: {
    id: string;
    versionNumber: number;
    status?: string;
    rawHtml?: string;
    featureConfig?: Record<string, unknown> | null;
    scanResult?: {
      fields?: {
        key: string;
        label: string;
        type: string;
        required?: boolean;
        locked?: boolean;
        paid?: boolean;
      }[];
      linkableFieldKeys?: string[];
      styleSlots?: {
        key: string;
        label?: string;
        type?: string;
        defaultValue?: string;
      }[];
      capabilities?: Record<string, boolean>;
    } | null;
    design?: { id: string; name: string; slug: string; status: string } | null;
  } | null;
  draftDesignVersion?: {
    id: string;
    versionNumber: number;
    rawHtml: string;
    featureConfig?: Record<string, unknown> | null;
    scanResult?: UserEvent["designVersion"] extends infer T
      ? T extends { scanResult?: infer S }
        ? S
        : never
      : never;
    design?: { id: string; name: string; slug: string; status: string } | null;
  } | null;
  _count?: { invitees: number };
};

export type InvitationInvitee = {
  id: string;
  eventId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  groupName?: string | null;
  organizerNotes?: string | null;
  slug: string;
  createdAt: string;
  updatedAt: string;
  firstOpenedAt?: string | null;
  lastOpenedAt?: string | null;
  openCount: number;
  rsvpStatus: "PENDING" | "ATTENDING" | "DECLINED";
  partySize?: number | null;
  mealPreference?: string | null;
  rsvpMessage?: string | null;
  rsvpAnswers?: Record<string, unknown> | null;
  respondedAt?: string | null;
  linkDisabledAt?: string | null;
  linkExpiresAt?: string | null;
  lastSharedAt?: string | null;
  lastShareChannel?: string | null;
};

export type EventStatistics = {
  totalInvitees: number;
  totalResponses?: number;
  invitationOpens: number;
  openedInvitees: number;
  pending: number;
  attending: number;
  declined: number;
  expectedGuests: number;
  unopenedInvitees: number;
  responseRate: number;
  publicResponses?: number;
  lastResponseAt?: string | null;
  mealTotals: { meal: string; count: number }[];
};

export type EventRsvpResponse = {
  id: string;
  eventId: string;
  status: "PENDING" | "ATTENDING" | "DECLINED";
  answers: Record<string, unknown>;
  guestCount?: number | null;
  submittedAt: string;
};

export type EventActivity = {
  id: string;
  type: string;
  summary: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  invitee?: { id: string; name: string } | null;
};

export type EventDesignRevision = {
  id: string;
  fieldValues: Record<string, unknown>;
  featureSettings?: Record<string, unknown> | null;
  label?: string | null;
  createdAt: string;
  designVersion: {
    id: string;
    versionNumber: number;
    design: { id: string; name: string };
  };
};

export type InviteeDraft = {
  name: string;
  status:
    "Ready" | "Duplicate" | "Empty name" | "Invalid character" | "Too long";
};

export function formatEventDate(value?: string | null, prefix?: string) {
  if (!value) return "Not set";
  const formatted = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
  return prefix ? `${prefix} ${formatted}` : formatted;
}
