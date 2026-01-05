import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useUser } from "@/components/UserContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Calendar, Clock, User, X, Loader2, Edit, Bell, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { he } from "date-fns/locale";

// WhatsApp Service API
const WHATSAPP_API_URL = 'https://linedup-official-production.up.railway.app';

export default function MyBookings() {
  const navigate = useNavigate();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('upcoming');

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['my-bookings', user?.phone],
    queryFn: () => base44.entities.Booking.filter({ client_phone: user.phone }, '-date', 20),
    enabled: !!user?.phone,
    staleTime: 5 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchInterval: 20000,
    refetchOnWindowFocus: true,
    keepPreviousData: true,
  });

  const { data: businesses = [] } = useQuery({
    queryKey: ['businesses-for-bookings', bookings.map(b => b.business_id)],
    queryFn: async () => {
      if (bookings.length === 0) return [];
      const businessIds = [...new Set(bookings.map(b => b.business_id))].filter(Boolean);
      
      if (businessIds.length === 0) return [];

      const results = await Promise.all(
        businessIds.map(id => base44.entities.Business.filter({ id }))
      );
      return results.flat().filter(Boolean);
    },
    enabled: bookings.length > 0,
    staleTime: 10 * 60 * 1000,
    cacheTime: 15 * 60 * 1000,
    keepPreviousData: true,
  });

  // Fetch waiting list entries for this user (both waiting and notified)
  const { data: waitingListEntries = [], isLoading: waitingListLoading } = useQuery({
    queryKey: ['my-waiting-list', user?.phone],
    queryFn: async () => {
      // Fetch both 'waiting' and 'notified' entries
      const [waitingEntries, notifiedEntries] = await Promise.all([
        base44.entities.WaitingList.filter({ client_phone: user.phone, status: 'waiting' }, '-date', 50),
        base44.entities.WaitingList.filter({ client_phone: user.phone, status: 'notified' }, '-date', 50)
      ]);
      return [...waitingEntries, ...notifiedEntries];
    },
    enabled: !!user?.phone,
    staleTime: 30 * 1000,  // 30 seconds
    refetchOnWindowFocus: true,
  });

  // Cancel waiting list entry
  const cancelWaitingListMutation = useMutation({
    mutationFn: async (entry) => {
      await base44.entities.WaitingList.delete(entry.id);
      return entry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-waiting-list'] });
    },
  });

  // Helper function to check if a service has available slots on a date
  const checkServiceAvailability = async (businessId, serviceId, serviceDuration, date, staffId) => {
    try {
      // Get staff schedule
      const staffMembers = await base44.entities.Staff.filter({ business_id: businessId });
      const staff = staffId ? staffMembers.find(s => s.id === staffId) : staffMembers[0];
      
      if (!staff?.schedule) return false;
      
      const entryDate = new Date(date);
      const dayName = format(entryDate, 'EEEE').toLowerCase();
      const daySchedule = staff.schedule[dayName];
      
      if (!daySchedule?.enabled) return false;
      
      // Get existing bookings for this date and staff
      const existingBookings = await base44.entities.Booking.filter({
        business_id: businessId,
        staff_id: staff.id,
        date: date
      });
      
      const activeBookings = existingBookings.filter(
        b => b.status === 'confirmed' || b.status === 'pending_approval'
      );
      
      // Get shifts
      const shifts = daySchedule.shifts || [{ start: daySchedule.start, end: daySchedule.end }];
      
      // Check each shift for available slots
      for (const shift of shifts) {
        if (!shift.start || !shift.end) continue;
        
        const [startHour, startMin] = shift.start.split(':').map(Number);
        const [endHour, endMin] = shift.end.split(':').map(Number);
        
        let currentTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;
        
        while (currentTime + serviceDuration <= endTime) {
          const slotStart = currentTime;
          const slotEnd = currentTime + serviceDuration;
          
          // Check if this slot conflicts with any booking
          const isConflict = activeBookings.some(booking => {
            const [bHour, bMin] = booking.time.split(':').map(Number);
            const bookingStart = bHour * 60 + bMin;
            const bookingEnd = bookingStart + (booking.duration || 30);
            
            return (slotStart < bookingEnd && slotEnd > bookingStart);
          });
          
          if (!isConflict) {
            return true; // Found an available slot!
          }
          
          currentTime += 15; // Check every 15 minutes
        }
      }
      
      return false; // No available slots found
    } catch (error) {
      console.error('Error checking availability:', error);
      return false;
    }
  };

  const cancelMutation = useMutation({
    mutationFn: async (booking) => {
      await base44.entities.Booking.update(booking.id, { status: 'cancelled' });
      return booking;
    },
    onSuccess: async (booking) => {
      // Send WhatsApp cancellation notification
      const business = businesses.find(b => b.id === booking.business_id);
      if (booking.client_phone && user?.whatsapp_notifications_enabled !== false) {
        try {
          console.log('📱 Sending WhatsApp cancellation notification...');
          await fetch(`${WHATSAPP_API_URL}/api/send-update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: booking.client_phone,
              clientName: booking.client_name,
              businessName: business?.name || 'העסק',
              whatsappEnabled: user?.whatsapp_notifications_enabled !== false
            })
          });
          console.log('✅ WhatsApp cancellation notification sent');
        } catch (error) {
          console.error('❌ Failed to send WhatsApp cancellation:', error);
        }
      }
      
      // Notify waiting list - but only if booking time hasn't passed and service is available
      try {
        // Check if the booking time has already passed
        let bookingDate;
        if (booking.date && booking.date.includes('/')) {
          const [d, m, y] = booking.date.split('/');
          bookingDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        } else {
          bookingDate = parseISO(booking.date);
        }
        
        const [hours, minutes] = booking.time.split(':').map(Number);
        bookingDate.setHours(hours, minutes, 0, 0);
        
        const now = new Date();
        
        if (bookingDate < now) {
          console.log('⏭️ Booking time has passed, skipping waiting list notification');
        } else {
          console.log('📋 Checking waiting list for date:', booking.date);
          const waitingList = await base44.entities.WaitingList.filter({
            business_id: booking.business_id,
            date: booking.date,
            status: 'waiting'
          });
          
          console.log(`📋 Found ${waitingList.length} people on waiting list`);
          
          // Get all services for duration lookup
          const services = await base44.entities.Service.filter({ business_id: booking.business_id });
          
          for (const entry of waitingList) {
            // Get the service duration for this waiting list entry
            const entryService = services.find(s => s.id === entry.service_id);
            const serviceDuration = entryService?.duration || 30;
            
            // Check if their specific service now has availability
            const hasAvailability = await checkServiceAvailability(
              booking.business_id,
              entry.service_id,
              serviceDuration,
              booking.date,
              booking.staff_id
            );
            
            if (hasAvailability && entry.client_phone) {
              try {
                console.log(`✅ Service ${entry.service_name} has availability, notifying ${entry.client_name}`);
                await fetch(`${WHATSAPP_API_URL}/api/send-waiting-list`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    phone: entry.client_phone,
                    clientName: entry.client_name,
                    date: booking.date,
                    serviceName: entry.service_name || booking.service_name,
                    templateId: 'HXd75dea9bfaea32988c7532ecc6969b34'
                  })
                });
                console.log(`✅ Waiting list notification sent to ${entry.client_name}`);
                
                // Update status to notified
                await base44.entities.WaitingList.update(entry.id, {
                  status: 'notified',
                  notified_date: new Date().toISOString()
                });
              } catch (error) {
                console.error(`❌ Failed to notify ${entry.client_name}:`, error);
              }
            } else {
              console.log(`⏭️ Service ${entry.service_name} still has no availability for ${entry.client_name}`);
            }
          }
        }
      } catch (error) {
        console.error('❌ Error notifying waiting list:', error);
      }
      
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
      
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['next-appointment'] });
      await queryClient.refetchQueries({ queryKey: ['notifications', booking.business_id] });
    },
  });

  const canCancelBooking = (booking) => {
    const business = businesses.find(b => b.id === booking.business_id);
    if (!business) return false;
    
    const cancellationLimit = business.cancellation_hours_limit || 24;
    const bookingDateTime = new Date(`${booking.date}T${booking.time}`);
    const now = new Date();
    const hoursDiff = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    return hoursDiff >= cancellationLimit;
  };

  const canEditBooking = (booking) => {
    const bookingDateTime = new Date(`${booking.date}T${booking.time}`);
    const now = new Date();
    
    // Must be in the future
    if (bookingDateTime < now) return false;
    
    // Must be confirmed or pending
    if (booking.status !== 'confirmed' && booking.status !== 'pending_approval') return false;
    
    // If pending_approval, can always edit
    if (booking.status === 'pending_approval') return true;
    
    // Check cancellation policy (same as cancel)
    const business = businesses.find(b => b.id === booking.business_id);
    const cancellationLimit = business?.cancellation_hours_limit || 24;
    const hoursDiff = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    return hoursDiff >= cancellationLimit;
  };

  const handleCancel = (booking) => {
    if (booking.status === 'pending_approval') {
      if (window.confirm(`לבטל את התור ל-${booking.service_name}?`)) {
        cancelMutation.mutate(booking);
      }
      return;
    }
    
    if (!canCancelBooking(booking)) {
      const business = businesses.find(b => b.id === booking.business_id);
      const hours = business?.cancellation_hours_limit || 24;
      alert(`אי אפשר לבטל תור פחות מ-${hours} שעות לפני`);
      return;
    }

    if (window.confirm(`לבטל את התור ל-${booking.service_name}?`)) {
      cancelMutation.mutate(booking);
    }
  };

  const handleEdit = (booking) => {
    // Check if can edit
    if (booking.status !== 'pending_approval') {
      const business = businesses.find(b => b.id === booking.business_id);
      const cancellationLimit = business?.cancellation_hours_limit || 24;
      const bookingDateTime = new Date(`${booking.date}T${booking.time}`);
      const now = new Date();
      const hoursDiff = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff < cancellationLimit) {
        alert(`אי אפשר לשנות תור פחות מ-${cancellationLimit} שעות לפני`);
        return;
      }
    }
    
    console.log('🚀 MyBookings handleEdit called with bookingId:', booking.id);
    const url = "/BookAppointment" + `?reschedule=${booking.id}`;
    console.log('🌐 Navigating to URL:', url);
    navigate(url);
  };

  const upcomingBookings = bookings
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
  
  const pastBookings = bookings
    .filter(b => {
      const bookingDateTime = new Date(`${b.date}T${b.time}`);
      const now = new Date();
      return bookingDateTime < now || b.status === 'cancelled' || b.status === 'completed';
    })
    .sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`);
      const dateB = new Date(`${b.date}T${b.time}`);
      return dateB - dateA; // Most recent first
    });

  const displayedBookings = filter === 'upcoming' ? upcomingBookings : pastBookings;

  return (
    <div className="min-h-screen bg-[#0C0F1D] p-4 pb-24 pt-safe">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate("/ClientDashboard")}
          className="flex items-center gap-2 text-[#94A3B8] mb-6 hover:text-white transition-colors h-12"
        >
          <ArrowRight className="w-5 h-5" />
          <span className="font-medium">חזרה</span>
        </button>

        <h1 className="text-3xl font-bold mb-6 pt-2">התורים שלי</h1>

        {/* Filter Tabs */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setFilter('upcoming')}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all ${
              filter === 'upcoming'
                ? 'bg-gradient-to-r from-[#FF6B35] to-[#FF1744] text-white shadow-lg scale-105'
                : 'bg-[#1A1F35] text-[#94A3B8] border-2 border-gray-800 hover:border-[#FF6B35] hover:scale-105 active:scale-95'
            }`}
          >
            <div className="text-base">קרובים</div>
            <div className="text-2xl font-bold mt-1">{upcomingBookings.length}</div>
          </button>
          <button
            onClick={() => setFilter('past')}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all ${
              filter === 'past'
                ? 'bg-gradient-to-r from-[#FF6B35] to-[#FF1744] text-white shadow-lg scale-105'
                : 'bg-[#1A1F35] text-[#94A3B8] border-2 border-gray-800 hover:border-[#FF6B35] hover:scale-105 active:scale-95'
            }`}
          >
            <div className="text-base">היסטוריה</div>
            <div className="text-2xl font-bold mt-1">{pastBookings.length}</div>
          </button>
        </div>

        {/* Waiting List Section */}
        {waitingListEntries.length > 0 && filter === 'upcoming' && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-bold text-blue-400">רשימת המתנה</h2>
            </div>
            <div className="space-y-3">
              {waitingListEntries
                .filter(entry => {
                  // Only show future dates - handle both date formats
                  let entryDate;
                  if (entry.date && entry.date.includes('/')) {
                    const [d, m, y] = entry.date.split('/');
                    entryDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
                  } else {
                    entryDate = new Date(entry.date);
                  }
                  return entryDate >= new Date(new Date().toDateString());
                })
                .map((entry) => {
                  // Parse date for display
                  let displayDate;
                  if (entry.date && entry.date.includes('/')) {
                    const [d, m, y] = entry.date.split('/');
                    displayDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
                  } else {
                    displayDate = parseISO(entry.date);
                  }
                  
                  return (
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
                          <span className="inline-block px-3 py-1 rounded-lg bg-green-500/20 text-green-400 text-sm font-bold animate-pulse">
                            🎉 התפנה מקום!
                          </span>
                        ) : (
                          <span className="inline-block px-3 py-1 rounded-lg bg-blue-500/20 text-blue-400 text-sm font-bold">
                            ממתין
                          </span>
                        )}
                      </div>
                      {entry.service_name && (
                        <h3 className="text-lg font-bold text-white mb-2">{entry.service_name}</h3>
                      )}
                      <div className="flex items-center gap-3 text-[#94A3B8]">
                        <Calendar className="w-4 h-4" />
                        <span>{format(displayDate, 'EEEE, d.M.yyyy', { locale: he })}</span>
                      </div>
                      {entry.status === 'notified' ? (
                        <Button
                          onClick={() => navigate(`/BookAppointment?date=${entry.date}`)}
                          className="mt-3 h-10 rounded-xl text-white font-bold w-full"
                          style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
                        >
                          קבע תור עכשיו!
                        </Button>
                      ) : (
                        <p className="text-[#94A3B8] text-sm mt-2">
                          נודיע לך בוואטסאפ אם יתפנה מקום
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        if (window.confirm('להסיר מרשימת ההמתנה?')) {
                          cancelWaitingListMutation.mutate(entry);
                        }
                      }}
                      className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                  );
              })}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-16">
            <Loader2 className="w-12 h-12 animate-spin text-[#FF6B35] mx-auto" />
          </div>
        ) : displayedBookings.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 rounded-full bg-[#1A1F35] flex items-center justify-center mx-auto mb-6">
              <Calendar className="w-12 h-12 text-[#94A3B8]" />
            </div>
            <h3 className="text-2xl font-bold mb-3">
              {filter === 'upcoming' ? 'אין תורים קרובים' : 'אין היסטוריה'}
            </h3>
            <p className="text-[#94A3B8] text-lg mb-8">
              {filter === 'upcoming' 
                ? 'זה הזמן לקבוע תור חדש' 
                : 'התורים שהיו לך יופיעו כאן'
              }
            </p>
            {filter === 'upcoming' && (
              <Button
                onClick={() => navigate("/BookAppointment")}
                className="h-14 px-8 rounded-xl text-lg font-semibold hover:scale-105 active:scale-95 transition-transform"
                style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
              >
                קבע תור עכשיו
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {displayedBookings.map((booking) => (
              <div
                key={booking.id}
                className={`bg-[#1A1F35] rounded-2xl p-5 border-2 transition-all ${
                  booking.status === 'cancelled' 
                    ? 'border-red-500/30 opacity-60' 
                    : booking.status === 'pending_approval'
                    ? 'border-yellow-500/50 bg-yellow-500/5'
                    : 'border-gray-800 hover:border-[#FF6B35] hover:scale-[1.01]'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-2">
                      {booking.service_name}
                    </h3>
                    {booking.status === 'cancelled' && (
                      <span className="inline-block px-3 py-1 rounded-lg bg-red-500/20 text-red-400 text-sm font-bold mb-2">
                        התור בוטל
                      </span>
                    )}
                    {booking.status === 'pending_approval' && (
                      <span className="inline-block px-3 py-1 rounded-lg bg-yellow-500/20 text-yellow-400 text-sm font-bold mb-2">
                        ממתין לאישור
                      </span>
                    )}
                    {booking.status === 'confirmed' && (
                      <span className="inline-block px-3 py-1 rounded-lg bg-green-500/20 text-green-400 text-sm font-bold mb-2">
                        ✓ מאושר
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between bg-[#0C0F1D] rounded-xl p-4">
                    <div className="flex items-center gap-3 text-[#94A3B8]">
                      <Calendar className="w-5 h-5" />
                      <span className="font-medium">{format(new Date(`${booking.date}T${booking.time}`), 'EEEE, d.M.yyyy', { locale: he })}</span>
                    </div>
                    <div className="text-[#FF6B35] font-bold text-2xl">
                      {booking.time}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 text-[#94A3B8]">
                    <Clock className="w-5 h-5" />
                    <span>{booking.duration} דקות</span>
                  </div>
                  
                  <div className="flex items-center gap-3 text-[#94A3B8]">
                    <User className="w-5 h-5" />
                    <span>עם {booking.staff_name}</span>
                  </div>
                </div>

                {booking.notes && (
                  <div className="mb-4 pt-4 border-t border-gray-800">
                    <p className="text-[#94A3B8] text-sm">{booking.notes}</p>
                  </div>
                )}

                {/* Action buttons - only show for upcoming bookings */}
                {filter === 'upcoming' && canEditBooking(booking) && (
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-800">
                    <Button
                      onClick={() => {
                        console.log('✏️ Edit button clicked for booking:', booking.id);
                        handleEdit(booking);
                      }}
                      variant="outline"
                      className="border-2 border-gray-700 hover:border-[#FF6B35] bg-[#0C0F1D] text-white hover:bg-[#FF6B35]/10 h-11 rounded-xl font-medium"
                    >
                      <Edit className="w-4 h-4 ml-2" />
                      ערוך תור
                    </Button>
                    <Button
                      onClick={() => handleCancel(booking)}
                      disabled={cancelMutation.isPending}
                      variant="outline"
                      className="border-2 border-red-500/50 hover:border-red-500 bg-[#0C0F1D] text-red-400 hover:bg-red-500/10 h-11 rounded-xl font-medium disabled:opacity-50"
                    >
                      <X className="w-4 h-4 ml-2" />
                      בטל תור
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}