import { router } from "expo-router";
import { Button, EmptyState, Screen } from "@/components/ui";

export default function OfflineScreen() {
  return (
    <Screen>
      <EmptyState
        action={
          <Button
            onPress={() => router.replace("/(tabs)/designs")}
            title="Try again"
          />
        }
        detail="Reconnect to load your events, save invitation changes, and publish. Draft edits already saved on this device remain available."
        title="You are offline"
      />
    </Screen>
  );
}
