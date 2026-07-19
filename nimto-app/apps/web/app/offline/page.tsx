import Link from "next/link";
import { BrandLogo } from "../brand-logo";

export default function OfflinePage() {
  return (
    <main className="pwa-offline-page">
      <BrandLogo />
      <section>
        <p className="site-kicker">You are offline</p>
        <h1>Reconnect to continue</h1>
        <p>
          myNimto protects event and guest information by loading it directly
          from your account. Check your connection, then try again.
        </p>
        <Link className="site-button-primary" href="/events">
          Try again
        </Link>
      </section>
    </main>
  );
}
