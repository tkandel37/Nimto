# myNimto mobile and Expo PWA

The myNimto host application for Android, iOS, and the web, built with Expo,
React Native, Expo Router, and TypeScript.

## Included host workflows

- Email/password login using a revocable API session. Native builds use the
  platform Keychain/Keystore; the PWA uses browser app storage.
- Registration, email OTP verification, password recovery, and logout.
- Dashboard summaries, event search, design catalogue, and event creation.
- A complete invitation editor with event details, template fields, design
  switching, template-approved features, themes, links, live preview, manual
  save, autosave, on-device recovery, required-field validation, publishing,
  and revision restore.
- Private design and feature drafts that do not alter the public invitation
  until the host publishes them.
- Safe versioned HTML invitation previews with executable JavaScript disabled,
  using native WebView on mobile and sandboxed iframes on the web.
- Invitee creation, personalized invitation links, RSVP state, and native
  sharing.
- Expo development builds and EAS development, preview, staging, and
  production channels, plus a static installable web/PWA export with an
  offline fallback.

The staff/admin interface remains in the Next.js application. Public guests
continue to use web invitation links and do not need to install the app.

## Local setup

Use Node.js 20.19.4 or newer from the repository root:

```bash
npm install
cp apps/mobile/.env.example apps/mobile/.env.local
npm run mobile:start
```

For a physical device, set `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_WEB_URL` to
addresses the device can reach. `localhost` works for the iOS simulator; the
Android emulator normally uses `http://10.0.2.2:4000` for the host machine.

Run the Expo web/PWA locally with:

```bash
npm run mobile:web
```

Development builds are required for production-parity testing:

```bash
cd apps/mobile
npx eas-cli build --profile development --platform all
```

## Verification

```bash
npm run typecheck --workspace @nimto/mobile
npm run lint --workspace @nimto/mobile
npm run export --workspace @nimto/mobile
```

See `docs/mobile-release.md` for EAS project linking, OTA promotion, rollback,
store submission, and universal-link setup.

This editor release adds `@react-native-async-storage/async-storage`, a native
module used for crash/offline draft recovery. It therefore requires a new iOS
and Android binary with an incremented app version; it must not be shipped as
an OTA-only update to an older binary.
