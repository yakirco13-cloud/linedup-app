/**
 * Centralized Availability Service
 * All slot/time availability calculations in one place
 * 
 * This handles:
 * - Getting available time slots for a date
 * - Checking if a specific slot is available
 * - Getting schedule for a date (with override support)
 */

import { getDayKey, toISO } from './dateService';

/**
 * Get the effective schedule for a specific date
 * Checks for overrides first, then falls back to regular schedule
 * 
 * @param {object} params
 * @param {Date|string} params.date - The date to check
 * @param {object} params.staff - Staff member object with schedule
 * @param {Array} params.overrides - Schedule overrides array
 * @returns {object|null} - { enabled: boolean, start: string, end: string, shifts?: array }
 */
export function getScheduleForDate({ date, staff, overrides = [] }) {
  if (!staff || !date) return null;
  
  const dateStr = toISO(date);
  
  // Check for override first
  const override = overrides.find(o => o.date === dateStr && 
    (o.staff_id === staff.id || o.staff_id === null));
  
  if (override) {
    // Day off
    if (override.is_day_off) {
      return { enabled: false, shifts: [] };
    }
    
    // Custom hours
    if (override.shifts && override.shifts.length > 0) {
      return {
        enabled: true,
        start: override.shifts[0].start,
        end: override.shifts[override.shifts.length - 1].end,
        shifts: override.shifts
      };
    }
  }
  
  // Fall back to regular schedule
  const dayKey = getDayKey(date);
  if (!dayKey || !staff.schedule) return null;
  
  const daySchedule = staff.schedule[dayKey];
  if (!daySchedule) return null;
  
  // Handle new format (with shifts array)
  if (daySchedule.shifts && daySchedule.shifts.length > 0) {
    return {
      enabled: daySchedule.enabled,
      start: daySchedule.shifts[0].start,
      end: daySchedule.shifts[daySchedule.shifts.length - 1].end,
      shifts: daySchedule.shifts
    };
  }
  
  // Handle old format (direct start/end)
  if (daySchedule.start && daySchedule.end) {
    return {
      enabled: daySchedule.enabled,
      start: daySchedule.start,
      end: daySchedule.end,
      shifts: [{ start: daySchedule.start, end: daySchedule.end }]
    };
  }
  
  return null;
}

/**
 * Check if a specific time slot is available
 * 
 * @param {object} params
 * @param {string} params.time - Time to check (HH:MM)
 * @param {number} params.duration - Duration needed in minutes
 * @param {Array} params.bookings - Existing bookings for the date
 * @param {string} [params.ignoreBookingId] - Booking ID to ignore (for rescheduling)
 * @returns {boolean}
 */
export function isSlotAvailable({ time, duration, bookings, ignoreBookingId }) {
  const [slotH, slotM] = time.split(':').map(Number);
  const slotStart = slotH * 60 + slotM;
  const slotEnd = slotStart + duration;
  
  return !bookings.some(booking => {
    // Skip the booking we're rescheduling
    if (ignoreBookingId && booking.id === ignoreBookingId) return false;
    
    // Skip cancelled bookings
    if (booking.status === 'cancelled') return false;
    
    if (!booking.time) return false;
    
    const [bH, bM] = booking.time.split(':').map(Number);
    const bookingStart = bH * 60 + bM;
    const bookingEnd = bookingStart + (booking.duration || 30);
    
    // Check for overlap
    return slotStart < bookingEnd && slotEnd > bookingStart;
  });
}

/**
 * Generate all available time slots for a date
 * 
 * @param {object} params
 * @param {Date|string} params.date - The date
 * @param {object} params.staff - Staff member object
 * @param {number} params.duration - Service duration in minutes
 * @param {Array} params.bookings - Existing bookings for the date
 * @param {Array} params.overrides - Schedule overrides
 * @param {string} [params.ignoreBookingId] - Booking ID to ignore (for rescheduling)
 * @param {number} [params.slotInterval=15] - Interval between slots in minutes
 * @returns {string[]} - Array of available times (HH:MM format)
 */
export function getAvailableSlots({ 
  date, 
  staff, 
  duration, 
  bookings, 
  overrides = [],
  ignoreBookingId,
  slotInterval = 15 
}) {
  const schedule = getScheduleForDate({ date, staff, overrides });
  
  if (!schedule?.enabled) {
    return [];
  }
  
  const slots = [];
  const [startH, startM] = schedule.start.split(':').map(Number);
  const [endH, endM] = schedule.end.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  
  // Generate slots at regular intervals
  for (let minutes = startMinutes; minutes + duration <= endMinutes; minutes += slotInterval) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    
    if (isSlotAvailable({ time, duration, bookings, ignoreBookingId })) {
      slots.push(time);
    }
  }
  
  return slots;
}

/**
 * Get available dates for a month
 * Returns dates that have at least one available slot
 * 
 * @param {object} params
 * @param {Date[]} params.dates - Array of dates to check
 * @param {object} params.staff - Staff member object
 * @param {number} params.duration - Service duration in minutes
 * @param {Array} params.bookings - All bookings for the period
 * @param {Array} params.overrides - Schedule overrides
 * @returns {Date[]} - Array of dates with availability
 */
export function getAvailableDates({ dates, staff, duration, bookings, overrides = [] }) {
  return dates.filter(date => {
    const dateStr = toISO(date);
    
    // Get bookings for this specific date
    const dateBookings = bookings.filter(b => {
      const bookingDate = b.date?.includes('/') 
        ? toISO(b.date)
        : b.date;
      return bookingDate === dateStr;
    });
    
    // Check if there's at least one available slot
    const slots = getAvailableSlots({
      date,
      staff,
      duration,
      bookings: dateBookings,
      overrides
    });
    
    return slots.length > 0;
  });
}

/**
 * Check if there are available slots within a specific time range
 * Used for waiting list validation
 * 
 * @param {object} params
 * @param {Date|string} params.date - The date
 * @param {object} params.staff - Staff member object
 * @param {number} params.duration - Service duration in minutes
 * @param {string} params.fromTime - Start of preferred range (HH:MM)
 * @param {string} params.toTime - End of preferred range (HH:MM)
 * @param {Array} params.bookings - Existing bookings
 * @param {Array} params.overrides - Schedule overrides
 * @returns {boolean}
 */
export function hasAvailableSlotsInRange({ 
  date, 
  staff, 
  duration, 
  fromTime, 
  toTime, 
  bookings, 
  overrides = [] 
}) {
  const schedule = getScheduleForDate({ date, staff, overrides });
  
  if (!schedule?.enabled) {
    return false;
  }
  
  // Determine the overlap between schedule and preferred range
  const scheduleStart = schedule.start;
  const scheduleEnd = schedule.end;
  const rangeStart = fromTime > scheduleStart ? fromTime : scheduleStart;
  const rangeEnd = toTime < scheduleEnd ? toTime : scheduleEnd;
  
  // Convert to minutes for comparison
  const [rangeStartH, rangeStartM] = rangeStart.split(':').map(Number);
  const [rangeEndH, rangeEndM] = rangeEnd.split(':').map(Number);
  const startMinutes = rangeStartH * 60 + rangeStartM;
  const endMinutes = rangeEndH * 60 + rangeEndM;
  
  // Check each 15-minute slot in the range
  for (let minutes = startMinutes; minutes + duration <= endMinutes; minutes += 15) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    
    if (isSlotAvailable({ time, duration, bookings })) {
      return true;
    }
  }
  
  return false;
}

export default {
  getScheduleForDate,
  isSlotAvailable,
  getAvailableSlots,
  getAvailableDates,
  hasAvailableSlotsInRange
};
