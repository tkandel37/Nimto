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
  section?: string;
  required?: boolean;
  locked?: boolean;
  paid?: boolean;
  editableByUser?: boolean;
  defaultValue?: string;
  placeholder?: string;
};

export type StyleSlot = {
  key: string;
  label?: string;
  type?: string;
  defaultValue?: string;
};

export type DesignScanResult = {
  fields?: TemplateField[];
  linkableFieldKeys?: string[];
  styleSlots?: StyleSlot[];
  capabilities?: Record<string, boolean>;
};

export type FeatureToggle = {
  available?: boolean;
  defaultEnabled?: boolean;
};

export type InvitationFeatureConfig = {
  countdown?: FeatureToggle & { position?: "top" | "middle" | "bottom" };
  rsvp?: FeatureToggle;
  music?: FeatureToggle;
  additionalInfo?: FeatureToggle;
  openingAnimation?: FeatureToggle;
  theme?: FeatureToggle;
  sharePreview?: FeatureToggle;
  print?: FeatureToggle;
  links?: FeatureToggle;
};

export type InvitationLinkSetting = {
  fieldKey: string;
  url: string;
  hoverText?: string;
};

export type InvitationFeatureSettings = {
  countdown?: { enabled?: boolean };
  rsvp?: { enabled?: boolean };
  music?: { enabled?: boolean; url?: string };
  additionalInfo?: { enabled?: boolean; text?: string };
  openingAnimation?: { enabled?: boolean };
  links?: InvitationLinkSetting[];
  theme?: Record<string, string>;
  sharePreview?: {
    title?: string;
    description?: string;
    imageUrl?: string;
  };
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
    scanResult?: DesignScanResult | null;
    featureConfig?: InvitationFeatureConfig | null;
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
  featureSettings?: InvitationFeatureSettings | null;
  draftFeatureSettings?: InvitationFeatureSettings | null;
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
    scanResult?: DesignScanResult | null;
    featureConfig?: InvitationFeatureConfig | null;
    design?: { id: string; name: string; slug: string } | null;
  } | null;
  draftDesignVersion?: {
    id: string;
    versionNumber: number;
    rawHtml: string;
    scanResult?: DesignScanResult | null;
    featureConfig?: InvitationFeatureConfig | null;
    design?: { id: string; name: string; slug: string } | null;
  } | null;
  _count?: { invitees: number };
};

export type EventDesignRevision = {
  id: string;
  featureSettings?: InvitationFeatureSettings | null;
  fieldValues: Record<string, unknown>;
  label?: string | null;
  createdAt: string;
  designVersion: {
    id: string;
    versionNumber: number;
    design: { id: string; name: string };
  };
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
