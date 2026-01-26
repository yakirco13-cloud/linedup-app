import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useUser } from "@/components/UserContext";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Calendar, Clock, Plus, MessageCircle, Phone, MapPin, CheckCircle, X, Edit, Scissors, Star, Sparkles, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { he } from "date-fns/locale";
import { formatNumeric } from "@/services/dateService";
import BroadcastMessagePopup from "@/components/BroadcastMessagePopup";

// Instagram & Facebook icons as SVG components
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

export default function ClientDashboard() {
  const navigate = useNavigate();
  const { user, refetchUser } = useUser();
  const queryClient = useQueryClient();
  
  const [waitingListPopup, setWaitingListPopup] = useState(null);
  const [popupDismissed, setPopupDismissed] = useState(false);

  const { data: business, refetch: refetchBusiness, isLoading: businessLoading } = useQuery({
    queryKey: ['my-barbershop', user?.phone, user?.joined_businesses],
    queryFn: async () => {
      if (!user?.joined_businesses || user.joined_businesses.length === 0) return null;
      const businesses = await base44.entities.Business.filter({ id: user.joined_business_id });
      return businesses[0] || null;
    },
    enabled: !!user?.phone,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (user?.joined_business_id) refetchBusiness();
  }, [user?.phone, user?.joined_businesses, refetchBusiness]);

  const { data: nextAppointment } = useQuery({
    queryKey: ['next-appointment', user?.phone, user?.joined_business_id],
    queryFn: async () => {
      if (!user?.joined_business_id) return null;
      const allBookings = await base44.entities.Booking.filter(
        { client_phone: user.phone, business_id: user.joined_business_id, status: 'confirmed' },
        'date', 20
      );
      const upcoming = allBookings.filter(b => new Date(`${b.date}T${b.time}`) >= new Date());
      return upcoming.length > 0 ? upcoming[0] : null;
    },
    enabled: !!user?.phone && !!user?.joined_business_id,
    staleTime: 5 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 20000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });

  const { data: recentAppointments = [] } = useQuery({
    queryKey: ['recent-appointments', user?.phone, business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const allBookings = await base44.entities.Booking.filter(
        { client_phone: user.phone, business_id: business.id }, '-date', 20
      );
      return allBookings.filter(b => b.status === 'completed' || b.status === 'cancelled').slice(0, 3);
    },
    enabled: !!user?.phone && !!business?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });

  const { data: frequentServices = [] } = useQuery({
    queryKey: ['frequent-services', user?.phone, business?.id],
    queryFn: async () => {
      if (!business) return [];
      const completedBookings = await base44.entities.Booking.filter({
        client_phone: user.phone, business_id: business.id, status: 'completed'
      });
      const serviceCounts = {};
      completedBookings.forEach(booking => {
        serviceCounts[booking.service_id] = (serviceCounts[booking.service_id] || 0) + 1;
      });
      const topServiceIds = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id]) => id);
      if (topServiceIds.length === 0) {
        const allServices = await base44.entities.Service.filter({ business_id: business.id });
        return allServices.slice(0, 4);
      }
      const services = await Promise.all(topServiceIds.map(id => base44.entities.Service.filter({ id })));
      return services.map(s => s[0]).filter(Boolean);
    },
    enabled: !!user?.phone && !!business?.id,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    const checkWaitingListNotifications = async () => {
      if (!user?.phone || !business?.id || popupDismissed) return;
      try {
        const notifiedEntries = await base44.entities.WaitingList.filter({
          client_phone: user.phone, business_id: business.id, status: 'notified'
        });
        if (notifiedEntries.length === 0) return;
        for (const entry of notifiedEntries) {
          const entryDate = new Date(entry.date);
          const today = new Date(new Date().toDateString());
          if (entryDate < today) continue;
          setWaitingListPopup({
            date: entry.date, time: entry.notified_time || null,
            serviceName: entry.service_name, entryId: entry.id
          });
          break;
        }
      } catch (error) {
        console.error('Error checking waiting list notifications:', error);
      }
    };
    checkWaitingListNotifications();
  }, [user?.phone, business?.id, popupDismissed]);

  const hasCompletedBookings = recentAppointments.some(b => b.status === 'completed');

  const cancelMutation = useMutation({
    mutationFn: async (booking) => {
      await base44.entities.Booking.update(booking.id, { status: 'cancelled' });
      return booking;
    },
    onSuccess: async (booking) => {
      try {
        await base44.entities.Notification.create({
          business_id: booking.business_id, type: 'booking_cancelled', title: 'תור בוטל',
          message: `${booking.client_name} ביטל/ה את התור ל-${booking.service_name} בתאריך ${format(parseISO(booking.date), 'd.M.yyyy', { locale: he })} בשעה ${booking.time}`,
          booking_id: booking.id, client_name: booking.client_name, is_read: false
        });
      } catch (error) {
        console.error('Failed to create cancellation notification:', error);
      }
      queryClient.invalidateQueries({ queryKey: ['next-appointment'] });
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
    },
  });

  const formatPhoneForWhatsApp = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.startsWith('0') ? '972' + cleaned.substring(1) : cleaned;
  };

  const handleCancelAppointment = () => {
    if (window.confirm('האם אתה בטוח שברצונך לבטל את התור?')) {
      cancelMutation.mutate(nextAppointment);
    }
  };

  const handleRescheduleAppointment = () => {
    navigate(createPageUrl("BookAppointment") + `?reschedule=${nextAppointment.id}`);
  };

  const handleRebookService = (serviceId) => {
    navigate(createPageUrl("BookAppointment") + `?service=${serviceId}`);
  };

  const getWorkingHoursDisplay = () => {
    if (!business?.working_hours) return null;
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const enabledDays = days.filter(day => business.working_hours[day]?.enabled);
    if (enabledDays.length === 0) return 'לא זמין כרגע';
    const firstDaySchedule = business.working_hours[enabledDays[0]];
    if (firstDaySchedule.shifts?.length > 0) {
      return `${firstDaySchedule.shifts[0].start} - ${firstDaySchedule.shifts[0].end}`;
    } else if (firstDaySchedule.start && firstDaySchedule.end) {
      return `${firstDaySchedule.start} - ${firstDaySchedule.end}`;
    }
    return 'לא זמין כרגע';
  };

  // Logo photo (business owners set only this one)
  const logoPhoto = business?.photo_url;
  const hasInstagram = business?.instagram;
  const hasFacebook = business?.facebook;

  if (businessLoading) {
    return (
      <div className="min-h-screen bg-[#0C0F1D] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FF6B35] to-[#FF1744] flex items-center justify-center animate-pulse">
            <Scissors className="w-6 h-6 text-white" />
          </div>
          <div className="w-8 h-8 border-2 border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-[#0C0F1D] flex items-center justify-center p-6" dir="rtl">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-[#FF6B35] to-[#FF1744] flex items-center justify-center">
            <Calendar className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-4 text-white">ברוכים הבאים ל-LinedUp!</h1>
          <p className="text-[#94A3B8] text-lg leading-relaxed mb-12">הצטרף לעסק כדי להתחיל לקבוע תורים</p>
          <Button
            onClick={() => navigate(createPageUrl("JoinBusiness"))}
            className="h-14 px-8 rounded-xl text-lg font-semibold hover:scale-105 active:scale-95 transition-transform"
            style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
          >
            <Plus className="w-6 h-6 ml-2" />
            הצטרף לעסק
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0C0F1D]" dir="rtl">

      {/* Broadcast Message Popup */}
      <BroadcastMessagePopup />

      {/* Waiting List Popup */}
      {waitingListPopup && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-[#1A1F35] rounded-3xl max-w-md w-full border-2 border-green-500/50 overflow-hidden">
            <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-green-400 animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold text-green-400 mb-2">התפנה מקום! 🎉</h2>
              <p className="text-white text-lg">יש תור פנוי בתאריך שביקשת</p>
            </div>
            <div className="p-6">
              <div className="bg-[#0C0F1D] rounded-2xl p-4 mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <Calendar className="w-5 h-5 text-green-400" />
                  <span className="text-white font-bold text-lg">
                    {format(parseISO(waitingListPopup.date), 'EEEE, d בMMMM', { locale: he })}
                  </span>
                </div>
                {waitingListPopup.time && (
                  <div className="flex items-center gap-3 mb-3">
                    <Clock className="w-5 h-5 text-green-400" />
                    <span className="text-green-400 font-bold text-xl">{waitingListPopup.time}</span>
                  </div>
                )}
                {waitingListPopup.serviceName && (
                  <div className="flex items-center gap-3">
                    <Scissors className="w-5 h-5 text-[#94A3B8]" />
                    <span className="text-[#94A3B8]">{waitingListPopup.serviceName}</span>
                  </div>
                )}
              </div>
              <p className="text-[#94A3B8] text-center mb-6">מהרו לתפוס את התור לפני שיתפוס!</p>
              <div className="space-y-3">
                <Button
                  onClick={async () => {
                    try {
                      await base44.entities.WaitingList.update(waitingListPopup.entryId, { status: 'booked' });
                    } catch (e) {}
                    const timeParam = waitingListPopup.time ? `&time=${waitingListPopup.time}` : '';
                    navigate(`/BookAppointment?date=${waitingListPopup.date}${timeParam}`);
                  }}
                  className="w-full h-14 rounded-xl text-white font-bold text-lg"
                  style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
                >
                  <Calendar className="w-5 h-5 ml-2" />
                  קבע תור עכשיו!
                </Button>
                <button
                  onClick={() => { setWaitingListPopup(null); setPopupDismissed(true); }}
                  className="w-full py-3 text-[#94A3B8] hover:text-white transition-colors"
                >
                  אזכיר לי אחר כך
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ COVER DESIGN (Same for all businesses) ============ */}
      <div className="relative h-48">
        <style>{`
          @keyframes gradientShift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
        `}</style>

        <div className="absolute inset-0 overflow-hidden">
          {/* Animated gradient background */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(135deg, #FF6B35, #FF8F5C, #FF1744, #FF6B35)',
              backgroundSize: '300% 300%',
              animation: 'gradientShift 8s ease infinite'
            }}
          />

          {/* LinedUp Branding - positioned below status bar area */}
          <div
            className="absolute left-5 flex flex-row-reverse items-center gap-2.5 z-10"
            style={{ top: 'max(64px, calc(env(safe-area-inset-top, 0px) + 16px))' }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shadow-lg"
              style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.25), rgba(255,255,255,0.1))' }}
            >
              <span className="text-white font-black text-xl" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>L</span>
            </div>
            <span className="text-white font-bold text-xl tracking-wide drop-shadow-lg">LinedUp</span>
          </div>
        </div>

        {/* Gradient overlay - blends smoothly into page background */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, transparent 0%, transparent 40%, rgba(12,15,29,0.6) 70%, rgba(12,15,29,1) 100%)'
          }}
        />

        {/* Greeting - positioned below status bar area */}
        <div
          className="absolute right-5 z-10"
          style={{ top: 'max(64px, calc(env(safe-area-inset-top, 0px) + 16px))' }}
        >
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-white drop-shadow-lg">שלום, {user?.name?.split(' ')[0] || 'אורח'}</h2>
            <span className="text-2xl drop-shadow-lg">👋</span>
          </div>
        </div>

      </div>

      {/* ============ BUSINESS INFO CARD ============ */}
      <div className="bg-[#1A1F35] px-4 pt-2 pb-4 relative -mt-4 rounded-t-3xl">
        {/* Social icons - positioned at the dividing line between cover and card */}
        {(hasInstagram || hasFacebook) && (
          <div className="absolute -top-5 left-4 flex items-center gap-2 z-20">
            {hasInstagram && (
              <a
                href={business.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-transparent flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
              >
                <InstagramIcon className="w-6 h-6 text-white" />
              </a>
            )}
            {hasFacebook && (
              <a
                href={business.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-transparent flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
              >
                <FacebookIcon className="w-6 h-6 text-white" />
              </a>
            )}
          </div>
        )}
        <div className="flex items-start gap-4 mb-4">
          {/* Logo */}
          <div
            className="w-32 h-32 rounded-2xl bg-cover bg-center shadow-xl flex-shrink-0 -mt-16 border-4 border-[#1A1F35] overflow-hidden"
            style={{ backgroundImage: logoPhoto ? `url(${logoPhoto})` : 'none' }}
          >
            {!logoPhoto && (
              <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}>
                <Scissors className="w-14 h-14 text-white" />
              </div>
            )}
          </div>
          
          <div className="flex-1 pt-1">
            <h1 className="text-xl font-bold text-white mb-1">{business.name}</h1>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-green-400 text-sm">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                פתוח
              </span>
              <span className="text-[#94A3B8] text-sm">{getWorkingHoursDisplay()}</span>
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <a
            href={`https://wa.me/${formatPhoneForWhatsApp(business.phone)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="h-14 rounded-xl bg-[#0C0F1D] border border-white/10 text-white flex flex-col items-center justify-center gap-1 transition-all hover:scale-[1.02] hover:border-[#FF6B35]/50 active:scale-[0.98]"
          >
            <MessageCircle className="w-5 h-5 text-[#FF6B35]" />
            <span className="text-[11px] font-medium text-white/80">WhatsApp</span>
          </a>

          <a
            href={`tel:${business.phone}`}
            className="h-14 rounded-xl bg-[#0C0F1D] border border-white/10 text-white flex flex-col items-center justify-center gap-1 transition-all hover:scale-[1.02] hover:border-[#FF6B35]/50 active:scale-[0.98]"
          >
            <Phone className="w-5 h-5 text-[#FF6B35]" />
            <span className="text-[11px] font-medium text-white/80">התקשר</span>
          </a>
        </div>
      </div>

      {/* ============ MAIN CONTENT ============ */}
      <div className="p-4 space-y-4">

        {/* Next Appointment Card */}
        {nextAppointment ? (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #FF1744 100%)' }}>
            <div className="px-4 py-3 flex items-center justify-between border-b border-white/10">
              <span className="text-white/90 font-medium">התור הבא שלך</span>
              <span className="bg-white/20 px-3 py-1 rounded-full text-white text-xs font-bold">
                {isToday(parseISO(nextAppointment.date)) ? '⚡ היום' :
                 isTomorrow(parseISO(nextAppointment.date)) ? 'מחר' :
                 format(parseISO(nextAppointment.date), 'd בMMMM', { locale: he })}
              </span>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-4xl font-bold text-white mb-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {nextAppointment.time.substring(0, 5)}
                  </p>
                  <p className="text-white/80 text-sm">{nextAppointment.service_name}</p>
                  <p className="text-white/60 text-xs mt-1">עם {nextAppointment.staff_name} • {nextAppointment.duration} דקות</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleRescheduleAppointment} className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 active:scale-95">
                    <Edit className="w-5 h-5 text-white" />
                  </button>
                  <button onClick={handleCancelAppointment} disabled={cancelMutation.isPending} className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 active:scale-95 disabled:opacity-50">
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#1A1F35] rounded-2xl p-5 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #FF1744 100%)' }}>
              <Calendar className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">אין לך תור קרוב</h3>
            <p className="text-[#94A3B8] text-sm mb-4">הגיע הזמן לקבוע תור חדש!</p>
            <Button
              onClick={() => navigate(createPageUrl("BookAppointment"))}
              className="h-12 px-6 rounded-xl text-base font-semibold hover:scale-105 active:scale-95 transition-transform w-full"
              style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
            >
              <Plus className="w-5 h-5 ml-2" />
              קבע תור עכשיו
            </Button>
          </div>
        )}

        {/* Services Grid */}
        {frequentServices.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-white">{hasCompletedBookings ? 'קבע שוב' : 'השירותים שלנו'}</h2>
              <button onClick={() => navigate(createPageUrl("BookAppointment"))} className="text-[#FF6B35] text-sm font-medium flex items-center gap-1">
                הכל <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {frequentServices.map((service, index) => (
                <button
                  key={service.id}
                  onClick={() => handleRebookService(service.id)}
                  className="group bg-[#1A1F35] rounded-2xl p-4 text-right transition-all hover:scale-[1.02] active:scale-[0.98] relative"
                  style={{ border: index === 0 ? '1px solid rgba(255,107,53,0.4)' : '1px solid rgba(255,255,255,0.05)' }}
                >
                  {index === 0 && (
                    <span className="absolute -top-2.5 right-3 px-2.5 py-1 rounded-md text-[10px] font-bold text-white" style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #FF1744 100%)' }}>
                      פופולרי
                    </span>
                  )}
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#FF6B35]/20 to-[#FF1744]/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Scissors className="w-5 h-5 text-[#FF6B35]" />
                  </div>
                  <h3 className="font-semibold text-white mb-1">{service.name}</h3>
                  <p className="text-[#94A3B8] text-xs flex items-center gap-1 mb-2">
                    <Clock className="w-3 h-3" />{service.duration} דקות
                  </p>
                  {service.price > 0 && <p className="text-xl font-bold text-[#FF6B35]">₪{service.price}</p>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Appointment History */}
        {recentAppointments.length > 0 && (
          <div className="bg-[#1A1F35] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">היסטוריית תורים</h2>
              <button onClick={() => navigate(createPageUrl("MyBookings"))} className="text-[#FF6B35] text-sm font-medium flex items-center gap-1">
                ראה הכל <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              {recentAppointments.map((appointment) => (
                <div key={appointment.id} className="bg-[#0C0F1D] rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${appointment.status === 'completed' ? 'bg-green-500/15' : 'bg-red-500/15'}`}>
                      {appointment.status === 'completed' ? <CheckCircle className="w-5 h-5 text-green-500" /> : <X className="w-5 h-5 text-red-500" />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-white">{appointment.service_name}</h3>
                      <p className="text-xs text-[#94A3B8]">{formatNumeric(appointment.date)}</p>
                    </div>
                  </div>
                  <button onClick={() => handleRebookService(appointment.service_id)} className="h-9 px-3 rounded-lg bg-[#FF6B35]/10 text-[#FF6B35] text-sm font-medium flex items-center gap-1.5 hover:bg-[#FF6B35]/20">
                    <Calendar className="w-4 h-4" />קבע שוב
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="h-16" />
      </div>
    </div>
  );
}