import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl, formatTime } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useUser } from "@/components/UserContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Loader2, Clock, Wallet, Plus, Check, Phone, X, MessageCircle, Share2, Copy, ChevronLeft, TrendingUp, Bell, Send, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, parseISO, startOfDay, addDays } from "date-fns";
import { he } from "date-fns/locale";
import NotificationDropdown from "../components/NotificationDropdown";
import MessageUsageCard from "@/components/MessageUsageCard";

// WhatsApp Service API
const WHATSAPP_API_URL = 'https://linedup-official-production.up.railway.app';

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
    keepPreviousData: true,
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

  // Helper to normalize date format
  const normalizeDate = (dateStr) => {
    if (!dateStr) return '';
    if (dateStr.includes('/')) {
      const [d, m, y] = dateStr.split('/');
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return dateStr;
  };

  // Separate pending and confirmed bookings for today
  const today = format(new Date(), 'yyyy-MM-dd');
  const pendingBookings = allBookings.filter(b => {
    const bookingDate = normalizeDate(b.date);
    return b.status === 'pending_approval' && bookingDate >= today;
  }).sort((a, b) => {
    const dateA = new Date(`${normalizeDate(a.date)}T${a.time}`);
    const dateB = new Date(`${normalizeDate(b.date)}T${b.time}`);
    return dateA - dateB;
  });

  const todayConfirmedBookings = allBookings.filter(b => {
    const bookingDate = normalizeDate(b.date);
    return bookingDate === today && b.status === 'confirmed';
  }).sort((a, b) => {
    const [hoursA, minutesA] = a.time.split(':').map(Number);
    const [hoursB, minutesB] = b.time.split(':').map(Number);
    return (hoursA * 60 + minutesA) - (hoursB * 60 + minutesB);
  });

  // Calculate stats - simplified
  const todayStats = {
    appointments: allBookings.filter(b => {
      const bookingDate = normalizeDate(b.date);
      return bookingDate === today && (b.status === 'confirmed' || b.status === 'completed');
    }).length,
    pending: pendingBookings.length
  };

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = format(weekAgo, 'yyyy-MM-dd');

  const weekStats = {
    appointments: allBookings.filter(b => {
      const bookingDate = normalizeDate(b.date);
      return bookingDate >= weekAgoStr && (b.status === 'confirmed' || b.status === 'completed');
    }).length
  };

  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = format(monthStart, 'yyyy-MM-dd');

  const monthStats = {
    appointments: allBookings.filter(b => {
      const bookingDate = normalizeDate(b.date);
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
        try {
          console.log('📱 Sending WhatsApp approval confirmation...');
          await fetch(`${WHATSAPP_API_URL}/api/send-confirmation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: booking.client_phone,
              clientName: booking.client_name,
              businessName: business?.name || 'העסק',
              date: booking.date,
              time: booking.time,
              whatsappEnabled: true
            })
          });
          console.log('✅ WhatsApp approval confirmation sent');
        } catch (error) {
          console.error('❌ Failed to send WhatsApp:', error);
        }
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
        try {
          console.log('📱 Sending WhatsApp rejection notification...');
          await fetch(`${WHATSAPP_API_URL}/api/send-update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: booking.client_phone,
              clientName: booking.client_name,
              businessName: business?.name || 'העסק',
              whatsappEnabled: true
            })
          });
          console.log('✅ WhatsApp rejection notification sent');
        } catch (error) {
          console.error('❌ Failed to send WhatsApp:', error);
        }
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
        try {
          console.log('📱 Sending WhatsApp cancellation notification...');
          await fetch(`${WHATSAPP_API_URL}/api/send-update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: booking.client_phone,
              clientName: booking.client_name,
              businessName: business?.name || 'העסק',
              whatsappEnabled: true
            })
          });
          console.log('✅ WhatsApp cancellation notification sent');
        } catch (error) {
          console.error('❌ Failed to send WhatsApp:', error);
        }
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

  // Helper to parse date for display
  const parseBookingDate = (dateStr) => {
    if (!dateStr) return new Date();
    if (dateStr.includes('/')) {
      const [d, m, y] = dateStr.split('/');
      return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    }
    return parseISO(dateStr);
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
      <div className="min-h-screen bg-[#0C0F1D] flex items-center justify-center p-6">
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
    <div className={`min-h-screen bg-[#0C0F1D] pb-24 pt-safe ${showNotifications ? 'overflow-hidden h-screen' : ''}`}>
      {showNotifications && (
        <NotificationDropdown
          businessId={business?.id}
          onClose={() => setShowNotifications(false)}
        />
      )}
      
      <div className="max-w-4xl mx-auto">
        {/* Hero Section - Greeting + Stats */}
        <div className="p-6 pt-4 space-y-4">
          {/* Greeting with Notification Bell */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">שלום, {user?.name}! 👋</h1>
              <p className="text-[#94A3B8]">{business.name}</p>
            </div>
            
            <button
              onClick={() => setShowNotifications(true)}
              className="relative p-3 bg-[#1A1F35] rounded-xl border-2 border-gray-800 hover:border-[#FF6B35] transition-all hover:scale-110"
            >
              <Bell className="w-6 h-6 text-white" />
              {unreadCount > 0 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-[#FF6B35] to-[#FF1744] rounded-full flex items-center justify-center text-xs font-bold animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </div>
              )}
            </button>
          </div>

          {/* Today's Stats - 2 Column Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#1A1F35] rounded-2xl p-4 border-2 border-gray-800 text-center">
              <Calendar className="w-5 h-5 mx-auto mb-2 text-[#FF6B35]" />
              <p className="text-2xl font-bold mb-1">{todayStats.appointments}</p>
              <p className="text-xs text-[#94A3B8]">תורים היום</p>
            </div>

            <div className="bg-[#1A1F35] rounded-2xl p-4 border-2 border-gray-800 text-center">
              <Clock className="w-5 h-5 mx-auto mb-2 text-yellow-500" />
              <p className="text-2xl font-bold mb-1">{todayStats.pending}</p>
              <p className="text-xs text-[#94A3B8]">ממתינים</p>
            </div>
          </div>

          {/* Message Usage Card */}
          <MessageUsageCard businessId={business?.id} />

          {/* Statistics Link */}
          <button
            onClick={() => navigate(createPageUrl("Statistics"))}
            className="w-full bg-[#1A1F35] rounded-2xl p-4 border border-gray-800 flex items-center justify-between hover:border-[#FF6B35] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#FF6B35]/20 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-[#FF6B35]" />
              </div>
              <div className="text-right">
                <p className="font-semibold">סטטיסטיקות ודוחות</p>
                <p className="text-xs text-[#94A3B8]">צפה בנתוני העסק שלך</p>
              </div>
            </div>
            <ChevronLeft className="w-5 h-5 text-[#94A3B8]" />
          </button>

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
              onClick={() => navigate(createPageUrl("CalendarView"))}
              className="bg-[#1A1F35] border-2 border-gray-800 rounded-xl py-4 font-semibold hover:border-[#FF6B35] transition-colors"
            >
              עבור ליומן
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
                          <span>{format(parseBookingDate(booking.date), 'd.M', { locale: he })}</span>
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
        <div className="px-6 mb-6">
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

        {/* Referral Code - Minimized & Collapsible */}
        <div className="px-6 mb-6">
          <button
            onClick={() => setShowReferral(!showReferral)}
            className="w-full bg-[#1A1F35] border-2 border-gray-800 rounded-xl p-4 flex items-center justify-between hover:border-[#FF6B35] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FF6B35] to-[#FF1744] flex items-center justify-center">
                <Share2 className="w-5 h-5 text-white" />
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">קוד העסק שלך</p>
                <p className="text-xs text-[#94A3B8]">שתף עם לקוחות</p>
              </div>
            </div>
            <ChevronLeft
              className={`w-5 h-5 text-[#94A3B8] transition-transform ${showReferral ? 'rotate-90' : ''}`}
            />
          </button>

          {showReferral && (
            <div className="mt-3 bg-gradient-to-l from-[#FF6B35] to-[#FF1744] rounded-xl p-5 animate-slideDown">
              <div className="bg-white/20 rounded-lg p-4 text-center mb-3">
                <p className="text-3xl font-bold tracking-widest">{business.business_code}</p>
              </div>
              <p className="text-sm text-center opacity-90 mb-3">
                שתף קוד זה עם לקוחות כדי שיוכלו להצטרף לעסק שלך
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(business.business_code);
                  alert('הקוד הועתק ללוח!');
                }}
                className="w-full bg-white/20 hover:bg-white/30 rounded-lg py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Copy className="w-4 h-4" />
                העתק קוד
              </button>
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

      <style jsx>{`
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