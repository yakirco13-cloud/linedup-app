/**
 * Utility functions for calendar drag-and-drop functionality
 */

const HOUR_HEIGHT = 52; // pixels per hour (matches CalendarView)
const START_HOUR = 8;   // 8 AM
const END_HOUR = 21;    // 9 PM
const SLOT_INTERVAL = 15; // 15-minute intervals

/**
 * Convert a Y position to time in minutes
 * @param {number} yPosition - Cursor Y position
 * @param {number} containerTop - Top offset of the calendar container
 * @returns {number} - Time in minutes from midnight
 */
export function positionToMinutes(yPosition, containerTop) {
  const relativeY = yPosition - containerTop;
  const minutesFromStart = (relativeY / HOUR_HEIGHT) * 60;
  return START_HOUR * 60 + minutesFromStart;
}

/**
 * Snap minutes to the nearest interval (15 minutes by default)
 * @param {number} minutes - Time in minutes from midnight
 * @param {number} interval - Snap interval in minutes
 * @returns {number} - Snapped minutes, clamped to business hours
 */
export function snapToInterval(minutes, interval = SLOT_INTERVAL) {
  const snapped = Math.round(minutes / interval) * interval;
  const minMinutes = START_HOUR * 60;
  const maxMinutes = END_HOUR * 60;
  return Math.max(minMinutes, Math.min(maxMinutes, snapped));
}

/**
 * Convert total minutes to HH:MM time string
 * @param {number} totalMinutes - Minutes from midnight
 * @returns {string} - Time in HH:MM format
 */
export function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Convert X position to day index (RTL aware)
 * The calendar uses flex-row-reverse, so:
 * - Time column is on the RIGHT
 * - Day columns are on the LEFT, ordered right-to-left (displayDays is already reversed)
 *
 * @param {number} xPosition - Cursor X position
 * @param {DOMRect} containerRect - Calendar container bounding rect
 * @param {number} columnCount - Number of day columns
 * @param {number} timeColumnWidth - Width of the time column (default 64px / w-16)
 * @returns {number} - Day column index (0-based)
 */
export function positionToColumnIndex(xPosition, containerRect, columnCount, timeColumnWidth = 64) {
  // Day columns span from container.left to (container.right - timeColumnWidth)
  const dayColumnsWidth = containerRect.width - timeColumnWidth;
  // X position relative to the LEFT of the container
  const relativeX = xPosition - containerRect.left;
  // Calculate column width
  const columnWidth = dayColumnsWidth / columnCount;
  // Get raw column index
  const rawIndex = Math.floor(relativeX / columnWidth);
  // Invert: displayDays is reversed, so left side of screen = higher index in displayDays
  const columnIndex = columnCount - 1 - rawIndex;
  // Clamp to valid range
  return Math.max(0, Math.min(columnCount - 1, columnIndex));
}

/**
 * Get the target date from column index
 * @param {number} columnIndex - Column index from positionToColumnIndex
 * @param {Date[]} displayDays - Array of displayed days (already reversed for RTL)
 * @returns {Date} - Target date
 */
export function columnIndexToDate(columnIndex, displayDays) {
  return displayDays[Math.max(0, Math.min(displayDays.length - 1, columnIndex))];
}

/**
 * Calculate the snapped position (top) for a given time
 * @param {string} time - Time in HH:MM format
 * @returns {number} - Top position in pixels
 */
export function timeToPosition(time) {
  const [hours, minutes] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  const minutesFromStart = totalMinutes - START_HOUR * 60;
  return (minutesFromStart / 60) * HOUR_HEIGHT;
}

export default {
  positionToMinutes,
  snapToInterval,
  minutesToTime,
  positionToColumnIndex,
  columnIndexToDate,
  timeToPosition,
  HOUR_HEIGHT,
  START_HOUR,
  END_HOUR,
  SLOT_INTERVAL
};
