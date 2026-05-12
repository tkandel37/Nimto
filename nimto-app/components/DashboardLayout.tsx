import React from "react";
import Link from "next/link";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-navy text-white flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold tracking-widest text-gold">NIMTO</h1>
          <p className="text-xs text-gold/60 uppercase tracking-tighter">Digital Invitations</p>
        </div>
        <nav className="flex-1 mt-6 px-4 space-y-2">
          <Link href="/dashboard" className="flex items-center p-3 rounded-lg bg-gold/10 text-gold border border-gold/20">
            <span className="mr-3 text-xl">🏠</span> Dashboard
          </Link>
          <Link href="/dashboard/invitations" className="flex items-center p-3 rounded-lg hover:bg-white/5 transition-colors">
            <span className="mr-3 text-xl">💌</span> My Invitations
          </Link>
          <Link href="/dashboard/guests" className="flex items-center p-3 rounded-lg hover:bg-white/5 transition-colors">
            <span className="mr-3 text-xl">👥</span> Guest List
          </Link>
          <Link href="/dashboard/billing" className="flex items-center p-3 rounded-lg hover:bg-white/5 transition-colors">
            <span className="mr-3 text-xl">💳</span> Billing
          </Link>
        </nav>
        <div className="p-6 border-t border-white/10">
          <button className="flex items-center text-sm hover:text-gold transition-colors">
            <span className="mr-2 text-xl">🌐</span> English / नेपाली
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="h-20 border-b border-navy/10 flex items-center justify-between px-8 bg-white/50 backdrop-blur-md sticky top-0 z-10">
          <h2 className="text-xl font-semibold text-navy">Welcome back, Trilochan</h2>
          <div className="flex items-center space-x-4">
            <button className="bg-gold text-white px-6 py-2 rounded-full font-medium shadow-lg shadow-gold/20 hover:bg-gold/90 transition-all active:scale-95">
              + New Invitation
            </button>
            <div className="w-10 h-10 rounded-full bg-navy/10 border-2 border-gold flex items-center justify-center text-navy font-bold">
              T
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
