import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-paper text-navy p-8">
      <main className="max-w-4xl text-center flex flex-col items-center">
        <h1 className="text-7xl font-extrabold mb-4 text-gold tracking-[0.2em]">NIMTO</h1>
        <div className="w-24 h-1 bg-gold/30 mb-8 rounded-full"></div>
        <p className="text-2xl mb-12 text-navy/70 leading-relaxed font-light italic">
          "The most elegant way to invite your loved ones."
        </p>
        <div className="flex flex-col sm:flex-row gap-6 justify-center">
          <Link
            href="/dashboard"
            className="bg-navy text-white px-12 py-5 rounded-full font-bold text-xl shadow-2xl shadow-navy/30 hover:bg-gold hover:scale-105 transition-all duration-300"
          >
            Enter Dashboard
          </Link>
          <a
            href="https://github.com/tkandel37/Nimto"
            target="_blank"
            rel="noopener noreferrer"
            className="border-2 border-navy/20 px-12 py-5 rounded-full font-bold text-xl hover:bg-navy/5 transition-all duration-300"
          >
            GitHub Repository
          </a>
        </div>
        
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-12 text-left border-t border-navy/10 pt-16">
          <div>
            <span className="text-3xl mb-4 block">✨</span>
            <h4 className="font-bold text-lg mb-2">Premium Designs</h4>
            <p className="text-sm text-navy/60">Beautiful templates for weddings, birthdays, and special events.</p>
          </div>
          <div>
            <span className="text-3xl mb-4 block">📱</span>
            <h4 className="font-bold text-lg mb-2">Instant Sharing</h4>
            <p className="text-sm text-navy/60">Share via WhatsApp, Messenger, or email with one click.</p>
          </div>
          <div>
            <span className="text-3xl mb-4 block">📍</span>
            <h4 className="font-bold text-lg mb-2">Smart Features</h4>
            <p className="text-sm text-navy/60">Google Maps integration, RSVP tracking, and QR code support.</p>
          </div>
        </div>
      </main>
      
      <footer className="mt-24 text-navy/30 text-xs tracking-widest uppercase py-8">
        © 2026 Nimto Digital Invitations • Built for Memories
      </footer>
    </div>
  );
}
