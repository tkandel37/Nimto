import React from "react";
import DashboardLayout from "../../components/DashboardLayout";
import InvitationCard from "../../components/InvitationCard";

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        {/* Stats Overview */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white p-6 rounded-2xl border border-navy/5 shadow-sm">
            <p className="text-sm text-navy/60 mb-1">Active Invitations</p>
            <h3 className="text-3xl font-bold text-navy">12</h3>
            <div className="mt-2 text-xs text-green-500 font-medium">+2 from last month</div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-navy/5 shadow-sm">
            <p className="text-sm text-navy/60 mb-1">Total Guests</p>
            <h3 className="text-3xl font-bold text-navy">450</h3>
            <div className="mt-2 text-xs text-navy/40 font-medium">Across all events</div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-navy/5 shadow-sm">
            <p className="text-sm text-navy/60 mb-1">Credits Balance</p>
            <h3 className="text-3xl font-bold text-gold">Rs. 2,400</h3>
            <div className="mt-2 text-xs text-navy/40 font-medium">For premium guest names</div>
          </div>
        </section>

        {/* Recent Invitations */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-navy">My Invitations</h2>
            <button className="text-sm font-bold text-gold hover:underline">View All</button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <InvitationCard 
              title="Aarav & Ishani's Wedding" 
              type="Wedding" 
              date="Dec 15, 2026" 
              guests={250} 
              status="Published" 
            />
            <InvitationCard 
              title="Birthday Bash 2026" 
              type="Birthday" 
              date="Aug 22, 2026" 
              guests={50} 
              status="Draft" 
            />
            <InvitationCard 
              title="House Warming Party" 
              type="Event" 
              date="Nov 05, 2026" 
              guests={120} 
              status="Expired" 
            />
          </div>
        </section>

        {/* Quick Actions / Featured Features */}
        <section className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-navy rounded-3xl p-8 text-white relative overflow-hidden group">
             <div className="relative z-10">
               <h3 className="text-2xl font-bold mb-2">Guest Management</h3>
               <p className="text-white/60 mb-6 max-w-xs">Upload your guest list, manage RSVPs, and download bulk PDFs for printing.</p>
               <button className="bg-white text-navy px-6 py-2 rounded-full font-bold text-sm hover:bg-gold hover:text-white transition-all">
                 Manage Guests
               </button>
             </div>
             <div className="absolute top-0 right-0 p-8 text-8xl opacity-10 group-hover:scale-110 transition-transform duration-700">
               👥
             </div>
          </div>

          <div className="bg-gold/10 border border-gold/20 rounded-3xl p-8 text-navy relative overflow-hidden group">
             <div className="relative z-10">
               <h3 className="text-2xl font-bold mb-2">Premium Designs</h3>
               <p className="text-navy/60 mb-6 max-w-xs">Choose from our premium templates or upload your own background images.</p>
               <button className="bg-navy text-white px-6 py-2 rounded-full font-bold text-sm hover:bg-gold transition-all">
                 Explore Designs
               </button>
             </div>
             <div className="absolute top-0 right-0 p-8 text-8xl opacity-10 group-hover:scale-110 transition-transform duration-700 text-gold">
               🎨
             </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
