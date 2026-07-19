export type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  roles?: string[];
  permissions?: string[];
  createdAt: string;
};

export type AuthResponse = { token: string; user: AuthUser };

export type TemplateField = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  locked?: boolean;
  paid?: boolean;
};

export type PublicCategory = {
  id: string;
  name: string;
  slug: string;
};

export type PublicDesign = {
  id: string;
  name: string;
  slug: string;
  category?: PublicCategory | null;
  subcategory?: PublicCategory | null;
  versions: {
    id: string;
    versionNumber: number;
    rawHtml: string;
    thumbnailHtml?: string | null;
    scanResult?: { fields?: TemplateField[] } | null;
  }[];
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
  designFieldValues?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  designVersion?: {
    id: string;
    versionNumber: number;
    rawHtml?: string;
    scanResult?: { fields?: TemplateField[] } | null;
    design?: { id: string; name: string; slug: string } | null;
  } | null;
  _count?: { invitees: number };
};

export type Invitee = {
  id: string;
  eventId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  groupName?: string | null;
  slug: string;
  openCount: number;
  rsvpStatus: "PENDING" | "ATTENDING" | "DECLINED";
  partySize?: number | null;
  linkDisabledAt?: string | null;
  lastSharedAt?: string | null;
};

export type EventStatistics = {
  totalInvitees: number;
  invitationOpens: number;
  openedInvitees: number;
  pending: number;
  attending: number;
  declined: number;
  expectedGuests: number;
  responseRate: number;
};
