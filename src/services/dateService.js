/**
 * Centralized Date Service
 * Handles all date parsing, formatting, and comparison across the app
 * 
 * Supported input formats:
 * - YYYY-MM-DD (ISO format, preferred)
 * - DD/MM/YYYY (legacy format from some DB entries)
 * - Date objects
 */

import { format, parseISO, isValid, isSameDay as dateFnsIsSameDay, startOfDay } from 'date-fns';
import { he } from 'date-fns/locale';

/**
 * Parse any date string/object into a Date object
 * @param {string|Date} dateInput - Date in any supported format
 * @returns {Date|null} - Parsed Date object or null if invalid
 */
export function parseDate(dateInput) {
  if (!dateInput) return null;
  
  // Already a Date object
  if (dateInput instanceof Date) {
    return isValid(dateInput) ? dateInput : null;
  }
  
  // String input
  if (typeof dateInput === 'string') {
    // Try DD/MM/YYYY format
    if (dateInput.includes('/')) {
      const parts = dateInput.split('/');
      if (parts.length === 3) {
        const [day, month, year] = parts.map(Number);
        const date = new Date(year, month - 1, day);
        return isValid(date) ? date : null;
      }
    }
    
    // Try ISO format (YYYY-MM-DD or full ISO string)
    const parsed = parseISO(dateInput);
    return isValid(parsed) ? parsed : null;
  }
  
  return null;
}

/**
 * Convert any date input to ISO format (YYYY-MM-DD)
 * @param {string|Date} dateInput - Date in any supported format
 * @returns {string|null} - ISO date string or null if invalid
 */
export function toISO(dateInput) {
  const date = parseDate(dateInput);
  if (!date) return null;
  return format(date, 'yyyy-MM-dd');
}

/**
 * Convert any date input to legacy format (DD/MM/YYYY)
 * Use only when interfacing with systems that require this format
 * @param {string|Date} dateInput - Date in any supported format
 * @returns {string|null} - Legacy date string or null if invalid
 */
export function toLegacy(dateInput) {
  const date = parseDate(dateInput);
  if (!date) return null;
  return format(date, 'dd/MM/yyyy');
}

/**
 * Check if two dates are the same day
 * @param {string|Date} date1 - First date
 * @param {string|Date} date2 - Second date
 * @returns {boolean}
 */
export function isSameDay(date1, date2) {
  const d1 = parseDate(date1);
  const d2 = parseDate(date2);
  if (!d1 || !d2) return false;
  return dateFnsIsSameDay(d1, d2);
}

/**
 * Check if a date is in the past (before today)
 * @param {string|Date} dateInput - Date to check
 * @returns {boolean}
 */
export function isPast(dateInput) {
  const date = parseDate(dateInput);
  if (!date) return false;
  return startOfDay(date) < startOfDay(new Date());
}

/**
 * Check if a date is today
 * @param {string|Date} dateInput - Date to check
 * @returns {boolean}
 */
export function isToday(dateInput) {
  const date = parseDate(dateInput);
  if (!date) return false;
  return dateFnsIsSameDay(date, new Date());
}

/**
 * Check if a date is in the future (after today)
 * @param {string|Date} dateInput - Date to check
 * @returns {boolean}
 */
export function isFuture(dateInput) {
  const date = parseDate(dateInput);
  if (!date) return false;
  return startOfDay(date) > startOfDay(new Date());
}

/**
 * Format date for Hebrew display
 * @param {string|Date} dateInput - Date to format
 * @param {string} formatStr - date-fns format string (default: 'EEEE, d בMMMM yyyy')
 * @returns {string} - Formatted date string in Hebrew
 */
export function formatHebrew(dateInput, formatStr = 'EEEE, d בMMMM yyyy') {
  const date = parseDate(dateInput);
  if (!date) return '';
  return format(date, formatStr, { locale: he });
}

/**
 * Format date for short Hebrew display
 * @param {string|Date} dateInput - Date to format
 * @returns {string} - Formatted date string (e.g., "יום רביעי, 14 בינואר")
 */
export function formatHebrewShort(dateInput) {
  return formatHebrew(dateInput, 'EEEE, d בMMMM');
}

/**
 * Format date as numeric display
 * @param {string|Date} dateInput - Date to format
 * @returns {string} - Formatted date string (e.g., "14.1.2026")
 */
export function formatNumeric(dateInput) {
  const date = parseDate(dateInput);
  if (!date) return '';
  return format(date, 'd.M.yyyy');
}

/**
 * Format date as short numeric display (day.month only)
 * @param {string|Date} dateInput - Date to format
 * @returns {string} - Formatted date string (e.g., "14.1")
 */
export function formatShort(dateInput) {
  const date = parseDate(dateInput);
  if (!date) return '';
  return format(date, 'd.M');
}

/**
 * Get day of week index (0 = Sunday, 6 = Saturday)
 * @param {string|Date} dateInput - Date to check
 * @returns {number} - Day index (0-6)
 */
export function getDayOfWeek(dateInput) {
  const date = parseDate(dateInput);
  if (!date) return -1;
  return date.getDay();
}

/**
 * Get day key for schedule lookup
 * @param {string|Date} dateInput - Date to check
 * @returns {string} - Day key (sunday, monday, etc.)
 */
export function getDayKey(dateInput) {
  const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayIndex = getDayOfWeek(dateInput);
  return dayIndex >= 0 ? dayKeys[dayIndex] : null;
}

/**
 * Normalize a booking date from DB to ISO format
 * Handles both YYYY-MM-DD and DD/MM/YYYY formats
 * @param {string} bookingDate - Date string from booking record
 * @returns {string} - ISO date string
 */
export function normalizeBookingDate(bookingDate) {
  if (!bookingDate) return null;
  
  // Already ISO format
  if (bookingDate.match(/^\d{4}-\d{2}-\d{2}/)) {
    return bookingDate.substring(0, 10); // Take just the date part
  }
  
  // DD/MM/YYYY format
  if (bookingDate.includes('/')) {
    return toISO(bookingDate);
  }
  
  return bookingDate;
}

/**
 * Compare two date strings for sorting (ascending)
 * @param {string} dateA - First date
 * @param {string} dateB - Second date
 * @returns {number} - Comparison result for Array.sort()
 */
export function compareDatesAsc(dateA, dateB) {
  const a = parseDate(dateA);
  const b = parseDate(dateB);
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.getTime() - b.getTime();
}

/**
 * Compare two date strings for sorting (descending)
 * @param {string} dateA - First date
 * @param {string} dateB - Second date
 * @returns {number} - Comparison result for Array.sort()
 */
export function compareDatesDesc(dateA, dateB) {
  return -compareDatesAsc(dateA, dateB);
}

export default {
  parseDate,
  toISO,
  toLegacy,
  isSameDay,
  isPast,
  isToday,
  isFuture,
  formatHebrew,
  formatHebrewShort,
  formatNumeric,
  formatShort,
  getDayOfWeek,
  getDayKey,
  normalizeBookingDate,
  compareDatesAsc,
  compareDatesDesc
};
