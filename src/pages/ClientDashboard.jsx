import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useUser } from "@/components/UserContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Clock, Plus, MessageCircle, Phone, MapPin, CheckCircle, X, Navigation, Edit, Scissors, Wallet, Bell, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { he } from "date-fns/locale";
import page from "@/components/Page";

export default function ClientDashboard() {
  const navigate = useNavigate();
  const { user, refetchUser } = useUser();
  const queryClient = useQueryClient();
  
  // Waiting list popup state
  const [waitingListPopup, setWaitingListPopup] = useState(null);
  const [popupDismissed, setPopupDismissed] = useState(false);



  // Get barbershop (assume first/only business)
  const { data: business, refetch: refetchBusiness, isLoading: businessLoading } = useQuery({
    queryKey: ['my-barbershop', user?.phone, user?.joined_businesses],
    queryFn: async () => {
      console.log('Fetching business with joined_businesses:', user?.joined_businesses);
      if (!user?.joined_businesses || user.joined_businesses.length === 0) {
        console.log('No joined businesses found');
        return null;
      }
      const businesses = await base44.entities.Business.filter({ id: user.joined_business_id });
      console.log('Fetched businesses:', businesses);
      return businesses[0] || null;
    },
    enabled: !!user?.phone,
    staleTime: 10 * 60 * 1000,
    cacheTime: 15 * 60 * 1000,
    refetchOnWindowFocus: true,
    keepPreviousData: true,
  });

  // Refetch business when user or joined_businesses changes
  useEffect(() => {
    if (user?.joined_business_id && user.joined_business_id) {
      console.log('User joined businesses changed, refetching...', user.joined_businesses);
      refetchBusiness();
    }
  }, [user?.phone, user?.joined_businesses, refetchBusiness]);

  // Get next upcoming appointment
  const { data: nextAppointment } = useQuery({
    queryKey: ['next-appointment', user?.phone],
    queryFn: async () => {
      const allBookings = await base44.entities.Booking.filter(
        { client_phone: user.phone, status: 'confirmed' },
        'date',
        20
      );
      const upcoming = allBookings.filter(b => new Date(`${b.date}T${b.time}`) >= new Date());
      return upcoming.length > 0 ? upcoming[0] : null;
    },
    enabled: !!user?.phone,
    staleTime: 5 * 1000,
    cacheTime: 5 * 60 * 1000,
    refetchInterval: 20000,
    refetchOnWindowFocus: true,
    keepPreviousData: true,
  });

  // Get appointment history - ONLY for current business
  const { data: recentAppointments = [] } = useQuery({
    queryKey: ['recent-appointments', user?.phone, business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      
      const allBookings = await base44.entities.Booking.filter(
        { 
          client_phone: user.phone,
          business_id: business.id  // Filter by current business
        },
        '-date',
        20
      );
      return allBookings
        .filter(b => b.status === 'completed' || b.status === 'cancelled')
        .slice(0, 3);
    },
    enabled: !!user?.phone && !!business?.id,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    keepPreviousData: true,
  });

  // Get most frequently booked services
  const { data: frequentServices = [] } = useQuery({
    queryKey: ['frequent-services', user?.phone, business?.id],
    queryFn: async () => {
      if (!business) return [];
      
      const completedBookings = await base44.entities.Booking.filter({
        client_phone: user.phone,
        business_id: business.id,
        status: 'completed'
      });

      const serviceCounts = {};
      completedBookings.forEach(booking => {
        serviceCounts[booking.service_id] = (serviceCounts[booking.service_id] || 0) + 1;
      });

      const topServiceIds = Object.entries(serviceCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([id]) => id);

      if (topServiceIds.length === 0) {
        // If no completed bookings, show the first 4 services of the business
        const allServices = await base44.entities.Service.filter({ business_id: business.id });
        return allServices.slice(0, 4);
      }

      const services = await Promise.all(
        topServiceIds.map(id => base44.entities.Service.filter({ id }))
      );
      return services.map(s => s[0]).filter(Boolean);
    },
    enabled: !!user?.phone && !!business?.id,
    staleTime: 10 * 60 * 1000,
    cacheTime: 15 * 60 * 1000,
    refetchOnWindowFocus: true,
    keepPreviousData: true,
  });

  // Check waiting list entries that have been NOTIFIED (slot actually opened)
  useEffect(() => {
    const checkWaitingListNotifications = async () => {
      if (!user?.phone || !business?.id || popupDismissed) return;
      
      try {
        // Get user's waiting list entries that have been NOTIFIED (a real slot opened)
        const notifiedEntries = await base44.entities.WaitingList.filter({
          client_phone: user.phone,
          business_id: business.id,
          status: 'notified'  // Only entries where we actually notified them of availability
        });
        
        if (notifiedEntries.length === 0) return;
        
        // Find first future date entry
        for (const entry of notifiedEntries) {
          const entryDate = new Date(entry.date);
          const today = new Date(new Date().toDateString());
          
          // Skip past dates
          if (entryDate < today) continue;
          
          // Show popup for this notified entry
          setWaitingListPopup({
            date: entry.date,
            serviceName: entry.service_name,
            entryId: entry.id
          });
          break; // Show popup for first available
        }
      } catch (error) {
        console.error('Error checking waiting list notifications:', error);
      }
    };
    
    checkWaitingListNotifications();
  }, [user?.phone, business?.id, popupDismissed]);

  // Check if user has any completed bookings
  const hasCompletedBookings = recentAppointments.some(b => b.status === 'completed');

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: async (booking) => {
      await base44.entities.Booking.update(booking.id, { status: 'cancelled' });
      return booking;
    },
    onSuccess: async (booking) => {
      // Create notification for business owner about cancellation
      try {
        console.log('📢 Creating cancellation notification for business:', booking.business_id);
        const notification = await base44.entities.Notification.create({
          business_id: booking.business_id,
          type: 'booking_cancelled',
          title: 'תור בוטל',
          message: `${booking.client_name} ביטל/ה את התור ל-${booking.service_name} בתאריך ${format(parseISO(booking.date), 'd.M.yyyy', { locale: he })} בשעה ${booking.time}`,
          booking_id: booking.id,
          client_name: booking.client_name,
          is_read: false
        });
        console.log('✅ Cancellation notification created:', notification);
      } catch (error) {
        console.error('❌ Failed to create cancellation notification:', error);
      }
      
      queryClient.invalidateQueries({ queryKey: ['next-appointment'] });
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      await queryClient.refetchQueries({ queryKey: ['notifications', booking.business_id] });
    },
  });

  const formatPhoneForWhatsApp = (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      return '+972' + cleaned.substring(1);
    }
    return '+' + cleaned;
  };

  const handleCancelAppointment = () => {
    if (window.confirm('האם אתה בטוח שברצונך לבטל את התור?')) {
      cancelMutation.mutate(nextAppointment);
    }
  };

  const handleRescheduleAppointment = () => {
    // Navigate to edit booking page with the booking ID
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
    
    // Get first enabled day's hours
    const firstDaySchedule = business.working_hours[enabledDays[0]];
    
    // Check if it has shifts array or direct start/end
    if (firstDaySchedule.shifts && Array.isArray(firstDaySchedule.shifts) && firstDaySchedule.shifts.length > 0) {
      const firstShift = firstDaySchedule.shifts[0];
      return `${firstShift.start} - ${firstShift.end}`;
    } else if (firstDaySchedule.start && firstDaySchedule.end) {
      return `${firstDaySchedule.start} - ${firstDaySchedule.end}`;
    }
    
    return 'לא זמין כרגע';
  };

  // First time user - no business joined
  if (businessLoading) {
    return (
      <div className="min-h-screen bg-[#0C0F1D] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#FF6B35]"></div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-[#0C0F1D] flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-[#FF6B35] to-[#FF1744] flex items-center justify-center">
            <Calendar className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-4">ברוכים הבאים ל-LinedUp!</h1>
          <p className="text-[#94A3B8] text-lg leading-relaxed mb-12">
            הצטרף למספרה כדי להתחיל לקבוע תורים
          </p>
          <Button
            onClick={() => navigate(createPageUrl("JoinBusiness"))}
            className="h-14 px-8 rounded-xl text-lg font-semibold hover:scale-105 transition-transform"
            style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
          >
            <Plus className="w-6 h-6 ml-2" />
            הצטרף למספרה
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0C0F1D]" style={{ minHeight: '100vh', backgroundColor: '#0C0F1D' }}>
      {/* Waiting List Availability Popup */}
      {waitingListPopup && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
          <div className="bg-[#1A1F35] rounded-3xl max-w-md w-full border-2 border-green-500/50 overflow-hidden animate-in fade-in zoom-in duration-300">
            {/* Header with sparkle effect */}
            <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-green-400 animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold text-green-400 mb-2">התפנה מקום! 🎉</h2>
              <p className="text-white text-lg">
                יש תור פנוי בתאריך שביקשת
              </p>
            </div>
            
            {/* Content */}
            <div className="p-6">
              <div className="bg-[#0C0F1D] rounded-2xl p-4 mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <Calendar className="w-5 h-5 text-green-400" />
                  <span className="text-white font-bold text-lg">
                    {format(parseISO(waitingListPopup.date), 'EEEE, d בMMMM', { locale: he })}
                  </span>
                </div>
                {waitingListPopup.serviceName && (
                  <div className="flex items-center gap-3">
                    <Scissors className="w-5 h-5 text-[#94A3B8]" />
                    <span className="text-[#94A3B8]">{waitingListPopup.serviceName}</span>
                  </div>
                )}
              </div>
              
              <p className="text-[#94A3B8] text-center mb-6">
                מהרו לתפוס את התור לפני שיתפוס!
              </p>
              
              <div className="space-y-3">
                <Button
                  onClick={async () => {
                    // Update waiting list status to 'booked' when they click to book
                    try {
                      await base44.entities.WaitingList.update(waitingListPopup.entryId, {
                        status: 'booked'
                      });
                    } catch (e) {
                      console.error('Failed to update waiting list status:', e);
                    }
                    navigate(`/BookAppointment?date=${waitingListPopup.date}`);
                  }}
                  className="w-full h-14 rounded-xl text-white font-bold text-lg"
                  style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
                >
                  <Calendar className="w-5 h-5 ml-2" />
                  קבע תור עכשיו!
                </Button>
                
                <button
                  onClick={() => {
                    setWaitingListPopup(null);
                    setPopupDismissed(true);
                  }}
                  className="w-full py-3 text-[#94A3B8] hover:text-white transition-colors"
                >
                  אזכיר לי אחר כך
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ HEADER WITH FULL BACKGROUND IMAGE ============ */}
      <div className="relative">
        {/* Background Image - Extends behind header and card */}
        {business.photo_url && (
          <div 
            className="absolute top-0 left-0 right-0 h-64 bg-cover bg-center"
            style={{ backgroundImage: `url(${business.photo_url})` }}
          />
        )}
        
        {/* Gradient overlay - Fades to background color */}
        <div 
          className="absolute top-0 left-0 right-0 h-64"
          style={{ 
            background: business.photo_url 
              ? 'linear-gradient(180deg, rgba(255,107,53,0.75) 0%, rgba(255,77,42,0.85) 50%, #0C0F1D 100%)'
              : 'linear-gradient(180deg, #FF6B35 0%, #FF4D2A 50%, #0C0F1D 100%)'
          }}
        />
        
        {/* Greeting - on top of background */}
        <div className="relative z-10 px-5 pt-14 pb-4">
          <div className="flex items-center gap-3">
            {business.photo_url ? (
              <div 
                className="w-12 h-12 rounded-xl bg-cover bg-center border-2 border-white/30 flex-shrink-0"
                style={{ backgroundImage: `url(${business.photo_url})` }}
              />
            ) : (
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.2)' }}
              >
                <Scissors className="w-6 h-6 text-white" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">שלום, {user?.name?.split(' ')[0] || 'אורח'}</h1>
                <span className="text-xl">👋</span>
              </div>
              <p className="text-white/80 text-sm">{business.name}</p>
            </div>
          </div>
        </div>
        
        {/* ============ APPOINTMENT CARD ============ */}
        <div className="relative z-10 px-4 pb-4">
          {nextAppointment ? (
            <div 
              className="rounded-3xl p-5"
              style={{ 
                background: '#1A1F35',
                boxShadow: '0 20px 40px -12px rgba(0,0,0,0.5)'
              }}
            >
              {/* Badge + Label row */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-white/60 text-sm">התור הבא שלך</span>
                <span 
                  className="px-3 py-1 rounded-full text-xs font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #FF1744 100%)' }}
                >
                  {isToday(parseISO(nextAppointment.date)) ? 'היום' :
                   isTomorrow(parseISO(nextAppointment.date)) ? 'מחר' :
                   format(parseISO(nextAppointment.date), 'd בMMMM', { locale: he })}
                </span>
              </div>
              
              {/* Time + Icon row */}
              <div className="flex items-center justify-between mb-4">
                <div 
                  className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #FF1744 100%)' }}
                >
                  <Scissors className="w-7 h-7 text-white" />
                </div>
                <div className="text-left">
                  <span 
                    className="text-5xl font-bold text-white"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {nextAppointment.time.substring(0, 5)}
                  </span>
                  <p className="text-[#94A3B8] text-sm mt-1">
                    {format(parseISO(nextAppointment.date), 'EEEE, d בMMMM', { locale: he })}
                  </p>
                </div>
              </div>
              
              {/* Service info bar */}
              <div 
                className="p-4 rounded-2xl flex items-center justify-between"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                <div className="flex gap-2">
                  <button 
                    onClick={handleCancelAppointment}
                    disabled={cancelMutation.isPending}
                    className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                    style={{ background: 'rgba(239,68,68,0.15)' }}
                  >
                    <X className="w-5 h-5 text-red-400" />
                  </button>
                  <button 
                    onClick={handleRescheduleAppointment}
                    className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                    style={{ background: 'rgba(255,107,53,0.15)' }}
                  >
                    <Edit className="w-5 h-5 text-[#FF6B35]" />
                  </button>
                </div>
                <div className="text-right">
                  <p className="text-white font-semibold">{nextAppointment.service_name}</p>
                  <p className="text-[#94A3B8] text-sm flex items-center justify-end gap-2">
                    <span>עם {nextAppointment.staff_name}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      {nextAppointment.duration} דקות
                      <Clock className="w-3.5 h-3.5" />
                    </span>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div 
              className="rounded-3xl p-6 text-center"
              style={{ 
                background: '#1A1F35',
                boxShadow: '0 20px 40px -12px rgba(0,0,0,0.5)'
              }}
            >
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#FF6B35] to-[#FF1744] flex items-center justify-center">
                <Calendar className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">אין לך תור קרוב</h2>
              <p className="text-[#94A3B8] mb-5">הגיע הזמן לתספורת חדשה?</p>
              <Button
                onClick={() => navigate(createPageUrl("BookAppointment"))}
                className="h-12 px-6 rounded-xl text-base font-semibold hover:scale-105 active:scale-95 transition-transform"
                style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
              >
                <Plus className="w-5 h-5 ml-2" />
                קבע תור עכשיו
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ============ REST OF CONTENT - Directly after header, no gap ============ */}
      <div className="px-4 pt-4">
        {/* ============ SERVICES GRID ============ */}
        {frequentServices.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">
                {hasCompletedBookings ? 'קבע שוב' : 'השירותים שלנו'}
              </h2>
              <button 
                onClick={() => navigate(createPageUrl("BookAppointment"))}
                className="text-[#FF6B35] text-sm font-medium"
              >
                הכל
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {frequentServices.map((service, index) => (
                <button
                  key={service.id}
                  onClick={() => handleRebookService(service.id)}
                  className="bg-[#1A1F35] rounded-2xl p-4 text-right transition-all hover:scale-[1.02] active:scale-[0.98] relative"
                  style={{ 
                    border: index === 0 ? '1px solid rgba(255,107,53,0.4)' : '1px solid rgba(255,255,255,0.05)'
                  }}
                >
                  {/* Popular badge for first item */}
                  {index === 0 && (
                    <span 
                      className="absolute -top-2.5 right-3 px-2.5 py-1 rounded-md text-[10px] font-bold"
                      style={{ 
                        background: 'linear-gradient(135deg, #FF6B35 0%, #FF1744 100%)', 
                        color: 'white' 
                      }}
                    >
                      פופולרי
                    </span>
                  )}
                  
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#FF6B35]/20 to-[#FF1744]/20 flex items-center justify-center mb-3">
                    <Scissors className="w-5 h-5 text-[#FF6B35]" />
                  </div>
                  <h3 className="font-semibold text-white mb-1">{service.name}</h3>
                  <p className="text-[#94A3B8] text-xs flex items-center gap-1 mb-2">
                    <Clock className="w-3 h-3" />
                    {service.duration} דקות
                  </p>
                  {service.price > 0 && (
                    <p className="text-xl font-bold text-[#FF6B35]">₪{service.price}</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ============ APPOINTMENT HISTORY ============ */}
        {recentAppointments.length > 0 && (
          <div className="bg-[#1A1F35] rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">היסטוריית תורים</h2>
              <button
                onClick={() => navigate(createPageUrl("MyBookings"))}
                className="text-[#FF6B35] text-sm font-medium"
              >
                ראה הכל
              </button>
            </div>

            <div className="space-y-3">
              {recentAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="bg-[#0C0F1D] rounded-xl p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      appointment.status === 'completed' 
                        ? 'bg-green-500/15' 
                        : 'bg-red-500/15'
                    }`}>
                      {appointment.status === 'completed' ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <X className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-white">{appointment.service_name}</h3>
                      <p className="text-xs text-[#94A3B8]">
                        {format(parseISO(appointment.date), 'd בMMMM yyyy', { locale: he })}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRebookService(appointment.service_id)}
                    className="text-[#FF6B35] text-sm font-medium flex items-center gap-1 hover:text-[#FF8555] transition-colors"
                  >
                    <Calendar className="w-4 h-4" />
                    קבע שוב
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============ BUSINESS INFO CARD ============ */}
        <div className="bg-[#1A1F35] rounded-2xl overflow-hidden">
          {/* Business name banner */}
          <div 
            className="py-4 px-5 text-center"
            style={{ 
              background: 'linear-gradient(90deg, #FF6B35 0%, #FF1744 100%)'
            }}
          >
            <span className="text-white font-bold text-lg">{business.name}</span>
          </div>
          
          <div className="p-5">
            {/* Working Hours */}
            <div className="flex items-center gap-3 mb-5">
              <div 
                className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,107,53,0.15)' }}
              >
                <Clock className="w-5 h-5 text-[#FF6B35]" />
              </div>
              <div>
                <p className="text-[#94A3B8] text-xs">שעות פעילות</p>
                <p className="text-white text-sm font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400"></span>
                  {getWorkingHoursDisplay() || 'לא זמין כרגע'}
                </p>
              </div>
            </div>
            
            {/* Contact Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <a
                href={`https://wa.me/${formatPhoneForWhatsApp(business.phone)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 h-12 bg-[#25D366] hover:bg-[#25D366]/90 rounded-xl text-white font-semibold transition-all active:scale-[0.98]"
              >
                <MessageCircle className="w-5 h-5" />
                WhatsApp
              </a>
              <a
                href={`tel:${business.phone}`}
                className="flex items-center justify-center gap-2 h-12 rounded-xl text-white font-semibold transition-all active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
              >
                <Phone className="w-5 h-5" />
                התקשר
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}