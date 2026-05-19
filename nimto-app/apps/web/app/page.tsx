import Link from "next/link";

export default function Home() {
  return (
    <main className="auth-shell">
      <section className="preview-panel">
        <div className="invitation-preview">
          <div className="flex h-full flex-col justify-between border border-ink/15 p-8 text-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.35em] text-rose">
                Nimto
              </p>
              <h1 className="mt-8 text-5xl font-black leading-tight text-ink">
                Digital invitations for every beautiful moment.
              </h1>
            </div>
            <div className="mx-auto max-w-sm">
              <p className="text-lg leading-8 text-ink/75">
                Register, log in, and confirm that Vercel, Render, and Supabase
                are connected before we build the full product.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs font-bold uppercase tracking-wide text-ink/70">
              <span>Weddings</span>
              <span>RSVP</span>
              <span>Nepali</span>
            </div>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="form-card">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-leaf">
            Deployment test
          </p>
          <h2 className="mt-4 text-4xl font-black text-ink">
            Start your Nimto account
          </h2>
          <p className="mt-4 text-base leading-7 text-ink/70">
            Create an account with your name, email, and password. The backend
            stores it in Supabase with a hashed password and returns a JWT.
          </p>
          <div className="mt-8 grid gap-3">
            <Link
              href="/auth?mode=register"
              className="rounded-xl bg-ink px-5 py-4 text-center font-bold text-white"
            >
              Create account
            </Link>
            <Link
              href="/auth?mode=login"
              className="rounded-xl border border-ink/20 bg-white px-5 py-4 text-center font-bold text-ink"
            >
              Log in
            </Link>
          </div>
          <div className="mt-8 rounded-2xl border border-ink/10 bg-white/70 p-5">
            <p className="text-sm font-bold text-ink">Connection path</p>
            <p className="mt-2 text-sm leading-6 text-ink/65">
              Browser on Vercel {"->"} Nest API on Render {"->"} PostgreSQL on Supabase
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
