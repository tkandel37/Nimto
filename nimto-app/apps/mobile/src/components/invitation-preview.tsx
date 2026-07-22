import { StyleProp, ViewStyle } from "react-native";
import { WebView } from "react-native-webview";

export function InvitationPreview({
  html,
  scrollEnabled = true,
  style,
}: {
  html: string;
  scrollEnabled?: boolean;
  style?: StyleProp<ViewStyle>;
  title?: string;
}) {
  return (
    <WebView
      allowFileAccess={false}
      javaScriptEnabled={false}
      originWhitelist={["about:blank"]}
      scrollEnabled={scrollEnabled}
      source={{ html }}
      style={style}
    />
  );
}
