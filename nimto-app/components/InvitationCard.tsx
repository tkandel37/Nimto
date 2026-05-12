import React from "react";

interface InvitationCardProps {
  title: string;
  type: string;
  date: string;
  guests: number;
  status: "Draft" | "Published" | "Expired";
  image?: string;
}

export default function InvitationCard({ title, type, date, guests, status, image }: InvitationCardProps) {
  const statusColors = {
    Draft: "bg-gray-100 text-gray-600",
    Published: "bg-green-100 text-green-600",
    Expired: "bg-red-100 text-red-600",
  };

  return (
    <div className="bg-white rounded-2xl border border-navy/5 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
      <div className="h-40 bg-navy/5 relative overflow-hidden">
        {image ? (
          <img src={image} alt={title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-navy/20">
            <span className="text-4xl">📸</span>
          </div>
        )}
        <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold ${statusColors[status]}`}>
          {status}
        </div>
      </div>
      <div className="p-5">
        <div className="flex justify-between items-start mb-2">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gold font-bold mb-1">{type}</p>
            <h3 className="text-lg font-bold text-navy leading-tight">{title}</h3>
          </div>
        </div>
        <div className="flex items-center text-xs text-navy/60 space-x-4 mt-4">
          <div className="flex items-center">
            <span className="mr-1">📅</span> {date}
          </div>
          <div className="flex items-center">
            <span className="mr-1">👥</span> {guests} Guests
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-6">
          <button className="py-2 text-xs font-bold border border-navy/10 rounded-lg hover:bg-navy hover:text-white transition-colors">
            Manage
          </button>
          <button className="py-2 text-xs font-bold bg-gold/10 text-gold rounded-lg hover:bg-gold hover:text-white transition-colors">
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
