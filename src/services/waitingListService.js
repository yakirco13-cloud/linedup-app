/**
 * Centralized Waiting List Service
 * All waiting list notification logic in one place
 * 
 * This handles:
 * - Checking if a slot fits a waiting list entry
 * - Notifying clients when slots open up
 * - Updating waiting list status
 */

import { base44 } from '@/api/base44Client';
import { sendWaitingListNotification } from './whatsappService';
import { toISO, normalizeBookingDate } from './dateService';

/**
 * Check if a service duration fits in a time slot
 * @param {object} params
 * @param {string} params.slotStart - Start time of available slot (HH:MM)
 * @param {number} params.serviceDuration - Duration needed in minutes
 * @param {Array} params.activeBookings - Array of existing bookings
 * @returns {boolean}
 */
export function checkSlotFitsService({ slotStart, serviceDuration, activeBookings }) {
  const [slotH, slotM] = slotStart.split(':').map(Number);
  const slotStartMinutes = slotH * 60 + slotM;
  const slotEndMinutes = slotStartMinutes + serviceDuration;
  
  // Check if this slot conflicts with any existing booking
  const hasConflict = activeBookings.some(booking => {
    if (!booking.time) return false;
    const [bH, bM] = booking.time.split(':').map(Number);
    const bookingStart = bH * 60 + bM;
    const bookingEnd = bookingStart + (booking.duration || 30);
    
    // Conflict if service would overlap with existing booking
    return (slotStartMinutes < bookingEnd && slotEndMinutes > bookingStart);
  });
  
  return !hasConflict;
}

/**
 * Find the first available slot for a service within a time range
 * @param {object} params
 * @param {string} params.rangeStart - Start of time range (HH:MM)
 * @param {string} params.rangeEnd - End of time range (HH:MM)
 * @param {number} params.serviceDuration - Duration needed in minutes
 * @param {Array} params.activeBookings - Array of existing bookings
 * @returns {string|null} - First available slot time or null
 */
export function findFirstAvailableSlot({ rangeStart, rangeEnd, serviceDuration, activeBookings }) {
  const [startH, startM] = rangeStart.split(':').map(Number);
  const [endH, endM] = rangeEnd.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  
  // Check every 15-minute slot
  for (let slotMinutes = startMinutes; slotMinutes + serviceDuration <= endMinutes; slotMinutes += 15) {
    const slotH = Math.floor(slotMinutes / 60);
    const slotM = slotMinutes % 60;
    const slotTime = `${slotH.toString().padStart(2, '0')}:${slotM.toString().padStart(2, '0')}`;
    
    if (checkSlotFitsService({ slotStart: slotTime, serviceDuration, activeBookings })) {
      return slotTime;
    }
  }
  
  return null;
}

/**
 * Notify waiting list clients when a slot opens up
 * Called when:
 * - A booking is cancelled
 * - A booking is rescheduled
 * - Schedule override opens new hours
 * 
 * @param {object} params
 * @param {string} params.businessId - Business ID
 * @param {string} params.date - Date of opened slot (any format)
 * @param {string} params.startTime - Start of available range (HH:MM)
 * @param {string} params.endTime - End of available range (HH:MM)
 * @returns {Promise<{notified: number, skipped: number}>}
 */
export async function notifyWaitingListForOpenedSlot({ businessId, date, startTime, endTime }) {
  const result = { notified: 0, skipped: 0 };
  
  try {
    const normalizedDate = toISO(date);
    console.log('🔔 WaitingListService: Checking for date:', normalizedDate);
    console.log('🔔 Time range:', startTime, '-', endTime);
    
    // Get waiting list entries for this date
    const waitingList = await base44.entities.WaitingList.filter({
      business_id: businessId,
      date: normalizedDate,
      status: 'waiting'
    });
    
    if (waitingList.length === 0) {
      console.log('🔔 No one on waiting list for this date');
      return result;
    }
    
    console.log(`🔔 Found ${waitingList.length} people on waiting list`);
    
    // Get existing bookings for this date
    const existingBookings = await base44.entities.Booking.filter({
      business_id: businessId,
      date: normalizedDate
    });
    
    // Filter to only active bookings
    const activeBookings = existingBookings.filter(b => 
      b.status === 'confirmed' || b.status === 'pending_approval'
    );
    
    console.log(`🔔 ${activeBookings.length} active bookings on this date`);
    
    // Check each waiting list entry
    for (const entry of waitingList) {
      const fromTime = entry.from_time || '00:00';
      const toTime = entry.to_time || '23:59';
      const serviceDuration = entry.service_duration || 30;
      
      console.log(`🔔 Checking entry for ${entry.client_name}:`, {
        range: `${fromTime}-${toTime}`,
        duration: serviceDuration
      });
      
      // Check if the opened range overlaps with their preferred range
      if (endTime <= fromTime || startTime >= toTime) {
        console.log(`⏭️ Skipping ${entry.client_name}: no overlap with their range`);
        result.skipped++;
        continue;
      }
      
      // Calculate the actual overlap
      const overlapStart = startTime > fromTime ? startTime : fromTime;
      const overlapEnd = endTime < toTime ? endTime : toTime;
      
      // Find first available slot that fits their service
      const foundSlot = findFirstAvailableSlot({
        rangeStart: overlapStart,
        rangeEnd: overlapEnd,
        serviceDuration,
        activeBookings
      });
      
      if (!foundSlot) {
        console.log(`⏭️ Skipping ${entry.client_name}: ${serviceDuration}min doesn't fit in ${overlapStart}-${overlapEnd}`);
        result.skipped++;
        continue;
      }
      
      console.log(`✅ ${entry.client_name}: ${serviceDuration}min FITS at ${foundSlot}`);
      
      // Send notification
      if (entry.client_phone) {
        const sendResult = await sendWaitingListNotification({
          phone: entry.client_phone,
          clientName: entry.client_name,
          date: normalizedDate,
          time: foundSlot,
          serviceName: entry.service_name
        });
        
        if (sendResult.success) {
          // Update entry status
          try {
            await base44.entities.WaitingList.update(entry.id, {
              status: 'notified',
              notified_date: new Date().toISOString(),
              notified_time: foundSlot
            });
            console.log(`✅ Updated waiting list entry status to 'notified'`);
            result.notified++;
          } catch (updateError) {
            console.error(`❌ Failed to update waiting list status:`, updateError);
            result.notified++; // Still count as notified since message was sent
          }
        } else {
          console.error(`❌ Failed to send notification to ${entry.client_name}`);
          result.skipped++;
        }
      } else {
        console.log(`⏭️ Skipping ${entry.client_name}: no phone number`);
        result.skipped++;
      }
    }
    
    console.log(`🔔 WaitingListService complete: ${result.notified} notified, ${result.skipped} skipped`);
    return result;
    
  } catch (error) {
    console.error('❌ WaitingListService error:', error);
    return result;
  }
}

/**
 * Notify waiting list when a specific booking is cancelled
 * @param {object} params
 * @param {object} params.booking - The cancelled booking
 * @param {string} params.businessId - Business ID
 * @returns {Promise<{notified: number, skipped: number}>}
 */
export async function notifyWaitingListForCancelledBooking({ booking, businessId }) {
  const normalizedDate = normalizeBookingDate(booking.date);
  const cancelledTime = booking.time;
  const cancelledDuration = booking.duration || 30;
  
  // The opened slot starts at the cancelled booking time
  // and extends for the duration of the cancelled booking
  const [h, m] = cancelledTime.split(':').map(Number);
  const endMinutes = h * 60 + m + cancelledDuration;
  const endH = Math.floor(endMinutes / 60);
  const endM = endMinutes % 60;
  const endTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
  
  return notifyWaitingListForOpenedSlot({
    businessId,
    date: normalizedDate,
    startTime: cancelledTime,
    endTime
  });
}

/**
 * Clean up expired waiting list entries (date < today)
 * @param {string} businessId - Business ID (optional, cleans all if not provided)
 * @returns {Promise<number>} - Number of entries deleted
 */
export async function cleanupExpiredEntries(businessId) {
  try {
    const today = toISO(new Date());
    
    // Get all waiting entries
    const filter = businessId ? { business_id: businessId, status: 'waiting' } : { status: 'waiting' };
    const entries = await base44.entities.WaitingList.filter(filter);
    
    let deleted = 0;
    for (const entry of entries) {
      const entryDate = toISO(entry.date);
      if (entryDate && entryDate < today) {
        try {
          await base44.entities.WaitingList.delete(entry.id);
          deleted++;
        } catch (e) {
          console.error('Failed to delete expired entry:', e);
        }
      }
    }
    
    console.log(`🗑️ Cleaned up ${deleted} expired waiting list entries`);
    return deleted;
  } catch (error) {
    console.error('❌ Error cleaning up expired entries:', error);
    return 0;
  }
}

export default {
  checkSlotFitsService,
  findFirstAvailableSlot,
  notifyWaitingListForOpenedSlot,
  notifyWaitingListForCancelledBooking,
  cleanupExpiredEntries
};
