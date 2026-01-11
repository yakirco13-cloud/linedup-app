import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Clock, Calendar, Scissors, Bell, Loader2, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

export default function WaitingListModal({ 
  isOpen, 
  onClose, 
  business,
  services = [],
  selectedService = null,
  selectedDate = null,
  selectedStaff = null,
  existingBookings = [],
  user,
  onJoin,
  getScheduleForDate
}) {
  const navigate = useNavigate();
  const [service, setService] = useState(selectedService?.id || '');
  const [date, setDate] = useState(selectedDate || new Date());
  const [fromTime, setFromTime] = useState('08:00');
  const [toTime, setToTime] = useState('22:00');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [availabilityWarning, setAvailabilityWarning] = useState('');

  // Generate time options (every 30 minutes)
  const timeOptions = [];
  for (let h = 6; h <= 23; h++) {
    for (let m = 0; m < 60; m += 30) {
      const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      timeOptions.push(time);
    }
  }

  // Update from/to when selection changes
  useEffect(() => {
    if (selectedService?.id) setService(selectedService.id);
  }, [selectedService]);

  useEffect(() => {
    if (selectedDate) setDate(selectedDate);
  }, [selectedDate]);

  // Validate toTime is after fromTime
  useEffect(() => {
    if (fromTime >= toTime) {
      const fromIndex = timeOptions.indexOf(fromTime);
      if (fromIndex < timeOptions.length - 1) {
        setToTime(timeOptions[fromIndex + 1]);
      }
    }
  }, [fromTime]);

  // Check if slots are available in the selected range
  useEffect(() => {
    if (!service || !date || !fromTime || !toTime) {
      setAvailabilityWarning('');
      return;
    }

    const selectedServiceData = services.find(s => s.id === service);
    if (!selectedServiceData) return;

    const duration = selectedServiceData.duration || 30;
    
    // Check for available slots in the time range
    const hasAvailableSlots = checkAvailableSlotsInRange(
      date, 
      fromTime, 
      toTime, 
      duration, 
      existingBookings,
      selectedStaff,
      getScheduleForDate
    );

    if (hasAvailableSlots) {
      setAvailabilityWarning('יש תורים פנויים בטווח השעות שבחרת! אנא בדוק שוב את התורים הזמינים.');
    } else {
      setAvailabilityWarning('');
    }
  }, [service, date, fromTime, toTime, existingBookings, services]);

  const handleSubmit = async () => {
    setError('');
    
    if (!service) {
      setError('נא לבחור שירות');
      return;
    }
    
    if (!date) {
      setError('נא לבחור תאריך');
      return;
    }

    if (fromTime >= toTime) {
      setError('שעת סיום חייבת להיות אחרי שעת התחלה');
      return;
    }

    // Block if slots are available
    if (availabilityWarning) {
      setError('לא ניתן להצטרף לרשימת המתנה כאשר יש תורים פנויים בטווח השעות');
      return;
    }

    setLoading(true);
    
    try {
      const selectedServiceData = services.find(s => s.id === service);
      
      await onJoin({
        business_id: business.id,
        client_phone: user.phone,
        client_name: user.name || user.full_name,
        service_id: service,
        service_name: selectedServiceData?.name || '',
        service_duration: selectedServiceData?.duration || 30,
        date: format(date, 'yyyy-MM-dd'),
        from_time: fromTime,
        to_time: toTime,
        status: 'waiting'
      });
      
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        navigate('/ClientDashboard');
      }, 2000);
    } catch (err) {
      setError(err.message || 'שגיאה בהצטרפות לרשימת המתנה');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1A1F35] rounded-2xl max-w-md w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#FF6B35]/20 to-[#FF1744]/20 p-4 flex items-center justify-between border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FF6B35]/20 rounded-xl flex items-center justify-center">
              <Bell className="w-5 h-5 text-[#FF6B35]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">רשימת המתנה</h2>
              <p className="text-xs text-[#94A3B8]">נעדכן אותך כשיתפנה מקום</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-[#94A3B8]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
          {success ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bell className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">נרשמת בהצלחה!</h3>
              <p className="text-[#94A3B8]">נשלח לך הודעה כשיתפנה מקום</p>
            </div>
          ) : (
            <>
              {/* Service Selection */}
              <div className="space-y-2">
                <Label className="text-white flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-[#FF6B35]" />
                  שירות
                </Label>
                <select
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  className="w-full bg-[#0C0F1D] border border-gray-700 rounded-xl p-3 text-white focus:border-[#FF6B35] outline-none"
                >
                  <option value="">בחר שירות...</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} - {s.duration} דקות
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Selection */}
              <div className="space-y-2">
                <Label className="text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#FF6B35]" />
                  תאריך
                </Label>
                <input
                  type="date"
                  value={format(date, 'yyyy-MM-dd')}
                  onChange={(e) => setDate(new Date(e.target.value))}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  className="w-full bg-[#0C0F1D] border border-gray-700 rounded-xl p-3 text-white focus:border-[#FF6B35] outline-none"
                  dir="ltr"
                />
                <p className="text-xs text-[#94A3B8]">
                  {format(date, 'EEEE, d בMMMM yyyy', { locale: he })}
                </p>
              </div>

              {/* Time Range */}
              <div className="space-y-2">
                <Label className="text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#FF6B35]" />
                  טווח שעות מועדף
                </Label>
                <div className="flex items-center gap-3" dir="ltr">
                  <select
                    value={fromTime}
                    onChange={(e) => setFromTime(e.target.value)}
                    className="flex-1 bg-[#0C0F1D] border border-gray-700 rounded-xl p-3 text-white focus:border-[#FF6B35] outline-none text-center"
                  >
                    {timeOptions.map((time) => (
                      <option key={`from-${time}`} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                  <span className="text-[#94A3B8]">—</span>
                  <select
                    value={toTime}
                    onChange={(e) => setToTime(e.target.value)}
                    className="flex-1 bg-[#0C0F1D] border border-gray-700 rounded-xl p-3 text-white focus:border-[#FF6B35] outline-none text-center"
                  >
                    {timeOptions.filter(t => t > fromTime).map((time) => (
                      <option key={`to-${time}`} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-[#94A3B8] text-center">
                  נודיע לך אם יתפנה תור בין {fromTime} ל-{toTime}
                </p>
              </div>

              {/* Availability Warning */}
              {availabilityWarning && (
                <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-xl p-3 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <p className="text-yellow-400 text-sm">{availabilityWarning}</p>
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500 rounded-xl p-3 text-red-400 text-sm text-center">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="p-4 border-t border-gray-800">
            <Button
              onClick={handleSubmit}
              disabled={loading || !!availabilityWarning}
              className={`w-full h-12 rounded-xl text-white font-bold ${availabilityWarning ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{ background: availabilityWarning ? '#666' : 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Bell className="w-5 h-5 ml-2" />
                  הצטרף לרשימת המתנה
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to check if slots are available in a time range
function checkAvailableSlotsInRange(date, fromTime, toTime, duration, existingBookings, staff, getScheduleForDate) {
  // Return false (allow joining) if we can't check properly
  if (!staff || !getScheduleForDate || !date || !fromTime || !toTime) return false;
  
  try {
    const dateStr = format(date, 'yyyy-MM-dd');
    const daySchedule = getScheduleForDate(date, staff);
    
    if (!daySchedule?.enabled) return false;
    
    // Handle both schedule formats: { start, end } or { shifts: [{start, end}] }
    let scheduleStart, scheduleEnd;
    if (daySchedule.shifts && Array.isArray(daySchedule.shifts) && daySchedule.shifts.length > 0) {
      // New format with shifts array - use first and last shift for overall range
      scheduleStart = daySchedule.shifts[0].start;
      scheduleEnd = daySchedule.shifts[daySchedule.shifts.length - 1].end;
    } else if (daySchedule.start && daySchedule.end) {
      // Old format with direct start/end
      scheduleStart = daySchedule.start;
      scheduleEnd = daySchedule.end;
    } else {
      // Can't determine schedule, allow joining waiting list
      return false;
    }
    
    if (!scheduleStart || !scheduleEnd) return false;
    
    // Get bookings for this date
    const dayBookings = (existingBookings || []).filter(b => {
      if (!b.date) return false;
      const bookingDate = b.date.includes('/') 
        ? b.date.split('/').reverse().join('-')
        : b.date;
      return bookingDate === dateStr && b.status !== 'cancelled';
    });
    
    // Generate potential slots
    const [startH, startM] = scheduleStart.split(':').map(Number);
    const [endH, endM] = scheduleEnd.split(':').map(Number);
    const [fromH, fromM] = fromTime.split(':').map(Number);
    const [toH, toM] = toTime.split(':').map(Number);
    
    // Check each 15-min interval in the range
    for (let h = Math.max(startH, fromH); h <= Math.min(endH, toH); h++) {
      for (let m = 0; m < 60; m += 15) {
        const slotTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        
        // Skip if outside selected range
        if (slotTime < fromTime || slotTime > toTime) continue;
        
        // Skip if outside business hours
        if (slotTime < scheduleStart || slotTime >= scheduleEnd) continue;
        
        // Check if slot + duration fits before end of business
        const slotMinutes = h * 60 + m;
        const endMinutes = endH * 60 + endM;
        if (slotMinutes + duration > endMinutes) continue;
        
        // Check if slot conflicts with existing bookings
        const hasConflict = dayBookings.some(booking => {
          if (!booking.time) return false;
          const [bH, bM] = booking.time.split(':').map(Number);
          const bookingStart = bH * 60 + bM;
          const bookingEnd = bookingStart + (booking.duration || 30);
          const slotEnd = slotMinutes + duration;
          
          return (slotMinutes < bookingEnd && slotEnd > bookingStart);
        });
        
        if (!hasConflict) {
          // Found an available slot!
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking available slots:', error);
    return false; // On error, allow joining waiting list
  }
}