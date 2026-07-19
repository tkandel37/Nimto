import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { Brand, Button, Card, Field, PageHeader, Screen } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { colors } from "@/lib/theme";

export default function VerifyScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? "");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function verify() {
    setBusy(true); setError(""); setMessage("");
    try {
      await apiRequest("/auth/verify-email", { method: "POST", body: JSON.stringify({ email: email.trim(), code: code.trim() }) });
      router.replace("/(auth)/login");
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "Could not verify."); }
    finally { setBusy(false); }
  }

  async function resend() {
    setError("");
    try {
      await apiRequest("/auth/verify-email/resend", { method: "POST", body: JSON.stringify({ email: email.trim() }) });
      setMessage("A new verification code has been sent.");
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "Could not resend code."); }
  }

  return <Screen>
    <Brand />
    <PageHeader eyebrow="Email verification" title="Check your inbox" detail="Enter the six-digit code sent to your email." />
    <Card>
      <Field autoCapitalize="none" keyboardType="email-address" label="Email" onChangeText={setEmail} value={email} />
      <Field keyboardType="number-pad" label="Verification code" maxLength={6} onChangeText={setCode} value={code} />
      {message ? <Text style={styles.success}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button busy={busy} onPress={verify} title="Verify email" />
      <Button onPress={resend} title="Send a new code" variant="secondary" />
    </Card>
  </Screen>;
}

const styles = StyleSheet.create({ success: { color: colors.success }, error: { color: colors.danger } });
