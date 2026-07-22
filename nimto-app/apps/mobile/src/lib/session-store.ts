import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "nimto_mobile_session";

export function getSessionToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export function setSessionToken(token: string) {
  return SecureStore.setItemAsync(TOKEN_KEY, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export function deleteSessionToken() {
  return SecureStore.deleteItemAsync(TOKEN_KEY);
}
