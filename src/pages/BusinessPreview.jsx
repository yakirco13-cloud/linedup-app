import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Calendar, Clock, MessageCircle, Phone, Scissors, Loader2, LogIn } from "lucide-react";

// Instagram & Facebook icons
const InstagramIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

const FacebookIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

export default function BusinessPreview() {
  const navigate = useNavigate();
  const { businessCode } = useParams();

  const { data: business, isLoading: businessLoading } = useQuery({
    queryKey: ['business-preview', businessCode],
    queryFn: async () => {
      const businesses = await base44.entities.Business.filter({ business_code: businessCode });
      return businesses[0] || null;
    },
    enabled: !!businessCode,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['business-services', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      return await base44.entities.Service.filter({ business_id: business.id });
    },
    enabled: !!business?.id,
  });

  const handleBookAppointment = () => {
    // Redirect to signup with return URL
    navigate(`/Auth?mode=signup&returnTo=/JoinBusiness?code=${businessCode}`);
  };

  const handleContactWhatsApp = () => {
    if (business?.phone) {
      const normalizedPhone = business.phone.replace(/\D/g, '');
      const whatsappNumber = normalizedPhone.startsWith('972') ? normalizedPhone : '972' + normalizedPhone.substring(1);
      window.open(`https://wa.me/${whatsappNumber}`, '_blank');
    }
  };

  const handleContactPhone = () => {
    if (business?.phone) {
      window.location.href = `tel:${business.phone}`;
    }
  };

  if (businessLoading) {
    return (
      <div className="min-h-screen bg-[#0C0F1D] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF6B35]" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-[#0C0F1D] flex flex-col items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">העסק לא נמצא</h1>
          <p className="text-[#94A3B8] mb-6">לא מצאנו עסק עם הקוד הזה</p>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 rounded-xl bg-[#FF6B35] text-white font-semibold hover:scale-105 transition-transform"
          >
            חזרה לעמוד הבית
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0C0F1D]" dir="rtl">
      {/* Header with Back Button */}
      <div className="bg-[#1A1F35] border-b border-gray-800 p-4 sticky top-0 z-10">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-[#94A3B8] hover:text-white transition-colors"
        >
          <ArrowRight className="w-5 h-5" />
          <span className="font-medium">חזרה</span>
        </button>
      </div>

      {/* Cover & Business Info */}
      <div className="relative h-48">
        <div className="absolute inset-0 overflow-hidden">
          {business.cover_photo_url ? (
            <img src={business.cover_photo_url} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(135deg, #FF6B35, #FF8F5C, #FF1744, #FF6B35)',
                backgroundSize: '300% 300%',
              }}
            />
          )}
        </div>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 0%, transparent 40%, rgba(12,15,29,0.6) 70%, rgba(12,15,29,1) 100%)' }} />
      </div>

      {/* Business Card */}
      <div className="bg-[#1A1F35] px-4 pt-2 pb-4 relative -mt-4 rounded-t-3xl">
        {/* Social Icons */}
        <div className="absolute -top-5 left-4 flex items-center gap-2 z-20">
          {business.instagram && (
            <a
              href={business.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full bg-[#1A1F35] flex items-center justify-center hover:bg-[#FF6B35] transition-colors"
            >
              <InstagramIcon className="w-5 h-5 text-white" />
            </a>
          )}
          {business.facebook && (
            <a
              href={business.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full bg-[#1A1F35] flex items-center justify-center hover:bg-[#FF6B35] transition-colors"
            >
              <FacebookIcon className="w-5 h-5 text-white" />
            </a>
          )}
        </div>

        <div className="flex items-start gap-4 mb-4">
          {/* Business Photo */}
          <div className="w-32 h-32 rounded-2xl bg-cover bg-center shadow-xl flex-shrink-0 -mt-16 border-4 border-[#1A1F35] overflow-hidden">
            {business.photo_url ? (
              <img src={business.photo_url} alt={business.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}>
                <Scissors className="w-14 h-14 text-white" />
              </div>
            )}
          </div>

          {/* Business Info */}
          <div className="flex-1 pt-1">
            <h1 className="text-xl font-bold text-white mb-1">{business.name}</h1>
            {business.description && (
              <p className="text-[#94A3B8] text-sm mb-2">{business.description}</p>
            )}
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-green-400 text-sm">
                <span className="w-2 h-2 rounded-full bg-green-400"></span>
                פתוח
              </span>
              {business.hours && (
                <span className="text-[#94A3B8] text-sm">{business.hours}</span>
              )}
            </div>
          </div>
        </div>

        {/* Contact Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleContactWhatsApp}
            className="h-14 rounded-xl bg-[#0C0F1D] border border-white/10 flex flex-col items-center justify-center gap-1 hover:border-[#FF6B35] transition-colors"
          >
            <MessageCircle className="w-5 h-5 text-[#FF6B35]" />
            <span className="text-[11px] font-medium text-white/80">WhatsApp</span>
          </button>
          <button
            onClick={handleContactPhone}
            className="h-14 rounded-xl bg-[#0C0F1D] border border-white/10 flex flex-col items-center justify-center gap-1 hover:border-[#FF6B35] transition-colors"
          >
            <Phone className="w-5 h-5 text-[#FF6B35]" />
            <span className="text-[11px] font-medium text-white/80">התקשר</span>
          </button>
        </div>
      </div>

      {/* Services Section */}
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">השירותים שלנו</h2>
        </div>

        {services.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {services.map((service) => (
              <div key={service.id} className="bg-[#1A1F35] rounded-2xl p-4 text-right border border-white/5">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#FF6B35]/20 to-[#FF1744]/20 flex items-center justify-center mb-3">
                  <Scissors className="w-5 h-5 text-[#FF6B35]" />
                </div>
                <h3 className="font-semibold text-white mb-1">{service.name}</h3>
                <p className="text-[#94A3B8] text-xs flex items-center gap-1 mb-2">
                  <Clock className="w-3 h-3" />
                  {service.duration} דקות
                </p>
                <p className="text-xl font-bold text-[#FF6B35]">₪{service.price}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-[#94A3B8]">אין שירותים זמינים כרגע</p>
          </div>
        )}
      </div>

      {/* Floating Book Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#1A1F35] border-t border-gray-800 p-4 pb-safe">
        <button
          onClick={handleBookAppointment}
          className="w-full h-14 rounded-xl text-white font-bold text-lg transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
        >
          <Calendar className="w-5 h-5" />
          קבע תור
          <LogIn className="w-4 h-4" />
        </button>
        <p className="text-center text-[#64748B] text-xs mt-2">
          נדרשת הרשמה כדי לקבוע תור
        </p>
      </div>
    </div>
  );
}
