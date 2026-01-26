import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl, formatTime } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useUser } from "@/components/UserContext";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ArrowRight, Calendar, Clock, User, Loader2, Bell, Phone, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format, addDays, startOfWeek, endOfWeek } from "date-fns";
import { he } from "date-fns/locale";
import { parseDate, formatNumeric } from "@/services/dateService";

export default function AllBookings() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState('bookings'); // 'bookings' or 'waiting'
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // 'today', 'week', 'all'

  // Fetch all bookings for the business
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['all-business-bookings', user?.business_id],
    queryFn: () => base44.entities.Booking.filter({
      business_id: user.business_id,
    }, '-date', 200),
    enabled: !!user?.business_id,
    staleTime: 10 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });

  // Fetch all waiting list entries for the business
  const { data: waitingListEntries = [], isLoading: waitingListLoading } = useQuery({
    queryKey: ['all-business-waiting-list', user?.business_id],
    queryFn: async () => {
      const [waitingEntries, notifiedEntries] = await Promise.all([
        base44.entities.WaitingList.filter({
          business_id: user.business_id,
          status: 'waiting'
        }, '-date', 100),
        base44.entities.WaitingList.filter({
          business_id: user.business_id,
          status: 'notified'
        }, '-date', 100)
      ]);

      const allEntries = [...waitingEntries, ...notifiedEntries];
      const today = new Date(new Date().toDateString());

      // Return only non-expired entries (future dates)
      return allEntries.filter(entry => {
        const entryDate = parseDate(entry.date);
        return entryDate && entryDate >= today;
      });
    },
    enabled: !!user?.business_id,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  // Filter to only future bookings
  const futureBookings = bookings
    .filter(b => {
      const bookingDateTime = new Date(`${b.date}T${b.time}`);
      const now = new Date();
      return bookingDateTime >= now && (b.status === 'confirmed' || b.status === 'pending_approval');
    })
    .sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`);
      const dateB = new Date(`${b.date}T${b.time}`);
      return dateA - dateB; // Closest first
    });

  // Apply search filter
  const searchFilteredBookings = futureBookings.filter(booking => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      booking.client_name?.toLowerCase().includes(query) ||
      booking.client_phone?.includes(query)
    );
  });

  const searchFilteredWaiting = waitingListEntries.filter(entry => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      entry.client_name?.toLowerCase().includes(query) ||
      entry.client_phone?.includes(query)
    );
  });

  // Apply date filter
  const today = format(new Date(), 'yyyy-MM-dd');
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd');

  const dateFilteredBookings = searchFilteredBookings.filter(booking => {
    if (dateFilter === 'all') return true;
    if (dateFilter === 'today') return booking.date === today;
    if (dateFilter === 'week') return booking.date >= weekStart && booking.date <= weekEnd;
    return true;
  });

  const dateFilteredWaiting = searchFilteredWaiting.filter(entry => {
    if (dateFilter === 'all') return true;
    if (dateFilter === 'today') return entry.date === today;
    if (dateFilter === 'week') return entry.date >= weekStart && entry.date <= weekEnd;
    return true;
  });

  // Group bookings by date
  const bookingsByDate = dateFilteredBookings.reduce((groups, booking) => {
    const date = booking.date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(booking);
    return groups;
  }, {});

  // Sort bookings within each date by time
  Object.keys(bookingsByDate).forEach(date => {
    bookingsByDate[date].sort((a, b) => {
      const timeA = a.time.split(':').map(Number);
      const timeB = b.time.split(':').map(Number);
      return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
    });
  });

  const isLoading = bookingsLoading || waitingListLoading;

  return (
    <div className="min-h-screen bg-[#0C0F1D]">
      <div className="max-w-2xl mx-auto">
        {/* Sticky Header */}
        <div className="sticky top-0 bg-[#0C0F1D] z-20 p-4 pt-safe border-b border-gray-800/50">
          <button
            onClick={() => navigate(createPageUrl("BusinessDashboard"))}
            className="flex items-center gap-2 text-[#94A3B8] mb-4 hover:text-white transition-colors h-12"
          >
            <ArrowRight className="w-5 h-5" />
            <span className="font-medium">חזרה</span>
          </button>

          <h1 className="text-3xl font-bold">כל התורים</h1>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Tabs */}
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => setActiveTab('bookings')}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all ${
              activeTab === 'bookings'
                ? 'bg-gradient-to-r from-[#FF6B35] to-[#FF1744] text-white shadow-lg'
                : 'bg-[#1A1F35] text-[#94A3B8] border-2 border-gray-800 hover:border-[#FF6B35]'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Calendar className="w-5 h-5" />
              <span>תורים</span>
              <span className={`px-2 py-0.5 rounded-lg text-sm font-bold ${
                activeTab === 'bookings' ? 'bg-white/20' : 'bg-[#FF6B35]/20 text-[#FF6B35]'
              }`}>
                {dateFilteredBookings.length}
              </span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('waiting')}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all ${
              activeTab === 'waiting'
                ? 'bg-gradient-to-r from-[#FF6B35] to-[#FF1744] text-white shadow-lg'
                : 'bg-[#1A1F35] text-[#94A3B8] border-2 border-gray-800 hover:border-[#FF6B35]'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Bell className="w-5 h-5" />
              <span>רשימת המתנה</span>
              <span className={`px-2 py-0.5 rounded-lg text-sm font-bold ${
                activeTab === 'waiting' ? 'bg-white/20' : 'bg-blue-500/20 text-blue-400'
              }`}>
                {dateFilteredWaiting.length}
              </span>
            </div>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
          <Input
            type="text"
            placeholder="חיפוש לפי שם או טלפון..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-[#1A1F35] border-2 border-gray-800 text-white rounded-xl h-12 pr-12 placeholder:text-[#94A3B8] focus:border-[#FF6B35]"
          />
        </div>

        {/* Date Filters */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setDateFilter('today')}
            className={`px-4 py-2 rounded-xl font-medium text-sm transition-all ${
              dateFilter === 'today'
                ? 'bg-[#FF6B35] text-white'
                : 'bg-[#1A1F35] text-[#94A3B8] border border-gray-800 hover:border-[#FF6B35]'
            }`}
          >
            היום
          </button>
          <button
            onClick={() => setDateFilter('week')}
            className={`px-4 py-2 rounded-xl font-medium text-sm transition-all ${
              dateFilter === 'week'
                ? 'bg-[#FF6B35] text-white'
                : 'bg-[#1A1F35] text-[#94A3B8] border border-gray-800 hover:border-[#FF6B35]'
            }`}
          >
            השבוע
          </button>
          <button
            onClick={() => setDateFilter('all')}
            className={`px-4 py-2 rounded-xl font-medium text-sm transition-all ${
              dateFilter === 'all'
                ? 'bg-[#FF6B35] text-white'
                : 'bg-[#1A1F35] text-[#94A3B8] border border-gray-800 hover:border-[#FF6B35]'
            }`}
          >
            הכל
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-16">
            <Loader2 className="w-12 h-12 animate-spin text-[#FF6B35] mx-auto" />
          </div>
        ) : (
          <>
            {/* Bookings Tab */}
            {activeTab === 'bookings' && (
              <div className="mb-6">
                {dateFilteredBookings.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 rounded-full bg-[#1A1F35] flex items-center justify-center mx-auto mb-4">
                      <Calendar className="w-10 h-10 text-[#94A3B8]" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">
                      {searchQuery ? 'לא נמצאו תורים' : 'אין תורים'}
                    </h3>
                    <p className="text-[#94A3B8]">
                      {searchQuery ? 'נסה לחפש משהו אחר' : 'התורים יופיעו כאן'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.keys(bookingsByDate).map((date) => {
                      const dateObj = parseDate(date);
                      const isToday = format(new Date(), 'yyyy-MM-dd') === date;
                      const isTomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd') === date;

                      return (
                        <div key={date} className="space-y-3">
                          {/* Date Header */}
                          <div className="sticky top-0 bg-[#0C0F1D] py-3 border-b-2 border-[#FF6B35]/30 mb-3 z-10">
                            <div className="flex items-center gap-3">
                              <Calendar className="w-5 h-5 text-[#FF6B35]" />
                              <h3 className="text-lg font-bold text-white">
                                {isToday ? 'היום' : isTomorrow ? 'מחר' : format(dateObj, 'EEEE', { locale: he })}
                                <span className="text-[#94A3B8] mr-2 text-base font-normal">
                                  {formatNumeric(date)}
                                </span>
                              </h3>
                              <span className="bg-[#FF6B35]/20 text-[#FF6B35] px-2 py-1 rounded-lg text-sm font-bold">
                                {bookingsByDate[date].length}
                              </span>
                            </div>
                          </div>

                          {/* Bookings for this date */}
                          <div className="space-y-3">
                            {bookingsByDate[date].map((booking) => (
                              <div
                                key={booking.id}
                                className={`bg-[#1A1F35] rounded-2xl p-4 border-2 transition-all ${
                                  booking.status === 'pending_approval'
                                    ? 'border-yellow-500/50 bg-yellow-500/5'
                                    : 'border-gray-800 hover:border-[#FF6B35]'
                                }`}
                              >
                                <div className="flex justify-between items-start mb-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                      <h3 className="text-lg font-bold text-white">
                                        {booking.client_name}
                                      </h3>
                                      <div className="text-[#FF6B35] font-bold text-xl">
                                        {formatTime(booking.time)}
                                      </div>
                                    </div>
                                    {booking.status === 'pending_approval' && (
                                      <span className="inline-block px-2 py-1 rounded-lg bg-yellow-500/20 text-yellow-400 text-xs font-bold">
                                        ממתין לאישור
                                      </span>
                                    )}
                                    {booking.status === 'confirmed' && (
                                      <span className="inline-block px-2 py-1 rounded-lg bg-green-500/20 text-green-400 text-xs font-bold">
                                        ✓ מאושר
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="flex items-center gap-2 text-[#94A3B8] text-sm">
                                      <Clock className="w-4 h-4" />
                                      <span>{booking.service_name}</span>
                                    </div>

                                    <div className="flex items-center gap-2 text-[#94A3B8] text-sm">
                                      <User className="w-4 h-4" />
                                      <span>{booking.staff_name}</span>
                                    </div>
                                  </div>

                                  {booking.client_phone && (
                                    <div className="flex items-center gap-2 text-[#94A3B8] text-sm">
                                      <Phone className="w-4 h-4 flex-shrink-0" />
                                      <span>{booking.client_phone}</span>
                                    </div>
                                  )}

                                  {booking.notes && (
                                    <div className="bg-[#0C0F1D] rounded-lg p-2 mt-2">
                                      <p className="text-[#94A3B8] text-sm">{booking.notes}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Waiting List Tab */}
            {activeTab === 'waiting' && (
              <div className="mb-6">
                {dateFilteredWaiting.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 rounded-full bg-[#1A1F35] flex items-center justify-center mx-auto mb-4">
                      <Bell className="w-10 h-10 text-[#94A3B8]" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">
                      {searchQuery ? 'לא נמצאו ברשימת המתנה' : 'אין ברשימת המתנה'}
                    </h3>
                    <p className="text-[#94A3B8]">
                      {searchQuery ? 'נסה לחפש משהו אחר' : 'רשימת ההמתנה תופיע כאן'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dateFilteredWaiting.map((entry) => (
                    <div
                      key={entry.id}
                      className={`bg-[#1A1F35] rounded-2xl p-4 border-2 ${
                        entry.status === 'notified'
                          ? 'border-green-500/50 bg-green-500/5'
                          : 'border-blue-500/30'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {entry.status === 'notified' ? (
                              <span className="inline-block px-3 py-1 rounded-lg bg-green-500/20 text-green-400 text-sm font-bold">
                                🎉 עודכן
                              </span>
                            ) : (
                              <span className="inline-block px-3 py-1 rounded-lg bg-blue-500/20 text-blue-400 text-sm font-bold">
                                ממתין
                              </span>
                            )}
                          </div>
                          <h3 className="text-lg font-bold text-white mb-2">{entry.client_name}</h3>
                          {entry.service_name && (
                            <p className="text-[#94A3B8] text-sm mb-2">{entry.service_name}</p>
                          )}
                          <div className="flex items-center gap-3 text-[#94A3B8] mb-1">
                            <Calendar className="w-4 h-4" />
                            <span>{format(parseDate(entry.date), 'EEEE', { locale: he })}, {formatNumeric(entry.date)}</span>
                          </div>
                          {(entry.from_time || entry.to_time) && (
                            <div className="flex items-center gap-3 text-[#94A3B8] mb-1">
                              <Clock className="w-4 h-4" />
                              <span dir="ltr">{entry.from_time || '08:00'} - {entry.to_time || '22:00'}</span>
                            </div>
                          )}
                          {entry.client_phone && (
                            <div className="flex items-center gap-3 text-[#94A3B8]">
                              <Phone className="w-4 h-4" />
                              <span>{entry.client_phone}</span>
                            </div>
                          )}
                          {entry.status === 'notified' && entry.notified_time && (
                            <div className="mt-2 bg-green-500/10 rounded-lg px-3 py-2">
                              <span className="text-green-400 font-bold">שעה פנויה: {entry.notified_time}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
        </div>
      </div>
    </div>
  );
}
