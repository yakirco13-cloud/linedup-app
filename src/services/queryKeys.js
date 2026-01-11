/**
 * Centralized Query Keys Registry
 * All React Query keys defined in one place
 * 
 * This ensures:
 * - Consistent key naming across the app
 * - Correct invalidation (no more key mismatches)
 * - Easy to find what queries exist
 * 
 * Usage:
 *   import { queryKeys } from '@/services/queryKeys';
 *   
 *   useQuery({ queryKey: queryKeys.bookings(businessId) })
 *   queryClient.invalidateQueries({ queryKey: queryKeys.bookings(businessId) })
 */

export const queryKeys = {
  // ============ Business ============
  business: (businessId) => ['business', businessId],
  businessByCode: (code) => ['business', 'code', code],
  
  // ============ Bookings ============
  // All bookings for a business
  bookings: (businessId) => ['bookings', businessId],
  
  // Bookings for a specific date
  bookingsForDate: (businessId, date) => ['bookings', businessId, date],
  
  // Bookings for a specific staff member
  bookingsForStaff: (staffId, date) => ['bookings', 'staff', staffId, date],
  
  // Single booking
  booking: (bookingId) => ['booking', bookingId],
  
  // Client's bookings
  myBookings: (phone) => ['my-bookings', phone],
  
  // Existing bookings for availability check
  existingBookings: (staffId, date) => ['existing-bookings', staffId, date],
  
  // ============ Staff ============
  staff: (businessId) => ['staff', businessId],
  staffMember: (staffId) => ['staff-member', staffId],
  
  // ============ Services ============
  services: (businessId) => ['services', businessId],
  service: (serviceId) => ['service', serviceId],
  
  // ============ Clients ============
  clients: (businessId) => ['clients', businessId],
  client: (clientId) => ['client', clientId],
  
  // ============ Waiting List ============
  waitingList: (businessId, date) => ['waiting-list', businessId, date],
  myWaitingList: (phone) => ['my-waiting-list', phone],
  
  // ============ Schedule ============
  scheduleOverrides: (businessId) => ['schedule-overrides', businessId],
  
  // ============ Notifications ============
  notifications: (businessId) => ['notifications', businessId],
  unreadNotifications: (businessId) => ['notifications', businessId, 'unread'],
  
  // ============ Statistics ============
  statistics: (businessId) => ['statistics', businessId],
  statisticsForPeriod: (businessId, startDate, endDate) => ['statistics', businessId, startDate, endDate],
  
  // ============ Message Usage ============
  messageUsage: (businessId) => ['message-usage', businessId],
};

/**
 * Helper to invalidate all booking-related queries for a business
 * Use after any booking mutation
 */
export function getBookingInvalidationKeys(businessId) {
  return [
    queryKeys.bookings(businessId),
    ['existing-bookings'], // Invalidate all existing-bookings queries
    ['my-bookings'], // Invalidate all my-bookings queries
  ];
}

/**
 * Helper to invalidate all waiting list queries for a business
 */
export function getWaitingListInvalidationKeys(businessId) {
  return [
    ['waiting-list', businessId],
    ['my-waiting-list'],
  ];
}

export default queryKeys;
