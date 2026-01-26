import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar, Clock, Plus, MessageCircle, Phone, CheckCircle, X, Edit, Scissors,
  ChevronLeft, ChevronRight, Bell, TrendingUp, Share2, Copy, Users, Home,
  ArrowRight, Briefcase, User
} from "lucide-react";
import { format, addDays, subDays } from "date-fns";
import { he } from "date-fns/locale";

// Demo data
const DEMO_BUSINESS = {
  name: "מספרת הדוגמה",
  phone: "050-1234567",
  description: "מספרה מקצועית לגברים ונשים",
  business_code: "DEMO123",
  photo_url: null,
  instagram: "https://instagram.com/demo",
  facebook: "https://facebook.com/demo",
};

const DEMO_USER = {
  name: "ישראל ישראלי",
  phone: "050-9876543",
};

const DEMO_SERVICES = [
  { id: "1", name: "תספורת גברים", duration: 30, price: 80, color: "#FF6B35" },
  { id: "2", name: "תספורת + זקן", duration: 45, price: 120, color: "#3B82F6" },
  { id: "3", name: "צבע שיער", duration: 60, price: 200, color: "#8B5CF6" },
  { id: "4", name: "החלקה", duration: 90, price: 350, color: "#EC4899" },
];

const DEMO_STAFF = [
  { id: "1", name: "דני הספר" },
  { id: "2", name: "מיכל" },
];

const today = new Date();
const DEMO_BOOKINGS = [
  { id: "1", client_name: "יוסי כהן", service_name: "תספורת גברים", time: "09:00", duration: 30, status: "confirmed", staff_name: "דני הספר", date: format(today, 'yyyy-MM-dd') },
  { id: "2", client_name: "שרה לוי", service_name: "צבע שיער", time: "10:00", duration: 60, status: "confirmed", staff_name: "מיכל", date: format(today, 'yyyy-MM-dd') },
  { id: "3", client_name: "אבי מזרחי", service_name: "תספורת + זקן", time: "11:30", duration: 45, status: "pending_approval", staff_name: "דני הספר", date: format(today, 'yyyy-MM-dd') },
  { id: "4", client_name: "רונית גולן", service_name: "החלקה", time: "14:00", duration: 90, status: "confirmed", staff_name: "מיכל", date: format(today, 'yyyy-MM-dd') },
];

const DEMO_NEXT_APPOINTMENT = {
  date: format(addDays(today, 2), 'yyyy-MM-dd'),
  time: "10:30",
  service_name: "תספורת גברים",
  staff_name: "דני הספר",
  duration: 30,
};

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

export default function DemoTour() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState("client"); // "client" or "owner"
  const [currentScreen, setCurrentScreen] = useState(0);
  const [showReferral, setShowReferral] = useState(false);

  const clientScreens = ["dashboard", "booking", "waitinglist"];
  const ownerScreens = ["dashboard", "calendar", "clients"];

  const screens = viewMode === "client" ? clientScreens : ownerScreens;
  const screenTitles = viewMode === "client"
    ? ["לוח בקרה", "קביעת תור", "רשימת המתנה"]
    : ["לוח בקרה", "יומן", "לקוחות"];

  const nextScreen = () => {
    setCurrentScreen((prev) => (prev + 1) % screens.length);
  };

  const prevScreen = () => {
    setCurrentScreen((prev) => (prev - 1 + screens.length) % screens.length);
  };

  // Client Dashboard Demo
  const ClientDashboardDemo = () => (
    <div className="min-h-[500px] bg-[#0C0F1D]" dir="rtl">
      {/* Cover */}
      <div className="relative h-48">
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(135deg, #FF6B35, #FF8F5C, #FF1744, #FF6B35)',
              backgroundSize: '300% 300%',
            }}
          />
          <div className="absolute top-12 left-5 flex flex-row-reverse items-center gap-2.5 z-10">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.25), rgba(255,255,255,0.1))' }}>
              <span className="text-white font-black text-xl">L</span>
            </div>
            <span className="text-white font-bold text-xl">LinedUp</span>
          </div>
        </div>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 0%, transparent 40%, rgba(12,15,29,0.6) 70%, rgba(12,15,29,1) 100%)' }} />
        <div className="absolute top-12 right-5 z-10">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-white drop-shadow-lg">שלום, {DEMO_USER.name.split(' ')[0]}</h2>
            <span className="text-2xl">👋</span>
          </div>
        </div>
      </div>

      {/* Business Card */}
      <div className="bg-[#1A1F35] px-4 pt-2 pb-4 relative -mt-4 rounded-t-3xl">
        <div className="absolute -top-5 left-4 flex items-center gap-2 z-20">
          <div className="w-10 h-10 rounded-full bg-transparent flex items-center justify-center">
            <InstagramIcon className="w-6 h-6 text-white" />
          </div>
          <div className="w-10 h-10 rounded-full bg-transparent flex items-center justify-center">
            <FacebookIcon className="w-6 h-6 text-white" />
          </div>
        </div>
        <div className="flex items-start gap-4 mb-4">
          <div className="w-32 h-32 rounded-2xl bg-cover bg-center shadow-xl flex-shrink-0 -mt-16 border-4 border-[#1A1F35] overflow-hidden">
            <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}>
              <Scissors className="w-14 h-14 text-white" />
            </div>
          </div>
          <div className="flex-1 pt-1">
            <h1 className="text-xl font-bold text-white mb-1">{DEMO_BUSINESS.name}</h1>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-green-400 text-sm">
                <span className="w-2 h-2 rounded-full bg-green-400"></span>
                פתוח
              </span>
              <span className="text-[#94A3B8] text-sm">09:00 - 20:00</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="h-14 rounded-xl bg-[#0C0F1D] border border-white/10 flex flex-col items-center justify-center gap-1">
            <MessageCircle className="w-5 h-5 text-[#FF6B35]" />
            <span className="text-[11px] font-medium text-white/80">WhatsApp</span>
          </div>
          <div className="h-14 rounded-xl bg-[#0C0F1D] border border-white/10 flex flex-col items-center justify-center gap-1">
            <Phone className="w-5 h-5 text-[#FF6B35]" />
            <span className="text-[11px] font-medium text-white/80">התקשר</span>
          </div>
        </div>
      </div>

      {/* Next Appointment */}
      <div className="p-4 space-y-4">
        <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #FF1744 100%)' }}>
          <div className="px-4 py-3 flex items-center justify-between border-b border-white/10">
            <span className="text-white/90 font-medium">התור הבא שלך</span>
            <span className="bg-white/20 px-3 py-1 rounded-full text-white text-xs font-bold">בעוד יומיים</span>
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-4xl font-bold text-white mb-1">{DEMO_NEXT_APPOINTMENT.time}</p>
                <p className="text-white/80 text-sm">{DEMO_NEXT_APPOINTMENT.service_name}</p>
                <p className="text-white/60 text-xs mt-1">עם {DEMO_NEXT_APPOINTMENT.staff_name} • {DEMO_NEXT_APPOINTMENT.duration} דקות</p>
              </div>
              <div className="flex gap-2">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <Edit className="w-5 h-5 text-white" />
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <X className="w-5 h-5 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Services */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-white">השירותים שלנו</h2>
            <span className="text-[#FF6B35] text-sm font-medium flex items-center gap-1">הכל <ChevronLeft className="w-4 h-4" /></span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {DEMO_SERVICES.slice(0, 4).map((service, index) => (
              <div key={service.id} className="bg-[#1A1F35] rounded-2xl p-4 text-right relative" style={{ border: index === 0 ? '1px solid rgba(255,107,53,0.4)' : '1px solid rgba(255,255,255,0.05)' }}>
                {index === 0 && (
                  <span className="absolute -top-2.5 right-3 px-2.5 py-1 rounded-md text-[10px] font-bold text-white" style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #FF1744 100%)' }}>פופולרי</span>
                )}
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#FF6B35]/20 to-[#FF1744]/20 flex items-center justify-center mb-3">
                  <Scissors className="w-5 h-5 text-[#FF6B35]" />
                </div>
                <h3 className="font-semibold text-white mb-1">{service.name}</h3>
                <p className="text-[#94A3B8] text-xs flex items-center gap-1 mb-2">
                  <Clock className="w-3 h-3" />{service.duration} דקות
                </p>
                <p className="text-xl font-bold text-[#FF6B35]">₪{service.price}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // Client Booking Demo
  const ClientBookingDemo = () => (
    <div className="min-h-[500px] bg-[#0C0F1D] p-4" dir="rtl">
      <div className="mb-8">
        <div className="flex items-center justify-center gap-2 mb-3">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className={`h-2 flex-1 rounded-full ${s <= 2 ? 'bg-gradient-to-r from-[#FF6B35] to-[#FF1744]' : 'bg-[#1A1F35]'}`} />
          ))}
        </div>
        <p className="text-center text-[#94A3B8] text-sm">שלב 2 מתוך 4</p>
      </div>

      <h1 className="text-3xl font-bold mb-2 text-white">איזה שירות?</h1>
      <p className="text-[#94A3B8] mb-6">ב-{DEMO_BUSINESS.name}</p>

      <div className="space-y-3">
        {DEMO_SERVICES.map((service) => (
          <div key={service.id} className="w-full bg-[#1A1F35] rounded-2xl p-5 text-right border-2 border-gray-800 hover:border-[#FF6B35] transition-all">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-lg text-white">{service.name}</h3>
              <span className="text-[#FF6B35] font-bold text-lg">₪{service.price}</span>
            </div>
            <div className="flex items-center gap-2 text-[#94A3B8] text-sm">
              <Clock className="w-4 h-4" />
              <span>{service.duration} דקות</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Client Waiting List Demo
  const ClientWaitingListDemo = () => (
    <div className="min-h-[500px] bg-[#0C0F1D] p-4 flex items-center justify-center" dir="rtl">
      <div className="bg-[#1A1F35] rounded-2xl max-w-md w-full overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500/20 to-blue-600/20 p-4 flex items-center justify-between border-b border-blue-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <Bell className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">רשימת המתנה</h2>
              <p className="text-xs text-blue-300/70">נעדכן אותך כשיתפנה מקום</p>
            </div>
          </div>
          <div className="p-2 rounded-xl">
            <X className="w-5 h-5 text-[#94A3B8]" />
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-white flex items-center gap-2 text-sm">
              <Scissors className="w-4 h-4 text-blue-400" />
              שירות
            </label>
            <div className="w-full bg-[#0C0F1D] border border-gray-700 rounded-xl p-3 text-white">
              תספורת גברים
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-white flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-blue-400" />
              תאריך
            </label>
            <div className="w-full bg-[#0C0F1D] border border-gray-700 rounded-xl p-3 text-white">
              {format(addDays(today, 3), 'd בMMMM yyyy', { locale: he })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-white flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-blue-400" />
              טווח שעות מועדף
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-[#0C0F1D] border border-gray-700 rounded-xl p-3 text-white text-center">10:00</div>
              <span className="text-[#94A3B8]">—</span>
              <div className="flex-1 bg-[#0C0F1D] border border-gray-700 rounded-xl p-3 text-white text-center">14:00</div>
            </div>
          </div>

          <button className="w-full h-12 rounded-xl bg-blue-500 text-white font-semibold flex items-center justify-center gap-2">
            <Bell className="w-4 h-4" />
            הצטרף לרשימת ההמתנה
          </button>
        </div>
      </div>
    </div>
  );

  // Owner Dashboard Demo
  const OwnerDashboardDemo = () => (
    <div className="min-h-[500px] bg-[#0C0F1D]" dir="rtl">
      {/* Cover */}
      <div className="relative h-44">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #FF6B35, #FF8F5C, #FF1744, #FF6B35)', backgroundSize: '300% 300%' }} />
          <div className="absolute top-12 left-5 flex flex-row-reverse items-center gap-2.5 z-10">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.25), rgba(255,255,255,0.1))' }}>
              <span className="text-white font-black text-xl">L</span>
            </div>
            <span className="text-white font-bold text-xl">LinedUp</span>
          </div>
        </div>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 0%, transparent 40%, rgba(26,31,53,0.6) 70%, rgba(26,31,53,1) 100%)' }} />
        <button className="absolute top-12 right-5 z-10 p-2.5 bg-white/20 backdrop-blur-sm rounded-xl">
          <Bell className="w-5 h-5 text-white" />
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center text-xs font-bold text-[#FF6B35]">3</div>
        </button>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-20">
          <div className="w-36 h-36 rounded-full shadow-2xl border-4 border-[#1A1F35] overflow-hidden">
            <div className="w-full h-full flex items-center justify-center text-5xl font-bold text-white" style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}>מ</div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="bg-[#1A1F35] pt-20 pb-3 px-6 text-center">
          <h1 className="text-2xl font-bold text-white">{DEMO_BUSINESS.name}</h1>
          <p className="text-[#94A3B8] text-sm mt-1">{DEMO_BUSINESS.description}</p>
        </div>

        <div className="bg-[#1A1F35] px-6 pb-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0C0F1D] rounded-2xl p-4 border border-white/10 text-center">
              <Calendar className="w-5 h-5 mx-auto mb-2 text-[#FF6B35]" />
              <p className="text-2xl font-bold text-white mb-1">4</p>
              <p className="text-xs text-[#94A3B8]">תורים היום</p>
            </div>
            <div className="bg-[#0C0F1D] rounded-2xl p-4 border border-white/10 text-center">
              <Clock className="w-5 h-5 mx-auto mb-2 text-yellow-500" />
              <p className="text-2xl font-bold text-white mb-1">1</p>
              <p className="text-xs text-[#94A3B8]">ממתינים</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button className="bg-gradient-to-l from-[#FF6B35] to-[#FF1744] rounded-xl py-4 font-semibold flex items-center justify-center gap-2 text-white">
              <Plus className="w-5 h-5" />
              תור חדש
            </button>
            <button className="bg-[#0C0F1D] border border-white/10 rounded-xl py-4 font-semibold text-white">
              עבור ליומן
            </button>
          </div>
        </div>

        {/* Pending Approval */}
        <div className="px-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-bold text-white">ממתינים לאישור</h2>
            <span className="bg-yellow-500 text-black text-xs font-bold px-2.5 py-1 rounded-full">1</span>
          </div>
          <div className="bg-[#1A1F35] border-2 border-yellow-500/40 rounded-2xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FF1744] flex items-center justify-center text-xl font-bold text-white">א</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-base text-white mb-0.5">אבי מזרחי</h3>
                  <p className="text-sm text-[#94A3B8] mb-1">תספורת + זקן</p>
                  <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
                    <span>היום</span>
                    <span>•</span>
                    <span>11:30</span>
                    <span>•</span>
                    <span>45 דקות</span>
                  </div>
                </div>
              </div>
              <span className="bg-yellow-500/20 text-yellow-500 text-xs px-3 py-1 rounded-full font-medium">ממתין</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button className="bg-green-600 rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-1 text-white">
                <CheckCircle className="w-4 h-4" />
                אשר
              </button>
              <button className="bg-red-600/80 rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-1 text-white">
                <X className="w-4 h-4" />
                דחה
              </button>
            </div>
          </div>
        </div>

        {/* Today's Appointments */}
        <div className="px-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">התורים של היום</h2>
            <span className="text-[#FF6B35] text-sm font-medium">ראה הכל</span>
          </div>
          <div className="space-y-3">
            {DEMO_BOOKINGS.filter(b => b.status === 'confirmed').slice(0, 2).map(booking => (
              <div key={booking.id} className="bg-[#1A1F35] rounded-2xl p-4 border-2 border-gray-800">
                <div className="flex items-start gap-3">
                  <div className="text-center min-w-[65px]">
                    <p className="text-2xl font-bold text-[#FF6B35] leading-none mb-1">{booking.time}</p>
                    <p className="text-xs text-[#94A3B8]">{booking.duration}'</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-base text-white">{booking.client_name}</h3>
                      <span className="bg-green-500/20 text-green-500 text-xs px-2 py-0.5 rounded-md font-medium">מאושר</span>
                    </div>
                    <p className="text-sm text-[#94A3B8] mb-1">{booking.service_name}</p>
                    <p className="text-xs text-[#94A3B8]">עם {booking.staff_name}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // Owner Calendar Demo
  const OwnerCalendarDemo = () => {
    const hours = [9, 10, 11, 12, 13, 14, 15, 16];
    const weekDays = ['א', 'ב', 'ג', 'ד', 'ה'];

    return (
      <div className="min-h-[500px] bg-[#0C0F1D]" dir="rtl">
        {/* Header */}
        <div className="bg-[#1A1F35] border-b border-gray-800 p-4">
          <div className="flex items-center justify-between mb-4">
            <Home className="w-6 h-6 text-[#94A3B8]" />
            <div className="text-center flex-1">
              <div className="flex items-center justify-center mb-1">
                <ChevronRight className="w-6 h-6 text-white" />
                <h1 className="text-base font-bold px-3 whitespace-nowrap text-white">19-23 ינואר 2026</h1>
                <ChevronLeft className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="relative p-3 bg-[#1A1F35] rounded-xl border-2 border-gray-800">
              <Bell className="w-6 h-6 text-white" />
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-[#FF6B35] to-[#FF1744] rounded-full flex items-center justify-center text-xs font-bold text-white">3</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="flex-1 py-3 rounded-xl font-semibold bg-gradient-to-r from-[#FF6B35] to-[#FF1744] text-white">שבוע</button>
            <button className="flex-1 py-3 rounded-xl font-semibold bg-[#0C0F1D] text-[#94A3B8] border-2 border-gray-800">יום</button>
          </div>
        </div>

        {/* Day Headers */}
        <div className="flex flex-row-reverse border-b-2 border-gray-800 bg-[#0C0F1D]">
          <div className="w-16 flex-shrink-0 border-r-2 border-gray-800" />
          <div className="flex-1 grid grid-cols-5">
            {weekDays.map((day, i) => (
              <div key={i} className={`h-14 flex flex-col items-center justify-center border-l border-gray-800 ${i === 2 ? 'bg-[#FF6B35]/10' : ''}`}>
                <span className={`text-xs mb-0.5 ${i === 2 ? 'text-[#FF6B35] font-semibold' : 'text-[#94A3B8]'}`}>{day}</span>
                <span className={`text-base font-bold leading-none ${i === 2 ? 'text-[#FF6B35]' : 'text-white'}`}>{19 + i}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="flex flex-row-reverse overflow-auto" style={{ maxHeight: '300px' }}>
          <div className="w-16 flex-shrink-0 bg-[#0C0F1D] border-r-2 border-gray-800">
            {hours.map(hour => (
              <div key={hour} className="h-13 flex items-center justify-center border-t border-gray-800" style={{ height: '52px' }}>
                <span className="text-xs text-[#94A3B8] font-medium">{String(hour).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>
          <div className="flex-1 relative">
            <div className="grid grid-cols-5 h-full">
              {weekDays.map((_, dayIndex) => (
                <div key={dayIndex} className="relative border-r border-gray-800">
                  {hours.map((hour) => (
                    <div key={`${dayIndex}-${hour}`} className={`border-t border-gray-800 ${dayIndex === 2 ? 'bg-[#FF6B35]/5' : ''}`} style={{ height: '52px' }} />
                  ))}
                  {/* Demo appointments */}
                  {dayIndex === 2 && (
                    <>
                      <div className="absolute left-1 right-1 rounded-lg p-1.5 text-right shadow-lg" style={{ top: '0px', height: '26px', backgroundColor: '#FF6B35' }}>
                        <p className="text-[10px] font-bold text-white">יוסי כהן</p>
                      </div>
                      <div className="absolute left-1 right-1 rounded-lg p-1.5 text-right shadow-lg" style={{ top: '52px', height: '52px', backgroundColor: '#8B5CF6' }}>
                        <p className="text-[10px] font-bold text-white">שרה לוי</p>
                        <p className="text-[8px] text-white/80">צבע שיער</p>
                      </div>
                      <div className="absolute left-1 right-1 rounded-lg p-1.5 text-right shadow-lg border-2 border-yellow-500" style={{ top: '130px', height: '39px', backgroundColor: '#EAB308' }}>
                        <p className="text-[10px] font-bold text-white">אבי מזרחי</p>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Owner Clients Demo
  const OwnerClientsDemo = () => {
    const demoClients = [
      { name: "יוסי כהן", phone: "050-1111111", visits: 12, lastVisit: "לפני 3 ימים" },
      { name: "שרה לוי", phone: "050-2222222", visits: 8, lastVisit: "לפני שבוע" },
      { name: "אבי מזרחי", phone: "050-3333333", visits: 5, lastVisit: "היום" },
      { name: "רונית גולן", phone: "050-4444444", visits: 3, lastVisit: "לפני חודש" },
    ];

    return (
      <div className="min-h-[500px] bg-[#0C0F1D] p-4" dir="rtl">
        <div className="flex items-center gap-2 mb-6">
          <ArrowRight className="w-5 h-5 text-[#94A3B8]" />
          <h1 className="text-2xl font-bold text-white">הלקוחות שלי</h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-[#1A1F35] rounded-2xl p-4 border border-gray-800">
            <Users className="w-5 h-5 text-[#FF6B35] mb-2" />
            <p className="text-2xl font-bold text-white">24</p>
            <p className="text-xs text-[#94A3B8]">סה"כ לקוחות</p>
          </div>
          <div className="bg-[#1A1F35] rounded-2xl p-4 border border-gray-800">
            <TrendingUp className="w-5 h-5 text-green-500 mb-2" />
            <p className="text-2xl font-bold text-white">6</p>
            <p className="text-xs text-[#94A3B8]">חדשים החודש</p>
          </div>
        </div>

        {/* Search */}
        <div className="bg-[#1A1F35] rounded-xl p-3 mb-4 border border-gray-800">
          <input
            type="text"
            placeholder="חיפוש לקוח..."
            className="w-full bg-transparent text-white outline-none"
          />
        </div>

        {/* Client List */}
        <div className="space-y-3">
          {demoClients.map((client, index) => (
            <div key={index} className="bg-[#1A1F35] rounded-2xl p-4 border border-gray-800 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FF1744] flex items-center justify-center text-xl font-bold text-white flex-shrink-0">
                {client.name[0]}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-white">{client.name}</h3>
                <p className="text-sm text-[#94A3B8]">{client.phone}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-[#94A3B8]">{client.visits} ביקורים</span>
                  <span className="text-xs text-[#94A3B8]">•</span>
                  <span className="text-xs text-[#94A3B8]">{client.lastVisit}</span>
                </div>
              </div>
              <ChevronLeft className="w-5 h-5 text-[#94A3B8]" />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderScreen = () => {
    if (viewMode === "client") {
      switch (screens[currentScreen]) {
        case "dashboard": return <ClientDashboardDemo />;
        case "booking": return <ClientBookingDemo />;
        case "waitinglist": return <ClientWaitingListDemo />;
        default: return <ClientDashboardDemo />;
      }
    } else {
      switch (screens[currentScreen]) {
        case "dashboard": return <OwnerDashboardDemo />;
        case "calendar": return <OwnerCalendarDemo />;
        case "clients": return <OwnerClientsDemo />;
        default: return <OwnerDashboardDemo />;
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0C0F1D] flex flex-col" dir="rtl">
      {/* Header */}
      <div className="bg-[#1A1F35] border-b border-gray-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-[#94A3B8] hover:text-white transition-colors">
            <ArrowRight className="w-5 h-5" />
            <span className="font-medium">חזרה</span>
          </button>
          <h1 className="text-lg font-bold text-white">סיור באפליקציה</h1>
          <div className="w-16" />
        </div>

        {/* View Mode Toggle */}
        <div className="flex bg-[#0C0F1D] rounded-xl p-1 mb-4">
          <button
            onClick={() => { setViewMode("client"); setCurrentScreen(0); }}
            className={`flex-1 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
              viewMode === "client"
                ? "bg-gradient-to-r from-[#FF6B35] to-[#FF1744] text-white"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            <User className="w-4 h-4" />
            לקוח
          </button>
          <button
            onClick={() => { setViewMode("owner"); setCurrentScreen(0); }}
            className={`flex-1 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
              viewMode === "owner"
                ? "bg-gradient-to-r from-[#FF6B35] to-[#FF1744] text-white"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            <Briefcase className="w-4 h-4" />
            בעל עסק
          </button>
        </div>

        {/* Screen Indicator */}
        <div className="flex items-center justify-center gap-2">
          {screens.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentScreen(index)}
              className={`h-2 rounded-full transition-all ${
                index === currentScreen
                  ? "w-8 bg-gradient-to-r from-[#FF6B35] to-[#FF1744]"
                  : "w-2 bg-gray-600 hover:bg-gray-500"
              }`}
            />
          ))}
        </div>
        <p className="text-center text-[#94A3B8] text-sm mt-2">{screenTitles[currentScreen]}</p>
      </div>

      {/* Screen Content */}
      <div className="flex-1 relative overflow-hidden">
        {/* Navigation Arrows */}
        <button
          onClick={prevScreen}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-[#1A1F35]/80 backdrop-blur-sm rounded-full flex items-center justify-center border border-gray-700 hover:border-[#FF6B35] transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <button
          onClick={nextScreen}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-[#1A1F35]/80 backdrop-blur-sm rounded-full flex items-center justify-center border border-gray-700 hover:border-[#FF6B35] transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-white" />
        </button>

        {/* Demo Screen */}
        <div className="h-full overflow-auto">
          {renderScreen()}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="bg-[#1A1F35] border-t border-gray-800 p-4 pb-safe">
        <button
          onClick={() => navigate("/Auth?mode=signup")}
          className="w-full h-14 rounded-xl text-white font-bold text-lg transition-all hover:scale-105 active:scale-95"
          style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
        >
          הירשם עכשיו - חינם!
        </button>
        <p className="text-center text-[#64748B] text-xs mt-3">
          כבר יש לך חשבון? <button onClick={() => navigate("/Auth?mode=login")} className="text-[#FF6B35]">התחבר</button>
        </p>
      </div>
    </div>
  );
}
