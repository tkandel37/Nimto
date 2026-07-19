import { Link, router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { Brand, Button, Card, Field, Screen, uiStyles } from "@/components/ui";
import { colors, spacing } from "@/lib/theme";
import { useAuth } from "@/providers/auth-provider";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || !password) return setError("Enter your email and password.");
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      router.replace("/(tabs)");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}>
      <Screen>
        <View style={styles.hero}>
          <Brand />
          <Text style={styles.title}>Welcome back</Text>
          <Text style={uiStyles.body}>Manage every invitation, guest, and response from your phone.</Text>
        </View>
        <Card>
          <Field autoCapitalize="none" autoComplete="email" keyboardType="email-address" label="Email" onChangeText={setEmail} value={email} />
          <Field autoCapitalize="none" autoComplete="current-password" label="Password" onChangeText={setPassword} onSubmitEditing={submit} secureTextEntry value={password} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button busy={busy} onPress={submit} title="Sign in" />
          <Link href="/(auth)/forgot" style={styles.link}>Forgot password?</Link>
        </Card>
        <Text style={styles.account}>New to myNimto? <Link href="/(auth)/register" style={styles.link}>Create an account</Link></Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.canvas },
  hero: { gap: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.md },
  title: { color: colors.ink, fontSize: 34, fontWeight: "900", letterSpacing: -1 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  link: { color: colors.plum, fontWeight: "800", textAlign: "center", padding: 5 },
  account: { color: colors.muted, textAlign: "center", marginTop: spacing.sm },
});
