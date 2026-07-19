# myNimto mobile

The myNimto host application for Android and iOS, built with Expo, React
Native, Expo Router, and TypeScript.

## Included host workflows

- Secure email/password login using a revocable API session stored in the
  platform Keychain/Keystore.
- Registration, email OTP verification, password recovery, and logout.
- Dashboard summaries, event search, design catalogue, and event creation.
- Event detail editing and template-field editing.
- Safe versioned HTML invitation previews with executable JavaScript disabled.
- Invitee creation, personalized invitation links, RSVP state, and native
  sharing.
- Expo development builds and EAS development, preview, staging, and
  production channels.

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
