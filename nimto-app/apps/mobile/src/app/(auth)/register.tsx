import { Link, router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { Brand, Button, Card, Field, PageHeader, Screen } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { colors } from "@/lib/theme";

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true); setError("");
    try {
      const response = await apiRequest<{ email: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), password }),
      });
      router.push({ pathname: "/(auth)/verify", params: { email: response.email } });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not register.");
    } finally { setBusy(false); }
  }

  return <Screen>
    <Brand />
    <PageHeader eyebrow="Create account" title="Start inviting beautifully" detail="Your account works on mobile, PWA, and the myNimto website." />
    <Card>
      <Field autoComplete="name" label="Full name" onChangeText={setName} value={name} />
      <Field autoCapitalize="none" autoComplete="email" keyboardType="email-address" label="Email" onChangeText={setEmail} value={email} />
      <Field autoCapitalize="none" autoComplete="new-password" label="Password" onChangeText={setPassword} secureTextEntry value={password} />
      <Text style={styles.help}>Use at least 12 characters with uppercase, lowercase, a number, and a symbol.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button busy={busy} onPress={submit} title="Create account" />
    </Card>
    <Text style={styles.center}>Already registered? <Link href="/(auth)/login" style={styles.link}>Sign in</Link></Text>
  </Screen>;
}

const styles = StyleSheet.create({
  help: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13 },
  center: { color: colors.muted, textAlign: "center" },
  link: { color: colors.plum, fontWeight: "800" },
});
