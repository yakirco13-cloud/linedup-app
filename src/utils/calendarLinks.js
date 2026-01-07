/**
 * Generate Google Calendar "Add Event" URL
 * Opens Google Calendar with pre-filled event details
 */
export function generateGoogleCalendarLink({
  title,
  description,
  location,
  startDate, // Date object or YYYY-MM-DD string
  startTime, // HH:MM string
  duration = 30, // minutes
}) {
  // Parse start date
  let start;
  if (typeof startDate === 'string') {
    if (startDate.includes('/')) {
      // DD/MM/YYYY format
      const [d, m, y] = startDate.split('/');
      start = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${startTime}:00`);
    } else {
      // YYYY-MM-DD format
      start = new Date(`${startDate}T${startTime}:00`);
    }
  } else {
    // Date object
    const [hours, minutes] = startTime.split(':').map(Number);
    start = new Date(startDate);
    start.setHours(hours, minutes, 0, 0);
  }

  // Calculate end time
  const end = new Date(start.getTime() + duration * 60000);

  // Format dates for Google Calendar (YYYYMMDDTHHmmss)
  const formatForGoogle = (date) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
  };

  const startFormatted = formatForGoogle(start);
  const endFormatted = formatForGoogle(end);

  // Build URL
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${startFormatted}/${endFormatted}`,
    details: description || '',
    location: location || '',
    ctz: 'Asia/Jerusalem'
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generate Apple Calendar (.ics) download
 * For iPhone users
 */
export function generateICSFile({
  title,
  description,
  location,
  startDate,
  startTime,
  duration = 30,
}) {
  // Parse start date
  let start;
  if (typeof startDate === 'string') {
    if (startDate.includes('/')) {
      const [d, m, y] = startDate.split('/');
      start = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${startTime}:00`);
    } else {
      start = new Date(`${startDate}T${startTime}:00`);
    }
  } else {
    const [hours, minutes] = startTime.split(':').map(Number);
    start = new Date(startDate);
    start.setHours(hours, minutes, 0, 0);
  }

  const end = new Date(start.getTime() + duration * 60000);

  // Format for ICS (YYYYMMDDTHHmmss)
  const formatForICS = (date) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
  };

  const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//LinedUp//Booking//HE
BEGIN:VEVENT
DTSTART:${formatForICS(start)}
DTEND:${formatForICS(end)}
SUMMARY:${title}
DESCRIPTION:${(description || '').replace(/\n/g, '\\n')}
LOCATION:${location || ''}
END:VEVENT
END:VCALENDAR`;

  return icsContent;
}

/**
 * Download ICS file
 */
export function downloadICS(icsContent, filename = 'booking.ics') {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
