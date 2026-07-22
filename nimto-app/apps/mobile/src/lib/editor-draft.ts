import AsyncStorage from "@react-native-async-storage/async-storage";
import { InvitationFeatureSettings } from "@/lib/types";

const DRAFT_PREFIX = "nimto_mobile_invitation_draft_v1";

export type StoredInvitationEditorDraft = {
  version: 1;
  eventId: string;
  designVersionId: string;
  values: Record<string, string>;
  featureSettings: InvitationFeatureSettings;
  savedAt: string;
};

export async function loadInvitationEditorDraft(eventId: string) {
  const raw = await AsyncStorage.getItem(draftKey(eventId));
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw) as Partial<StoredInvitationEditorDraft>;
    if (
      draft.version !== 1 ||
      draft.eventId !== eventId ||
      !draft.designVersionId ||
      !draft.values ||
      typeof draft.values !== "object" ||
      !draft.featureSettings ||
      typeof draft.featureSettings !== "object" ||
      !draft.savedAt
    ) {
      await clearInvitationEditorDraft(eventId);
      return null;
    }
    return draft as StoredInvitationEditorDraft;
  } catch {
    await clearInvitationEditorDraft(eventId);
    return null;
  }
}

export function saveInvitationEditorDraft(draft: StoredInvitationEditorDraft) {
  return AsyncStorage.setItem(draftKey(draft.eventId), JSON.stringify(draft));
}

export function clearInvitationEditorDraft(eventId: string) {
  return AsyncStorage.removeItem(draftKey(eventId));
}

export async function clearAllInvitationEditorDrafts() {
  const keys = (await AsyncStorage.getAllKeys()).filter((key) =>
    key.startsWith(`${DRAFT_PREFIX}:`),
  );
  if (keys.length) await AsyncStorage.multiRemove(keys);
}

function draftKey(eventId: string) {
  return `${DRAFT_PREFIX}:${eventId}`;
}
