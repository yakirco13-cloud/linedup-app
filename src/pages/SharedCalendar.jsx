import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, Loader2, ChevronLeft, ChevronRight, Building2, RefreshCw } from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay, isToday, parseISO, addDays } from "date-fns";
import { he } from "date-fns/locale";

export default function SharedCalendar() {
  const [shareToken, setShareToken] = useState(null);
  const [viewMode, setViewMode] = useState('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    setShareToken(token);
  }, []);

  const { data: business, isLoading: businessLoading } = useQuery({
    queryKey: ['shared-business', shareToken],
    queryFn: async () => {
      const businesses = await base44.entities.Business.filter({ share_token: shareToken });
      return businesses[0];
    },
    enabled: !!shareToken,
  });

  const { data: bookings = [], isLoading: bookingsLoading, refetch: refetchBookings } = useQuery({
    queryKey: ['shared-bookings', business?.id],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const pastDateStr = format(thirtyDaysAgo, 'yyyy-MM-dd');

      const allBookings = await base44.entities.Booking.filter(
        { business_id: business.id },
        '-date',
        1000
      );

      return allBookings.filter(b => {
        if (b.status !== 'confirmed' && b.status !== 'pending_approval') {
          return false;
        }
        
        let bookingDateStr = b.date;
        if (b.date && b.date.includes('/')) {
          const [d, m, y] = b.date.split('/');
          bookingDateStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        
        return bookingDateStr >= pastDateStr;
      });
    },
    enabled: !!business?.id,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const weekStart = startOfWeek(currentDate, { locale: he, weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { locale: he, weekStartsOn: 0 });
  const allDaysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const daysInWeek = viewMode === 'week'
    ? allDaysInWeek.filter((_, index) => index !== 6)
    : allDaysInWeek;

  const displayDays = viewMode === 'day' ? [currentDate] : [...daysInWeek].reverse();
  const hours = Array.from({ length: 14 }, (_, i) => i + 8);

  // Handle both date formats: YYYY-MM-DD and DD/MM/YYYY
  const getBookingsForDay = (day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayParts = dayStr.split('-');
    const dayStrAlt = `${dayParts[2]}/${dayParts[1]}/${dayParts[0]}`;
    
    return bookings.filter(booking => {
      return booking.date === dayStr || booking.date === dayStrAlt;
    });
  };

  const parseBookingDate = (dateStr) => {
    if (!dateStr) return new Date();
    if (dateStr.includes('/')) {
      const [d, m, y] = dateStr.split('/');
      return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    }
    return parseISO(dateStr);
  };

  const getBookingPosition = (booking) => {
    const [hours, minutes] = booking.time.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    const startMinutes = 8 * 60;
    const minutesFromStart = totalMinutes - startMinutes;
    const position = (minutesFromStart / 60) * 52;
    const height = (booking.duration / 60) * 52;

    return { top: position, height: Math.max(height, 20) };
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'pending_approval': return 'bg-yellow-500';
      case 'confirmed': return 'bg-green-500';
      case 'completed': return 'bg-gray-500';
      case 'cancelled': return 'bg-red-500/50';
      default: return 'bg-[#FF6B35]';
    }
  };

  const previousPeriod = () => {
    if (viewMode === 'day') {
      setCurrentDate(addDays(currentDate, -1));
    } else {
      setCurrentDate(subWeeks(currentDate, 1));
    }
  };

  const nextPeriod = () => {
    if (viewMode === 'day') {
      setCurrentDate(addDays(currentDate, 1));
    } else {
      setCurrentDate(addWeeks(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetchBookings();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  if (!shareToken) {
    return (
      <div className="min-h-screen bg-[#0C0F1D] flex items-center justify-center p-6">
        <div className="text-center">
          <Calendar className="w-16 h-16 text-[#94A3B8] mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">קישור לא תקין</h2>
          <p className="text-[#94A3B8]">לא נמצא קוד שיתוף</p>
        </div>
      </div>
    );
  }

  if (businessLoading) {
    return (
      <div className="min-h-screen bg-[#0C0F1D] flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-[#FF6B35]" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-[#0C0F1D] flex items-center justify-center p-6">
        <div className="text-center">
          <Calendar className="w-16 h-16 text-[#94A3B8] mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">יומן לא נמצא</h2>
          <p className="text-[#94A3B8]">קוד השיתוף לא תקין או שפג תוקפו</p>
        </div>
      </div>
    );
  }

  const todayBookings = getBookingsForDay(currentDate);

  const DayHeader = ({ day }) => {
    const dayIsToday = isToday(day);
    const dayNameShort = format(day, 'EEEEEE', { locale: he });
    const dayNumber = format(day, 'd');

    return (
      <div
        className={`h-14 flex flex-col items-center justify-center border-l border-gray-800 last:border-l-0 ${
          dayIsToday ? 'bg-[#FF6B35]/10' : ''
        }`}
      >
        <span className={`text-xs mb-0.5 ${
          dayIsToday ? 'text-[#FF6B35] font-semibold' : 'text-[#94A3B8]'
        }`}>
          {dayNameShort}
        </span>

        <span className={`text-base font-bold leading-none ${
          dayIsToday ? 'text-[#FF6B35]' : 'text-white'
        }`}>
          {dayNumber}
        </span>
      </div>
    );
  };

  const AppointmentBlock = ({ appointment, onClick }) => {
    const isPending = appointment.status === 'pending_approval';
    const { top, height } = getBookingPosition(appointment);
    
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={`absolute left-1 right-1 rounded-lg p-1.5 text-right overflow-hidden ${
          getStatusColor(appointment.status)
        } hover:brightness-110 transition-all shadow-lg`}
        style={{
          top: `${top}px`,
          height: `${height}px`,
        }}
      >
        {isPending && (
          <div className="absolute top-1 left-1 w-2 h-2 bg-white rounded-full animate-pulse" />
        )}
        
        <p className="text-[10px] font-bold text-white leading-tight break-words">
          {appointment.client_name || 'תור'}
        </p>
      </button>
    );
  };

  return (
    <div className="h-screen bg-[#0C0F1D] flex flex-col overflow-hidden fixed inset-0">
      {/* Booking Details Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6" onClick={() => setSelectedBooking(null)}>
          <div className="bg-[#1A1F35] rounded-3xl max-w-md w-full border-2 border-gray-800" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-800 p-5 flex items-center justify-between">
              <h3 className="text-xl font-bold">פרטי התור</h3>
              <button onClick={() => setSelectedBooking(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-[#0C0F1D] rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FF1744] flex items-center justify-center text-2xl font-bold flex-shrink-0">
                    {selectedBooking.client_name ? selectedBooking.client_name[0].toUpperCase() : '?'}
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">{selectedBooking.client_name}</h4>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2 text-[#94A3B8]">
                    <span className="text-sm">שירות</span>
                  </div>
                  <span className="font-semibold">{selectedBooking.service_name}</span>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2 text-[#94A3B8]">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm">תאריך</span>
                  </div>
                  <span className="font-semibold">{format(parseBookingDate(selectedBooking.date), 'd בMMMM yyyy', { locale: he })}</span>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2 text-[#94A3B8]">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">שעה</span>
                  </div>
                  <span className="font-semibold">{selectedBooking.time}</span>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2 text-[#94A3B8]">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">משך</span>
                  </div>
                  <span className="font-semibold">{selectedBooking.duration} דקות</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-[#1A1F35] border-b border-gray-800 pt-safe">
        <div className="p-4 pb-2">
          {/* Business Name */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <Building2 className="w-6 h-6 text-[#FF6B35]" />
            <h1 className="text-xl font-bold">{business.name}</h1>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="w-10" />

            <div className="text-center flex-1">
              <div className="flex items-center justify-center mb-1">
                <button onClick={nextPeriod} className="p-2">
                  <ChevronRight className="w-6 h-6" />
                </button>

                <h1 className="text-base font-bold px-3 whitespace-nowrap">
                  {viewMode === 'day'
                    ? format(currentDate, 'd בMMMM yyyy', { locale: he })
                    : `${format(weekStart, 'd', { locale: he })}-${format(weekEnd, 'd', { locale: he })} ${format(weekEnd, 'MMMM yyyy', { locale: he })}`
                  }
                </h1>

                <button onClick={previousPeriod} className="p-2">
                  <ChevronLeft className="w-6 h-6" />
                </button>
              </div>

              {!isToday(currentDate) && (
                <button
                  onClick={goToToday}
                  className="text-[#FF6B35] hover:text-[#FF6B35]/80 h-7 text-xs font-medium"
                >
                  חזור להיום
                </button>
              )}
            </div>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('week')}
              className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                viewMode === 'week'
                  ? 'bg-gradient-to-r from-[#FF6B35] to-[#FF1744] text-white scale-105'
                  : 'bg-[#0C0F1D] text-[#94A3B8] border-2 border-gray-800 hover:border-[#FF6B35]'
              }`}
            >
              שבוע
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                viewMode === 'day'
                  ? 'bg-gradient-to-r from-[#FF6B35] to-[#FF1744] text-white scale-105'
                  : 'bg-[#0C0F1D] text-[#94A3B8] border-2 border-gray-800 hover:border-[#FF6B35]'
              }`}
            >
              יום
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      {bookingsLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#FF6B35]" />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto overflow-y-auto pb-safe">
          {/* Day Headers */}
          {viewMode === 'week' && (
            <div className="flex flex-row-reverse border-b-2 border-gray-800 bg-[#0C0F1D]">
              <div className="w-16 flex-shrink-0 border-r-2 border-gray-800" />
              <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(6, 1fr)` }}>
                {displayDays.map((day) => (
                  <DayHeader key={day.toString()} day={day} />
                ))}
              </div>
            </div>
          )}

          {/* Grid Body */}
          <div className="flex flex-row-reverse">
            {/* Time Column */}
            <div className="w-16 flex-shrink-0 bg-[#0C0F1D] border-r-2 border-gray-800">
              {hours.map(hour => (
                <div
                  key={hour}
                  className="h-13 flex items-center justify-center border-t border-gray-800 first:border-t-0"
                  style={{ height: '52px' }}
                >
                  <span className="text-xs text-[#94A3B8] font-medium">
                    {String(hour).padStart(2, '0')}:00
                  </span>
                </div>
              ))}
            </div>

            {/* Day Columns */}
            <div className="flex-1 relative" style={{ minHeight: `${hours.length * 52}px` }}>
              <div className="grid h-full" style={{ gridTemplateColumns: viewMode === 'week' ? `repeat(6, 1fr)` : '1fr' }}>
                {displayDays.map((day) => {
                  const dayBookings = getBookingsForDay(day);
                  const dayIsToday = isToday(day);

                  return (
                    <div
                      key={day.toString()}
                      className="relative border-r border-gray-800 first:border-r-0"
                    >
                      {hours.map((hour) => (
                        <div
                          key={`${day}-${hour}`}
                          className={`border-t border-gray-800 first:border-t-0 ${
                            dayIsToday ? 'bg-[#FF6B35]/5' : ''
                          }`}
                          style={{ height: '52px' }}
                        />
                      ))}

                      {dayBookings.map((booking) => {
                        return (
                          <AppointmentBlock
                            key={booking.id}
                            appointment={booking}
                            onClick={() => setSelectedBooking(booking)}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {viewMode === 'day' && todayBookings.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center px-6">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#1A1F35] flex items-center justify-center">
                      <Calendar className="w-10 h-10 text-[#94A3B8]" />
                    </div>
                    <h3 className="lg font-semibold mb-2">אין תורים ליום זה</h3>
                    <p className="text-sm text-[#94A3B8]">
                      בחר יום אחר לצפייה
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer Note */}
      <div className="bg-[#1A1F35] border-t border-gray-800 p-3 text-center">
        <p className="text-xs text-[#94A3B8]">
          🔒 תצוגה לקריאה בלבד
        </p>
      </div>
    </div>
  );
}