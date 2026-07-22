import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "nimto_mobile_session";

export function getSessionToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export function setSessionToken(token: string) {
  return AsyncStorage.setItem(TOKEN_KEY, token);
}

export function deleteSessionToken() {
  return AsyncStorage.removeItem(TOKEN_KEY);
}
