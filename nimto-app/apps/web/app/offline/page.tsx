import Image from "next/image";
import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="pwa-offline-page">
      <div className="pwa-offline-brand" aria-label="myNimto">
        <Image
          src="/brand/mynimto-logo.webp"
          alt=""
          width={56}
          height={56}
          unoptimized
        />
        <strong>myNimto</strong>
      </div>
      <section>
        <p className="site-kicker">Connection unavailable</p>
        <h1>We couldn&apos;t reach myNimto</h1>
        <p>
          The internet connection or myNimto server may be temporarily
          unavailable. Check your connection, then try again.
        </p>
        <Link className="site-button-primary" href="/events">
          Try again
        </Link>
      </section>
    </main>
  );
}
