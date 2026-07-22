import { Link, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { Brand, Button, Card, Field, PageHeader, Screen } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { colors } from "@/lib/theme";

export default function ForgotScreen() {
  const params = useLocalSearchParams<{ returnTo?: string; designVersionId?: string; designName?: string }>();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true); setError("");
    try {
      const response = await apiRequest<{ message?: string }>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: email.trim() }) });
      setMessage(response.message ?? "If the account exists, reset instructions have been sent.");
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "Could not submit request."); }
    finally { setBusy(false); }
  }
  return <Screen><Brand /><PageHeader eyebrow="Account recovery" title="Reset your password" detail="We will email a secure reset link if the account exists." /><Card><Field autoCapitalize="none" keyboardType="email-address" label="Email" onChangeText={setEmail} value={email} />{message ? <Text style={styles.success}>{message}</Text> : null}{error ? <Text style={styles.error}>{error}</Text> : null}<Button busy={busy} onPress={submit} title="Send reset instructions" /></Card><Link href={{ pathname: "/(auth)/login", params }} style={styles.link}>Back to sign in</Link><Link href="/(tabs)/designs" style={styles.link}>Continue browsing designs</Link></Screen>;
}
const styles = StyleSheet.create({ success: { color: colors.success, lineHeight: 20 }, error: { color: colors.danger }, link: { color: colors.plum, fontWeight: "800", textAlign: "center", padding: 5 } });
