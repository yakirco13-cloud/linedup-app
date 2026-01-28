import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl, formatTime } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useUser } from "@/components/UserContext";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Calendar, Clock, Plus, Check, X, MessageCircle, Copy, ChevronLeft, TrendingUp, Bell, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, startOfDay, addDays } from "date-fns";
import { he } from "date-fns/locale";
import NotificationDropdown from "../components/NotificationDropdown";

// Import centralized services
import { sendConfirmation, sendCancellation } from "@/services/whatsappService";
import { toISO, formatNumeric, parseDate, formatShort } from "@/services/dateService";

export default function BusinessDashboard() {
  const navigate = useNavigate();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [showReferral, setShowReferral] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const { data: business, isLoading: businessLoading } = useQuery({
    queryKey: ['business', user?.business_id],
    queryFn: async () => {
      if (!user?.business_id) return null;
      const businesses = await base44.entities.Business.filter({ id: user.business_id });
      return businesses[0] || null;
    },
    enabled: !!user?.business_id,
  });

  const { data: allBookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['all-bookings', business?.id],
    queryFn: async () => {
      // Calculate date range: 30 days ago for stats
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const pastDateStr = format(thirtyDaysAgo, 'yyyy-MM-dd');
      
      const bookings = await base44.entities.Booking.filter(
        { business_id: business.id },
        '-date',
        1000  // High limit to get all relevant bookings
      );
      
      // Return all bookings (filtering done in components that need it)
      return bookings;
    },
    enabled: !!business?.id,
    staleTime: 5 * 1000,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });

  // Fetch notifications for the bell icon
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', business?.id],
    queryFn: () => base44.entities.Notification.filter({ business_id: business.id }, '-created_at', 10),
    enabled: !!business?.id,
    staleTime: 10 * 1000,
    refetchInterval: 10000,
  });

  // Calculate unread count for badge
  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Separate pending and confirmed bookings for today
  const today = format(new Date(), 'yyyy-MM-dd');
  const pendingBookings = allBookings.filter(b => {
    const bookingDate = toISO(b.date);
    return b.status === 'pending_approval' && bookingDate >= today;
  }).sort((a, b) => {
    const dateA = new Date(`${toISO(a.date)}T${a.time}`);
    const dateB = new Date(`${toISO(b.date)}T${b.time}`);
    return dateA - dateB;
  });

  const todayConfirmedBookings = allBookings.filter(b => {
    const bookingDate = toISO(b.date);
    return bookingDate === today && b.status === 'confirmed';
  }).sort((a, b) => {
    const [hoursA, minutesA] = a.time.split(':').map(Number);
    const [hoursB, minutesB] = b.time.split(':').map(Number);
    return (hoursA * 60 + minutesA) - (hoursB * 60 + minutesB);
  });

  // Calculate stats - simplified
  const todayStats = {
    appointments: allBookings.filter(b => {
      const bookingDate = toISO(b.date);
      return bookingDate === today && (b.status === 'confirmed' || b.status === 'completed');
    }).length,
    pending: pendingBookings.length
  };

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = format(weekAgo, 'yyyy-MM-dd');

  const weekStats = {
    appointments: allBookings.filter(b => {
      const bookingDate = toISO(b.date);
      return bookingDate >= weekAgoStr && (b.status === 'confirmed' || b.status === 'completed');
    }).length
  };

  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = format(monthStart, 'yyyy-MM-dd');

  const monthStats = {
    appointments: allBookings.filter(b => {
      const bookingDate = toISO(b.date);
      return bookingDate >= monthStartStr && (b.status === 'confirmed' || b.status === 'completed');
    }).length
  };

  const approveMutation = useMutation({
    mutationFn: async (booking) => {
      await base44.entities.Booking.update(booking.id, { status: 'confirmed' });
      return booking;
    },
    onSuccess: async (booking) => {
      // Send WhatsApp confirmation to client
      if (booking.client_phone) {
        await sendConfirmation({
          phone: booking.client_phone,
          clientName: booking.client_name,
          businessName: business?.name || 'העסק',
          date: booking.date,
          time: booking.time,
          businessId: business?.id
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['all-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['next-appointment'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (booking) => {
      await base44.entities.Booking.update(booking.id, { status: 'cancelled' });
      return booking;
    },
    onSuccess: async (booking) => {
      // Send WhatsApp rejection notification
      if (booking.client_phone) {
        await sendCancellation({
          phone: booking.client_phone,
          clientName: booking.client_name,
          businessName: business?.name || 'העסק'
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['all-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['next-appointment'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (booking) => {
      await base44.entities.Booking.update(booking.id, { status: 'cancelled' });
      return booking;
    },
    onSuccess: async (booking) => {
      // Send WhatsApp cancellation notification
      if (booking.client_phone) {
        await sendCancellation({
          phone: booking.client_phone,
          clientName: booking.client_name,
          businessName: business?.name || 'העסק'
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['all-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['next-appointment'] });
    },
  });

  const handleApprove = (booking) => {
    if (window.confirm('לאשר את התור?')) {
      approveMutation.mutate(booking);
    }
  };

  const handleReject = (booking) => {
    if (window.confirm('לדחות את התור?')) {
      rejectMutation.mutate(booking);
    }
  };

  const handleCancel = (booking) => {
    if (window.confirm('לבטל את התור?')) {
      cancelMutation.mutate(booking);
    }
  };

  const isLoading = businessLoading || bookingsLoading;

  useEffect(() => {
    if (!businessLoading && !business && user) {
      navigate(createPageUrl("BusinessSetup"));
    }
  }, [business, businessLoading, user, navigate]);

  if (isLoading) {
  return null;
}

  if (!business) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <p className="text-[#94A3B8] mb-4">לא נמצא עסק</p>
          <Button onClick={() => navigate(createPageUrl("BusinessSetup"))}>
            צור עסק
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={showNotifications ? 'overflow-hidden h-screen' : ''}>
      {showNotifications && (
        <NotificationDropdown
          businessId={business?.id}
          onClose={() => setShowNotifications(false)}
        />
      )}

      {/* ============ COVER DESIGN ============ */}
      <div className="relative h-44 -mx-4 -mt-safe" style={{ marginTop: 'calc(-1 * env(safe-area-inset-top, 8px) - 8px)' }}>
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
          <div className="absolute top-16 left-5 flex flex-row-reverse items-center gap-2.5 z-10">
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
            background: 'linear-gradient(180deg, transparent 0%, transparent 40%, rgba(26,31,53,0.6) 70%, rgba(26,31,53,1) 100%)'
          }}
        />

        {/* Notification Bell - top right corner below status bar */}
        <button
          onClick={() => setShowNotifications(true)}
          className="absolute top-16 right-5 z-10 p-2.5 bg-white/20 backdrop-blur-sm rounded-xl hover:bg-white/30 transition-all hover:scale-110"
        >
          <Bell className="w-5 h-5 text-white" />
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center text-xs font-bold text-[#FF6B35]">
              {unreadCount > 9 ? '9+' : unreadCount}
            </div>
          )}
        </button>

        {/* Business Photo - centered contact style */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-20">
          <div
            className="w-36 h-36 rounded-full bg-cover bg-center shadow-2xl border-4 border-[#1A1F35] overflow-hidden"
            style={{ backgroundImage: business.photo_url ? `url(${business.photo_url})` : 'none' }}
          >
            {!business.photo_url && (
              <div className="w-full h-full flex items-center justify-center text-5xl font-bold text-white" style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}>
                {business.name?.[0]?.toUpperCase() || 'W'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="-mx-4">
        {/* Business Name Card - merged smoothly */}
        <div className="bg-[#1A1F35] pt-20 pb-3 px-6 text-center">
          <h1 className="text-2xl font-bold text-white">{business.name}</h1>
          {business.description && (
            <p className="text-[#94A3B8] text-sm mt-1 line-clamp-2">{business.description}</p>
          )}
        </div>

        {/* Stats and Actions Section - continuous background */}
        <div className="bg-[#1A1F35] px-6 pb-6 space-y-4">

          {/* Today's Stats - 2 Column Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0C0F1D] rounded-2xl p-4 border border-white/10 text-center">
              <Calendar className="w-5 h-5 mx-auto mb-2 text-[#FF6B35]" />
              <p className="text-2xl font-bold mb-1">{todayStats.appointments}</p>
              <p className="text-xs text-[#94A3B8]">תורים היום</p>
            </div>

            <div className="bg-[#0C0F1D] rounded-2xl p-4 border border-white/10 text-center">
              <Clock className="w-5 h-5 mx-auto mb-2 text-yellow-500" />
              <p className="text-2xl font-bold mb-1">{todayStats.pending}</p>
              <p className="text-xs text-[#94A3B8]">ממתינים</p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate(createPageUrl("CreateBooking"))}
              className="bg-gradient-to-l from-[#FF6B35] to-[#FF1744] rounded-xl py-4 font-semibold flex items-center justify-center gap-2 hover:scale-105 transition-transform active:scale-95"
            >
              <Plus className="w-5 h-5" />
              תור חדש
            </button>
            <button
              onClick={() => navigate(createPageUrl("AllBookings"))}
              className="bg-[#0C0F1D] border border-white/10 rounded-xl py-4 font-semibold hover:border-[#FF6B35]/50 transition-colors"
            >
              כל התורים
            </button>
          </div>
        </div>

        {/* Pending Approvals Section */}
        {pendingBookings.length > 0 && (
          <div className="px-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-bold">ממתינים לאישור</h2>
              <span className="bg-yellow-500 text-black text-xs font-bold px-2.5 py-1 rounded-full">
                {pendingBookings.length}
              </span>
            </div>

            <div className="space-y-3">
              {pendingBookings.map(booking => (
                <div
                  key={booking.id}
                  className="bg-[#1A1F35] border-2 border-yellow-500/40 rounded-2xl p-4 animate-pulse-slow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FF1744] flex items-center justify-center text-xl font-bold flex-shrink-0">
                        {booking.client_name ? booking.client_name[0].toUpperCase() : '?'}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base mb-0.5">{booking.client_name || 'לקוח'}</h3>
                        <p className="text-sm text-[#94A3B8] mb-1">{booking.service_name}</p>
                        <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
                          <span>{formatShort(booking.date)}</span>
                          <span>•</span>
                          <span>{formatTime(booking.time)}</span>
                          <span>•</span>
                          <span>{booking.duration} דקות</span>
                        </div>
                      </div>
                    </div>

                    <span className="bg-yellow-500/20 text-yellow-500 text-xs px-3 py-1 rounded-full font-medium flex-shrink-0">
                      ממתין
                    </span>
                  </div>

                  {booking.notes && (
                    <p className="text-xs text-[#94A3B8] mb-3 mr-15">
                      💬 {booking.notes}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleApprove(booking)}
                      disabled={approveMutation.isPending}
                      className="bg-green-600 hover:bg-green-700 rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      אשר
                    </button>
                    <button
                      onClick={() => handleReject(booking)}
                      disabled={rejectMutation.isPending}
                      className="bg-red-600/80 hover:bg-red-600 rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                      דחה
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Today's Confirmed Appointments */}
        <div className="px-6 mb-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">התורים של היום</h2>
            <button
              onClick={() => navigate(createPageUrl("CalendarView"))}
              className="text-[#FF6B35] text-sm font-medium hover:text-[#FF8555] transition-colors"
            >
              ראה הכל
            </button>
          </div>

          {todayConfirmedBookings.length === 0 ? (
            <div className="bg-[#1A1F35] rounded-2xl p-8 text-center border-2 border-dashed border-gray-700">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-[#94A3B8]" />
              <p className="text-[#94A3B8] mb-2">אין תורים מאושרים להיום</p>
              <button
                onClick={() => navigate(createPageUrl("CreateBooking"))}
                className="text-[#FF6B35] text-sm font-medium"
              >
                הוסף תור חדש
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {todayConfirmedBookings.map(booking => (
                <div
                  key={booking.id}
                  className="bg-[#1A1F35] rounded-2xl p-4 border-2 border-gray-800 hover:border-gray-700 transition-colors"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="text-center min-w-[65px]">
                      <p className="text-2xl font-bold text-[#FF6B35] leading-none mb-1">
                        {formatTime(booking.time)}
                      </p>
                      <p className="text-xs text-[#94A3B8]">{booking.duration}′</p>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-base">{booking.client_name || 'לקוח'}</h3>
                        <span className="bg-green-500/20 text-green-500 text-xs px-2 py-0.5 rounded-md font-medium">
                          מאושר
                        </span>
                      </div>
                      <p className="text-sm text-[#94A3B8] mb-1">{booking.service_name}</p>
                      <p className="text-xs text-[#94A3B8]">עם {booking.staff_name}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => navigate(createPageUrl("CreateBooking") + `?edit=${booking.id}`)}
                      className="bg-white/5 hover:bg-white/10 rounded-lg py-2 text-xs font-medium transition-colors"
                    >
                      ערוך
                    </button>
                    <button
                      onClick={() => handleCancel(booking)}
                      disabled={cancelMutation.isPending}
                      className="bg-white/5 hover:bg-red-500/20 rounded-lg py-2 text-xs font-medium text-red-400 transition-colors disabled:opacity-50"
                    >
                      בטל
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Invite Clients Section - Minimized & Collapsible */}
        <div className="px-6 mb-6">
          <button
            onClick={() => setShowReferral(!showReferral)}
            className="w-full bg-[#1A1F35] border-2 border-gray-800 rounded-xl p-4 flex items-center justify-between hover:border-[#FF6B35] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FF6B35] to-[#FF1744] flex items-center justify-center">
                <Send className="w-5 h-5 text-white" />
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">הזמן לקוחות</p>
                <p className="text-xs text-[#94A3B8]">שתף קוד או לינק הצטרפות</p>
              </div>
            </div>
            <ChevronLeft
              className={`w-5 h-5 text-[#94A3B8] transition-transform ${showReferral ? 'rotate-90' : ''}`}
            />
          </button>

          {showReferral && (
            <div className="mt-3 bg-gradient-to-l from-[#FF6B35] to-[#FF1744] rounded-xl p-5 animate-slideDown">
              {/* Business Code */}
              <div className="bg-white/20 rounded-lg p-4 text-center mb-3">
                <p className="text-xs opacity-90 mb-2">קוד העסק</p>
                <p className="text-3xl font-bold tracking-widest">{business.business_code}</p>
              </div>

              {/* Invitation Link */}
              <div className="bg-white/10 rounded-lg p-3 mb-4">
                <p className="text-xs opacity-90 mb-2 text-center">לינק הצטרפות</p>
                <p className="text-xs break-all text-center opacity-80">
                  {window.location.origin}/BusinessPreview/{business.business_code}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  onClick={() => {
                    const inviteLink = `${window.location.origin}/BusinessPreview/${business.business_code}`;
                    const message = `היי! הצטרף לעסק שלי "${business.name}" ב-LinedUp כדי לקבוע תורים:\n${inviteLink}\n\nאו הזן קוד: ${business.business_code}`;
                    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
                    window.open(whatsappUrl, '_blank');
                  }}
                  className="w-full bg-white/20 hover:bg-white/30 rounded-lg py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  שתף ב-WhatsApp
                </button>

                <button
                  onClick={() => {
                    const inviteLink = `${window.location.origin}/BusinessPreview/${business.business_code}`;
                    navigator.clipboard.writeText(inviteLink);
                    alert('הלינק הועתק ללוח!');
                  }}
                  className="w-full bg-white/20 hover:bg-white/30 rounded-lg py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  העתק לינק
                </button>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(business.business_code);
                    alert('הקוד הועתק ללוח!');
                  }}
                  className="w-full bg-white/20 hover:bg-white/30 rounded-lg py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  העתק קוד בלבד
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Weekly/Monthly Stats */}
        <div className="px-6 mb-20">
          <h2 className="text-lg font-bold mb-4">סטטיסטיקות</h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#1A1F35] rounded-xl p-4 border-2 border-gray-800">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <p className="text-xs text-[#94A3B8]">השבוע</p>
              </div>
              <p className="text-2xl font-bold mb-1">{weekStats.appointments}</p>
              <p className="text-xs text-[#94A3B8]">תורים</p>
            </div>

            <div className="bg-[#1A1F35] rounded-xl p-4 border-2 border-gray-800">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-[#FF6B35]" />
                <p className="text-xs text-[#94A3B8]">החודש</p>
              </div>
              <p className="text-2xl font-bold mb-1">{monthStats.appointments}</p>
              <p className="text-xs text-[#94A3B8]">תורים</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-slideDown {
          animation: slideDown 0.2s ease-out;
        }

        @keyframes pulse-slow {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.95;
          }
        }

        .animate-pulse-slow {
          animation: pulse-slow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}