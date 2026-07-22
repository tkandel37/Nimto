import { createElement } from "react";
import { StyleProp, StyleSheet, ViewStyle } from "react-native";

export function InvitationPreview({
  html,
  scrollEnabled = true,
  style,
  title = "Invitation preview",
}: {
  html: string;
  scrollEnabled?: boolean;
  style?: StyleProp<ViewStyle>;
  title?: string;
}) {
  const flattened = StyleSheet.flatten(style) ?? {};
  return createElement("iframe", {
    sandbox: "",
    scrolling: scrollEnabled ? "auto" : "no",
    srcDoc: html,
    title,
    style: {
      border: 0,
      display: "block",
      height: "100%",
      width: "100%",
      ...flattened,
      overflow: scrollEnabled ? "auto" : "hidden",
    },
  });
}
