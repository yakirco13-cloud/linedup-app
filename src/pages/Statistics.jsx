import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useUser } from "@/components/UserContext";
import { useQuery } from "@tanstack/react-query";
import { FeatureGate, useFeatureGate } from "@/components/FeatureGate";
import UpgradeModal from "@/components/UpgradeModal";
import {
  Calendar, TrendingUp, TrendingDown, Users, DollarSign,
  XCircle, Clock, ArrowRight, Loader2, BarChart3, PieChart,
  Sparkles, Target, Download, UserPlus, UserCheck, CalendarDays,
  Timer, CheckCircle, FileText, ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { 
  format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, subDays, subWeeks, subMonths,
  eachDayOfInterval, isWithinInterval, getDay
} from "date-fns";
import { he } from "date-fns/locale";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Area, AreaChart, PieChart as RechartsPie, Pie, Cell
} from "recharts";

export default function Statistics() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [timeRange, setTimeRange] = useState('month');

  const { data: business, isLoading: businessLoading, error: businessError } = useQuery({
    queryKey: ['business', user?.business_id],
    queryFn: async () => {
      const businesses = await base44.entities.Business.filter({ id: user.business_id });
      return businesses[0];
    },
    enabled: !!user?.business_id,
  });

  if (!user?.business_id) {
    return (
      <div className="min-h-screen bg-[#0C0F1D] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1A1F35] flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8 text-[#FF6B35]" />
          </div>
          <p className="text-white font-medium mb-2">לא נמצא עסק</p>
          <p className="text-[#64748B] text-sm mb-6">יש להגדיר עסק כדי לצפות בסטטיסטיקות</p>
          <Button onClick={() => navigate(createPageUrl("BusinessDashboard"))} style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }} className="rounded-xl">חזור לדשבורד</Button>
        </div>
      </div>
    );
  }

  if (businessLoading) {
    return (
      <div className="min-h-screen bg-[#0C0F1D] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#FF6B35]" />
          <p className="text-[#64748B] text-sm">טוען נתונים...</p>
        </div>
      </div>
    );
  }

  if (businessError) {
    return (
      <div className="min-h-screen bg-[#0C0F1D] flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-400 mb-4">שגיאה בטעינת נתונים</p>
          <Button onClick={() => navigate(createPageUrl("BusinessDashboard"))}>חזור לדשבורד</Button>
        </div>
      </div>
    );
  }

  return (
    <FeatureGate feature="statistics">
      <StatisticsContent business={business} timeRange={timeRange} setTimeRange={setTimeRange} navigate={navigate} />
    </FeatureGate>
  );
}

function StatisticsContent({ business, timeRange, setTimeRange, navigate }) {
  const { hasAccess: canExport } = useFeatureGate('dataExport');
  const [showExportUpgrade, setShowExportUpgrade] = useState(false);

  const { data: allBookings = [], isLoading } = useQuery({
    queryKey: ['statistics-bookings', business?.id],
    queryFn: async () => {
      const bookings = await base44.entities.Booking.filter({ business_id: business.id }, '-date', 2000);
      return bookings;
    },
    enabled: !!business?.id,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services', business?.id],
    queryFn: () => base44.entities.Service.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });

  const dateRanges = useMemo(() => {
    const now = new Date();
    let currentStart, currentEnd, previousStart, previousEnd;
    switch (timeRange) {
      case 'today':
        currentStart = startOfDay(now); currentEnd = endOfDay(now);
        previousStart = startOfDay(subDays(now, 1)); previousEnd = endOfDay(subDays(now, 1));
        break;
      case 'week':
        currentStart = startOfWeek(now, { weekStartsOn: 0 }); currentEnd = endOfWeek(now, { weekStartsOn: 0 });
        previousStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 0 }); previousEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 0 });
        break;
      case 'month':
      default:
        currentStart = startOfMonth(now); currentEnd = endOfMonth(now);
        previousStart = startOfMonth(subMonths(now, 1)); previousEnd = endOfMonth(subMonths(now, 1));
        break;
    }
    return { currentStart, currentEnd, previousStart, previousEnd };
  }, [timeRange]);

  const filterBookingsByRange = (bookings, start, end) => {
    return bookings.filter(booking => {
      const bookingDate = parseISO(booking.date);
      return isWithinInterval(bookingDate, { start, end });
    });
  };

  const stats = useMemo(() => {
    const { currentStart, currentEnd, previousStart, previousEnd } = dateRanges;
    const currentBookings = filterBookingsByRange(allBookings, currentStart, currentEnd);
    const previousBookings = filterBookingsByRange(allBookings, previousStart, previousEnd);
    const currentConfirmed = currentBookings.filter(b => b.status === 'confirmed' || b.status === 'completed');
    const previousConfirmed = previousBookings.filter(b => b.status === 'confirmed' || b.status === 'completed');
    const currentCancelled = currentBookings.filter(b => b.status === 'cancelled');
    const previousCancelled = previousBookings.filter(b => b.status === 'cancelled');

    const calculateRevenue = (bookings) => bookings.reduce((sum, booking) => {
      const service = services.find(s => s.id === booking.service_id);
      return sum + (service?.price || 0);
    }, 0);

    const currentRevenue = calculateRevenue(currentConfirmed);
    const previousRevenue = calculateRevenue(previousConfirmed);
    const currentClients = new Set(currentConfirmed.map(b => b.client_phone)).size;
    const previousClients = new Set(previousConfirmed.map(b => b.client_phone)).size;
    const currentCancellationRate = currentBookings.length > 0 ? (currentCancelled.length / currentBookings.length) * 100 : 0;
    const calcChange = (current, previous) => previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;
    const avgBookingValue = currentConfirmed.length > 0 ? currentRevenue / currentConfirmed.length : 0;

    return {
      bookings: { current: currentConfirmed.length, previous: previousConfirmed.length, change: calcChange(currentConfirmed.length, previousConfirmed.length) },
      revenue: { current: currentRevenue, previous: previousRevenue, change: calcChange(currentRevenue, previousRevenue) },
      clients: { current: currentClients, previous: previousClients, change: calcChange(currentClients, previousClients) },
      cancellations: { current: currentCancellationRate, change: 0 },
      avgBookingValue, currentBookings, currentConfirmed, currentCancelled
    };
  }, [allBookings, services, dateRanges]);

  const clientAnalysis = useMemo(() => {
    const { currentStart } = dateRanges;
    const currentBookings = filterBookingsByRange(allBookings, dateRanges.currentStart, dateRanges.currentEnd);
    const currentClientPhones = [...new Set(currentBookings.map(b => b.client_phone).filter(Boolean))];
    let newClients = 0, returningClients = 0;
    currentClientPhones.forEach(phone => {
      const previousBookings = allBookings.filter(b => b.client_phone === phone && parseISO(b.date) < currentStart);
      if (previousBookings.length > 0) returningClients++; else newClients++;
    });
    const total = newClients + returningClients;
    return { new: newClients, returning: returningClients, newPercentage: total > 0 ? (newClients / total) * 100 : 0, returningPercentage: total > 0 ? (returningClients / total) * 100 : 0 };
  }, [allBookings, dateRanges]);

  const statusBreakdown = useMemo(() => {
    const completed = stats.currentConfirmed.length, cancelled = stats.currentCancelled.length, total = completed + cancelled;
    return {
      completed, cancelled,
      completedPercentage: total > 0 ? (completed / total) * 100 : 0,
      cancelledPercentage: total > 0 ? (cancelled / total) * 100 : 0,
      data: [{ name: 'הושלם', value: completed, color: '#22C55E' }, { name: 'בוטל', value: cancelled, color: '#EF4444' }].filter(d => d.value > 0)
    };
  }, [stats]);

  const busiestDay = useMemo(() => {
    const currentBookings = filterBookingsByRange(allBookings, dateRanges.currentStart, dateRanges.currentEnd);
    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    currentBookings.forEach(booking => { dayCounts[getDay(parseISO(booking.date))]++; });
    const maxCount = Math.max(...dayCounts);
    return { day: dayNames[dayCounts.indexOf(maxCount)], count: maxCount, data: dayNames.map((name, i) => ({ name, bookings: dayCounts[i] })) };
  }, [allBookings, dateRanges]);

  const revenueByService = useMemo(() => {
    const serviceRevenue = {};
    stats.currentConfirmed.forEach(booking => {
      const service = services.find(s => s.id === booking.service_id);
      if (service) {
        if (!serviceRevenue[service.name]) serviceRevenue[service.name] = { name: service.name, revenue: 0, count: 0 };
        serviceRevenue[service.name].revenue += service.price || 0;
        serviceRevenue[service.name].count++;
      }
    });
    const result = Object.values(serviceRevenue).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    const maxRevenue = result.length > 0 ? result[0].revenue : 0;
    return result.map(s => ({ ...s, percentage: maxRevenue > 0 ? (s.revenue / maxRevenue) * 100 : 0 }));
  }, [stats.currentConfirmed, services]);

  const growthTrend = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(now, i));
      const monthEnd = endOfMonth(subMonths(now, i));
      const monthBookings = filterBookingsByRange(allBookings, monthStart, monthEnd);
      const confirmedBookings = monthBookings.filter(b => b.status === 'confirmed' || b.status === 'completed');
      const revenue = confirmedBookings.reduce((sum, booking) => {
        const service = services.find(s => s.id === booking.service_id);
        return sum + (service?.price || 0);
      }, 0);
      months.push({ month: format(monthStart, 'MMM', { locale: he }), bookings: confirmedBookings.length, revenue });
    }
    const currentMonth = months[months.length - 1], previousMonth = months[months.length - 2];
    const growth = previousMonth.revenue > 0 ? ((currentMonth.revenue - previousMonth.revenue) / previousMonth.revenue) * 100 : 0;
    return { months, growth };
  }, [allBookings, services]);

  const deadTime = useMemo(() => {
    const currentBookings = filterBookingsByRange(allBookings, dateRanges.currentStart, dateRanges.currentEnd)
      .filter(b => b.status === 'confirmed' || b.status === 'completed').sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    if (!business?.working_hours || currentBookings.length === 0) return { totalHours: 0, emptySlots: 0, gaps: 0, percentage: 0 };
    const workingHours = business.working_hours;
    let totalWorkingMinutes = 0, emptySlotMinutes = 0, gapMinutes = 0;
    const days = eachDayOfInterval({ start: dateRanges.currentStart, end: dateRanges.currentEnd });
    days.forEach(day => {
      const dayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][getDay(day)];
      const dayHours = workingHours[dayKey];
      if (!dayHours?.enabled) return;
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayBookings = currentBookings.filter(b => b.date === dateStr);
      const shifts = dayHours.shifts || [{ start: dayHours.start || '09:00', end: dayHours.end || '17:00' }];
      shifts.forEach(shift => {
        const [startH, startM] = shift.start.split(':').map(Number);
        const [endH, endM] = shift.end.split(':').map(Number);
        const shiftMinutes = (endH * 60 + endM) - (startH * 60 + startM);
        totalWorkingMinutes += shiftMinutes;
        const shiftBookings = dayBookings.filter(b => {
          const [bookH, bookM] = b.time.split(':').map(Number);
          const bookMinutes = bookH * 60 + bookM;
          return bookMinutes >= (startH * 60 + startM) && bookMinutes < (endH * 60 + endM);
        }).sort((a, b) => a.time.localeCompare(b.time));
        let lastEndMinutes = startH * 60 + startM;
        shiftBookings.forEach(booking => {
          const [bookH, bookM] = booking.time.split(':').map(Number);
          const bookStartMinutes = bookH * 60 + bookM;
          const service = services.find(s => s.id === booking.service_id);
          const duration = service?.duration || booking.duration || 30;
          if (bookStartMinutes > lastEndMinutes) gapMinutes += bookStartMinutes - lastEndMinutes;
          lastEndMinutes = bookStartMinutes + duration;
        });
        const shiftEndMinutes = endH * 60 + endM;
        if (lastEndMinutes < shiftEndMinutes && shiftBookings.length > 0) gapMinutes += shiftEndMinutes - lastEndMinutes;
        if (shiftBookings.length === 0) emptySlotMinutes += shiftMinutes;
      });
    });
    const totalDeadMinutes = emptySlotMinutes + gapMinutes;
    return { totalHours: Math.round(totalDeadMinutes / 60), emptySlots: Math.round(emptySlotMinutes / 60), gaps: Math.round(gapMinutes / 60), percentage: totalWorkingMinutes > 0 ? Math.round((totalDeadMinutes / totalWorkingMinutes) * 100) : 0 };
  }, [allBookings, business, services, dateRanges]);

  const bookingsByDay = useMemo(() => {
    const days = eachDayOfInterval({ start: dateRanges.currentStart, end: dateRanges.currentEnd });
    return days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayBookings = allBookings.filter(b => b.date === dateStr && (b.status === 'confirmed' || b.status === 'completed'));
      const revenue = dayBookings.reduce((sum, b) => { const service = services.find(s => s.id === b.service_id); return sum + (service?.price || 0); }, 0);
      return { date: format(day, 'd/M', { locale: he }), bookings: dayBookings.length, revenue };
    });
  }, [allBookings, services, dateRanges]);

  const bookingsByHour = useMemo(() => {
    const currentBookings = filterBookingsByRange(allBookings, dateRanges.currentStart, dateRanges.currentEnd);
    const hours = Array.from({ length: 13 }, (_, i) => ({ hour: i + 8, shortHour: `${i + 8}`, bookings: 0 }));
    currentBookings.forEach(booking => {
      if (booking.time) { const hour = parseInt(booking.time.split(':')[0]); const hourIndex = hour - 8; if (hourIndex >= 0 && hourIndex < hours.length) hours[hourIndex].bookings++; }
    });
    return hours;
  }, [allBookings, dateRanges]);

  const peakHour = useMemo(() => {
    const maxBookings = Math.max(...bookingsByHour.map(h => h.bookings));
    const peakHourData = bookingsByHour.find(h => h.bookings === maxBookings);
    return peakHourData && maxBookings > 0 ? `${peakHourData.hour}:00` : '-';
  }, [bookingsByHour]);

  const servicePopularity = useMemo(() => {
    const serviceCounts = {};
    stats.currentConfirmed.forEach(booking => { const service = services.find(s => s.id === booking.service_id); if (service) serviceCounts[service.name] = (serviceCounts[service.name] || 0) + 1; });
    const sorted = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
    const maxCount = sorted[0]?.count || 0;
    return sorted.map(s => ({ ...s, percentage: maxCount > 0 ? (s.count / maxCount) * 100 : 0 }));
  }, [stats.currentConfirmed, services]);

  // Service Mix - percentage of each service from total
  const serviceMix = useMemo(() => {
    const total = stats.currentConfirmed.length;
    if (total === 0) return [];
    const serviceCounts = {};
    stats.currentConfirmed.forEach(booking => {
      const service = services.find(s => s.id === booking.service_id);
      if (service) serviceCounts[service.name] = (serviceCounts[service.name] || 0) + 1;
    });
    return Object.entries(serviceCounts)
      .map(([name, count]) => ({ name, count, percentage: (count / total) * 100 }))
      .sort((a, b) => b.count - a.count);
  }, [stats.currentConfirmed, services]);

  // Average service duration in minutes
  const avgServiceDuration = useMemo(() => {
    const durations = stats.currentConfirmed.map(booking => {
      const service = services.find(s => s.id === booking.service_id);
      return service?.duration || booking.duration || 30;
    });
    if (durations.length === 0) return 0;
    return Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length);
  }, [stats.currentConfirmed, services]);

  // Rebooking interval - average days between visits for returning clients
  const rebookingInterval = useMemo(() => {
    const clientVisits = {};
    const sortedBookings = [...allBookings]
      .filter(b => (b.status === 'confirmed' || b.status === 'completed') && b.client_phone)
      .sort((a, b) => a.date.localeCompare(b.date));
    sortedBookings.forEach(booking => {
      if (!clientVisits[booking.client_phone]) clientVisits[booking.client_phone] = [];
      clientVisits[booking.client_phone].push(booking.date);
    });
    const intervals = [];
    Object.values(clientVisits).forEach(dates => {
      if (dates.length < 2) return;
      for (let i = 1; i < dates.length; i++) {
        const daysDiff = Math.abs((new Date(dates[i]) - new Date(dates[i-1])) / (1000 * 60 * 60 * 24));
        if (daysDiff > 0 && daysDiff < 365) intervals.push(daysDiff);
      }
    });
    if (intervals.length === 0) return 0;
    return Math.round(intervals.reduce((sum, d) => sum + d, 0) / intervals.length);
  }, [allBookings]);

  // Clients per day (average in current period)
  const clientsPerDay = useMemo(() => {
    const days = eachDayOfInterval({ start: dateRanges.currentStart, end: dateRanges.currentEnd });
    const workingDays = days.filter(day => {
      if (!business?.working_hours) return true;
      const dayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][getDay(day)];
      return business.working_hours[dayKey]?.enabled;
    }).length;
    if (workingDays === 0) return 0;
    return (stats.bookings.current / workingDays).toFixed(1);
  }, [stats.bookings.current, dateRanges, business]);

  // Revenue per unique client
  const revenuePerClient = useMemo(() => {
    if (stats.clients.current === 0) return 0;
    return Math.round(stats.revenue.current / stats.clients.current);
  }, [stats.revenue.current, stats.clients.current]);

  const handleExportCSV = () => {
    if (!canExport) {
      setShowExportUpgrade(true);
      return;
    }
    const currentBookings = filterBookingsByRange(allBookings, dateRanges.currentStart, dateRanges.currentEnd);
    let csv = '\uFEFF';
    csv += 'סיכום תקופה\n';
    csv += `תקופה,${format(dateRanges.currentStart, 'dd/MM/yyyy')} - ${format(dateRanges.currentEnd, 'dd/MM/yyyy')}\n`;
    csv += `סה"כ תורים,${stats.bookings.current}\n`;
    csv += `הכנסות,₪${stats.revenue.current.toLocaleString()}\n`;
    csv += `לקוחות,${stats.clients.current}\n`;
    csv += `אחוז ביטולים,${stats.cancellations.current.toFixed(1)}%\n`;
    csv += `לקוחות חדשים,${clientAnalysis.new}\n`;
    csv += `לקוחות חוזרים,${clientAnalysis.returning}\n`;
    csv += `תפוסה,${100 - deadTime.percentage}%\n`;
    csv += `שעות פנויות,${deadTime.totalHours}\n`;
    csv += `לקוחות ליום,${clientsPerDay}\n`;
    csv += `הכנסה ללקוח,₪${revenuePerClient}\n`;
    csv += `משך טיפול ממוצע,${avgServiceDuration} דקות\n`;
    csv += `מרווח בין ביקורים,${rebookingInterval} ימים\n`;
    csv += `צמיחה חודשית,${growthTrend.growth.toFixed(1)}%\n\n`;
    csv += 'תמהיל שירותים\nשירות,כמות,אחוז\n';
    serviceMix.forEach(s => { csv += `${s.name},${s.count},${s.percentage.toFixed(1)}%\n`; });
    csv += '\n';
    csv += 'רשימת תורים\nתאריך,שעה,לקוח,טלפון,שירות,מחיר,סטטוס\n';
    currentBookings.forEach(booking => { const service = services.find(s => s.id === booking.service_id); csv += `${booking.date},${booking.time},${booking.client_name || ''},${booking.client_phone || ''},${service?.name || ''},${service?.price || 0},${booking.status}\n`; });
    csv += '\nרשימת לקוחות\nשם,טלפון,מספר תורים\n';
    const clientBookingCounts = {};
    currentBookings.forEach(b => { const key = b.client_phone || 'unknown'; if (!clientBookingCounts[key]) clientBookingCounts[key] = { name: b.client_name || '', phone: b.client_phone || '', count: 0 }; clientBookingCounts[key].count++; });
    Object.values(clientBookingCounts).forEach(client => { csv += `${client.name},${client.phone},${client.count}\n`; });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `linedup-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const handleExportPDF = async () => {
    if (!canExport) {
      setShowExportUpgrade(true);
      return;
    }
    // A4 dimensions at 96 DPI: 794 x 1123 pixels
    const container = document.createElement('div');
    container.style.cssText = 'position: absolute; left: -9999px; top: 0; width: 794px; background: #0C0F1D; font-family: system-ui, -apple-system, sans-serif;';

    const periodLabel = timeRange === 'today' ? 'היום' : timeRange === 'week' ? 'השבוע' : 'החודש';
    const dateRangeText = `${format(dateRanges.currentStart, 'dd/MM/yyyy')} - ${format(dateRanges.currentEnd, 'dd/MM/yyyy')}`;

    container.innerHTML = `
      <div style="direction: rtl; background: #0C0F1D; color: white; width: 794px; height: 1123px; box-sizing: border-box; display: flex; flex-direction: column;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #FF6B35, #FF1744); padding: 20px; text-align: center; flex-shrink: 0;">
          <h1 style="margin: 0 0 6px 0; font-size: 24px; font-weight: bold; color: white;">${business?.name || 'LinedUp'}</h1>
          <p style="margin: 0; font-size: 13px; color: rgba(255,255,255,0.9);">דוח סטטיסטיקות | ${periodLabel} | ${dateRangeText}</p>
        </div>

        <!-- Main Content -->
        <div style="padding: 16px; flex: 1; overflow: hidden;">
          <!-- Key Metrics -->
          <div style="background: #1A1F35; border-radius: 10px; padding: 14px; margin-bottom: 12px;">
            <h2 style="color: #FF6B35; font-size: 14px; margin: 0 0 12px 0; font-weight: bold;">מדדים עיקריים</h2>
            <div style="display: flex; justify-content: space-between; text-align: center;">
              <div style="flex: 1;">
                <div style="font-size: 24px; font-weight: bold; color: white;">${stats.bookings.current}</div>
                <div style="font-size: 11px; color: #94A3B8;">תורים</div>
              </div>
              <div style="flex: 1;">
                <div style="font-size: 24px; font-weight: bold; color: white;">₪${stats.revenue.current.toLocaleString()}</div>
                <div style="font-size: 11px; color: #94A3B8;">הכנסות</div>
              </div>
              <div style="flex: 1;">
                <div style="font-size: 24px; font-weight: bold; color: white;">${stats.clients.current}</div>
                <div style="font-size: 11px; color: #94A3B8;">לקוחות</div>
              </div>
              <div style="flex: 1;">
                <div style="font-size: 24px; font-weight: bold; color: white;">${stats.cancellations.current.toFixed(0)}%</div>
                <div style="font-size: 11px; color: #94A3B8;">ביטולים</div>
              </div>
            </div>
          </div>

          <!-- Two Column Section -->
          <div style="display: flex; gap: 12px; margin-bottom: 12px;">
            <!-- Client Analysis -->
            <div style="flex: 1; background: #1A1F35; border-radius: 10px; padding: 14px;">
              <h3 style="color: #FF6B35; font-size: 13px; margin: 0 0 10px 0; font-weight: bold;">ניתוח לקוחות</h3>
              <div style="color: white; font-size: 12px; margin-bottom: 6px;">
                <span style="color: #60A5FA;">●</span> לקוחות חדשים: ${clientAnalysis.new} (${clientAnalysis.newPercentage.toFixed(0)}%)
              </div>
              <div style="color: white; font-size: 12px;">
                <span style="color: #22C55E;">●</span> לקוחות חוזרים: ${clientAnalysis.returning} (${clientAnalysis.returningPercentage.toFixed(0)}%)
              </div>
            </div>

            <!-- Status Breakdown -->
            <div style="flex: 1; background: #1A1F35; border-radius: 10px; padding: 14px;">
              <h3 style="color: #FF6B35; font-size: 13px; margin: 0 0 10px 0; font-weight: bold;">פילוח סטטוס</h3>
              <div style="color: #22C55E; font-size: 12px; margin-bottom: 6px;">
                ✓ הושלמו: ${statusBreakdown.completed} (${statusBreakdown.completedPercentage.toFixed(0)}%)
              </div>
              <div style="color: #EF4444; font-size: 12px;">
                ✗ בוטלו: ${statusBreakdown.cancelled} (${statusBreakdown.cancelledPercentage.toFixed(0)}%)
              </div>
            </div>
          </div>

          <!-- KPIs Grid -->
          <div style="background: #1A1F35; border-radius: 10px; padding: 14px; margin-bottom: 12px;">
            <h3 style="color: #FF6B35; font-size: 13px; margin: 0 0 10px 0; font-weight: bold;">מדדי ביצוע</h3>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
              <div style="background: #0C0F1D; border-radius: 8px; padding: 8px; text-align: center;">
                <div style="font-size: 14px; font-weight: bold; color: ${growthTrend.growth >= 0 ? '#22C55E' : '#EF4444'};">${growthTrend.growth >= 0 ? '+' : ''}${growthTrend.growth.toFixed(1)}%</div>
                <div style="font-size: 9px; color: #94A3B8;">צמיחה</div>
              </div>
              <div style="background: #0C0F1D; border-radius: 8px; padding: 8px; text-align: center;">
                <div style="font-size: 14px; font-weight: bold; color: white;">${peakHour}</div>
                <div style="font-size: 9px; color: #94A3B8;">שעת שיא</div>
              </div>
              <div style="background: #0C0F1D; border-radius: 8px; padding: 8px; text-align: center;">
                <div style="font-size: 14px; font-weight: bold; color: white;">${clientsPerDay}</div>
                <div style="font-size: 9px; color: #94A3B8;">לקוחות/יום</div>
              </div>
              <div style="background: #0C0F1D; border-radius: 8px; padding: 8px; text-align: center;">
                <div style="font-size: 14px; font-weight: bold; color: white;">₪${revenuePerClient.toLocaleString()}</div>
                <div style="font-size: 9px; color: #94A3B8;">הכנסה/לקוח</div>
              </div>
              <div style="background: #0C0F1D; border-radius: 8px; padding: 8px; text-align: center;">
                <div style="font-size: 14px; font-weight: bold; color: white;">${avgServiceDuration} דק׳</div>
                <div style="font-size: 9px; color: #94A3B8;">משך טיפול</div>
              </div>
              <div style="background: #0C0F1D; border-radius: 8px; padding: 8px; text-align: center;">
                <div style="font-size: 14px; font-weight: bold; color: white;">${rebookingInterval > 0 ? rebookingInterval : '-'}</div>
                <div style="font-size: 9px; color: #94A3B8;">ימים בין ביקורים</div>
              </div>
              <div style="background: #0C0F1D; border-radius: 8px; padding: 8px; text-align: center;">
                <div style="font-size: 14px; font-weight: bold; color: white;">${busiestDay.day}</div>
                <div style="font-size: 9px; color: #94A3B8;">יום עמוס</div>
              </div>
              <div style="background: #0C0F1D; border-radius: 8px; padding: 8px; text-align: center;">
                <div style="font-size: 14px; font-weight: bold; color: white;">₪${stats.avgBookingValue.toFixed(0)}</div>
                <div style="font-size: 9px; color: #94A3B8;">ממוצע/תור</div>
              </div>
            </div>
          </div>

          <!-- Occupancy -->
          <div style="background: #1A1F35; border-radius: 10px; padding: 14px; margin-bottom: 12px;">
            <h3 style="color: #FF6B35; font-size: 13px; margin: 0 0 10px 0; font-weight: bold;">תפוסה ויעילות</h3>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
              <div style="background: #0C0F1D; border-radius: 8px; padding: 8px; text-align: center;">
                <div style="font-size: 14px; font-weight: bold; color: #22C55E;">${100 - deadTime.percentage}%</div>
                <div style="font-size: 9px; color: #94A3B8;">תפוסה</div>
              </div>
              <div style="background: #0C0F1D; border-radius: 8px; padding: 8px; text-align: center;">
                <div style="font-size: 14px; font-weight: bold; color: white;">${deadTime.totalHours}</div>
                <div style="font-size: 9px; color: #94A3B8;">שעות פנויות</div>
              </div>
              <div style="background: #0C0F1D; border-radius: 8px; padding: 8px; text-align: center;">
                <div style="font-size: 14px; font-weight: bold; color: #FBBF24;">${deadTime.emptySlots}</div>
                <div style="font-size: 9px; color: #94A3B8;">ימים ריקים</div>
              </div>
              <div style="background: #0C0F1D; border-radius: 8px; padding: 8px; text-align: center;">
                <div style="font-size: 14px; font-weight: bold; color: #F97316;">${deadTime.gaps}</div>
                <div style="font-size: 9px; color: #94A3B8;">פערים</div>
              </div>
            </div>
          </div>

          <!-- Two Column: Services + Monthly Trend -->
          <div style="display: flex; gap: 12px;">
            ${revenueByService.length > 0 ? `
            <!-- Top Services -->
            <div style="flex: 1; background: #1A1F35; border-radius: 10px; padding: 14px;">
              <h3 style="color: #FF6B35; font-size: 13px; margin: 0 0 10px 0; font-weight: bold;">שירותים מובילים</h3>
              ${revenueByService.slice(0, 4).map((service, i) => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                  <span style="color: white; font-size: 11px;">${i + 1}. ${service.name}</span>
                  <span style="color: #FF6B35; font-size: 11px; font-weight: bold;">₪${service.revenue.toLocaleString()}</span>
                </div>
              `).join('')}
            </div>
            ` : ''}

            <!-- Monthly Trend -->
            <div style="flex: 1; background: #1A1F35; border-radius: 10px; padding: 14px;">
              <h3 style="color: #FF6B35; font-size: 13px; margin: 0 0 10px 0; font-weight: bold;">מגמת 6 חודשים</h3>
              <div style="display: flex; justify-content: space-between; text-align: center;">
                ${growthTrend.months.map(month => `
                  <div style="flex: 1;">
                    <div style="font-size: 10px; color: #94A3B8; margin-bottom: 3px;">${month.month}</div>
                    <div style="font-size: 13px; font-weight: bold; color: white;">₪${month.revenue >= 1000 ? Math.round(month.revenue / 1000) + 'K' : month.revenue}</div>
                    <div style="font-size: 9px; color: #64748B;">${month.bookings}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div style="background: linear-gradient(135deg, #FF6B35, #FF1744); padding: 10px; text-align: center; flex-shrink: 0;">
          <p style="margin: 0; font-size: 10px; color: white;">נוצר על ידי LinedUp | ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container.firstElementChild, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#0C0F1D',
        width: 794,
        height: 1123,
      });

      const imgData = canvas.toDataURL('image/png');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'px', format: [794, 1123] });

      doc.addImage(imgData, 'PNG', 0, 0, 794, 1123);
      doc.save(`linedup-דוח-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      document.body.removeChild(container);
    }
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-[#1A1F35] border border-gray-700 rounded-lg p-2 shadow-lg">
        <p className="text-white text-xs font-medium mb-1">{label}</p>
        {payload.map((item, index) => (<p key={index} className="text-[#94A3B8] text-xs">{item.name}: {item.name === 'הכנסות' || item.dataKey === 'revenue' ? `₪${item.value}` : item.value}</p>))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0C0F1D] pb-24">
      <div className="bg-[#0C0F1D] border-b border-white/10 pt-safe">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(createPageUrl("BusinessDashboard"))}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 active:scale-95 transition-all touch-manipulation"
            >
              <ArrowRight className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-lg font-bold text-white">סטטיסטיקות</h1>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="h-11 min-h-[44px] px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium flex items-center gap-2 transition-all touch-manipulation"
              >
                <Download className="w-4 h-4" />
                ייצוא
                <ChevronDown className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#1A1F35] border-white/10 min-w-[160px]">
              <DropdownMenuItem
                onClick={handleExportPDF}
                className="text-white hover:bg-white/10 focus:bg-white/10 cursor-pointer gap-2 h-11"
              >
                <FileText className="w-4 h-4 text-[#FF6B35]" />
                <span>דוח PDF</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportCSV}
                className="text-white hover:bg-white/10 focus:bg-white/10 cursor-pointer gap-2 h-11"
              >
                <Download className="w-4 h-4 text-[#FF6B35]" />
                <span>קובץ CSV</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="px-4 py-3">
        <div className="flex gap-2 bg-[#1A1F35] p-1 rounded-xl">
          {[{ value: 'today', label: 'היום' }, { value: 'week', label: 'השבוע' }, { value: 'month', label: 'החודש' }].map(option => (
            <button key={option.value} onClick={() => setTimeRange(option.value)} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${timeRange === option.value ? 'bg-[#FF6B35] text-white' : 'text-[#94A3B8] hover:text-white'}`}>{option.label}</button>
          ))}
        </div>
      </div>
      {isLoading ? (<div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#FF6B35]" /></div>) : (
        <div className="px-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="תורים" value={stats.bookings.current} change={stats.bookings.change} icon={Calendar} />
            <StatCard label="הכנסות" value={`₪${stats.revenue.current.toLocaleString()}`} change={stats.revenue.change} icon={DollarSign} />
            <StatCard label="לקוחות" value={stats.clients.current} change={stats.clients.change} icon={Users} />
            <StatCard label="ביטולים" value={`${stats.cancellations.current.toFixed(0)}%`} change={stats.cancellations.change} icon={XCircle} invertChange />
          </div>

          <div className="bg-[#1A1F35] rounded-2xl p-4 border border-white/5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-[#FF6B35]" /><h3 className="font-bold text-white">מגמת צמיחה</h3></div>
              <div className={`flex items-center gap-1 text-sm font-bold ${growthTrend.growth >= 0 ? 'text-green-400' : 'text-red-400'}`}>{growthTrend.growth >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}{Math.abs(growthTrend.growth).toFixed(0)}%</div>
            </div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growthTrend.months}>
                  <defs><linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22C55E" stopOpacity={0.3} /><stop offset="100%" stopColor="#22C55E" stopOpacity={0} /></linearGradient></defs>
                  <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="revenue" stroke="#22C55E" strokeWidth={2} fill="url(#growthGradient)" name="הכנסות" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#1A1F35] rounded-2xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-4"><Users className="w-5 h-5 text-[#FF6B35]" /><h3 className="font-bold text-white">לקוחות חדשים vs חוזרים</h3></div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2"><UserPlus className="w-4 h-4 text-blue-400" /><span className="text-white text-sm">חדשים</span><span className="text-white font-bold mr-auto">{clientAnalysis.new}</span></div>
                <div className="h-2 bg-[#0C0F1D] rounded-full overflow-hidden"><div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${clientAnalysis.newPercentage}%` }} /></div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2"><UserCheck className="w-4 h-4 text-green-400" /><span className="text-white text-sm">חוזרים</span><span className="text-white font-bold mr-auto">{clientAnalysis.returning}</span></div>
                <div className="h-2 bg-[#0C0F1D] rounded-full overflow-hidden"><div className="h-full bg-green-400 rounded-full transition-all" style={{ width: `${clientAnalysis.returningPercentage}%` }} /></div>
              </div>
            </div>
          </div>

          <div className="bg-[#1A1F35] rounded-2xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-4"><PieChart className="w-5 h-5 text-[#FF6B35]" /><h3 className="font-bold text-white">הושלם vs בוטל</h3></div>
            <div className="flex items-center gap-4">
              <div className="w-24 h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie><Pie data={statusBreakdown.data} cx="50%" cy="50%" innerRadius={25} outerRadius={40} paddingAngle={2} dataKey="value">{statusBreakdown.data.map((entry, index) => (<Cell key={index} fill={entry.color} />))}</Pie></RechartsPie>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between"><div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /><span className="text-white text-sm">הושלם</span></div><span className="text-white font-bold">{statusBreakdown.completed} ({statusBreakdown.completedPercentage.toFixed(0)}%)</span></div>
                <div className="flex items-center justify-between"><div className="flex items-center gap-2"><XCircle className="w-4 h-4 text-red-500" /><span className="text-white text-sm">בוטל</span></div><span className="text-white font-bold">{statusBreakdown.cancelled} ({statusBreakdown.cancelledPercentage.toFixed(0)}%)</span></div>
              </div>
            </div>
          </div>

          <div className="bg-[#1A1F35] rounded-2xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-4"><Timer className="w-5 h-5 text-[#FF6B35]" /><h3 className="font-bold text-white">תפוסה ויעילות</h3></div>
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-[#0C0F1D] rounded-xl p-3 text-center"><p className="text-2xl font-bold text-white">{100 - deadTime.percentage}%</p><p className="text-[#64748B] text-xs">תפוסה</p></div>
              <div className="bg-[#0C0F1D] rounded-xl p-3 text-center"><p className="text-2xl font-bold text-white">{deadTime.totalHours}</p><p className="text-[#64748B] text-xs">שעות פנויות</p></div>
              <div className="bg-[#0C0F1D] rounded-xl p-3 text-center"><p className="text-2xl font-bold text-yellow-400">{deadTime.emptySlots}</p><p className="text-[#64748B] text-xs">ימים ריקים</p></div>
              <div className="bg-[#0C0F1D] rounded-xl p-3 text-center"><p className="text-2xl font-bold text-orange-400">{deadTime.gaps}</p><p className="text-[#64748B] text-xs">פערים</p></div>
            </div>
            <div className="mt-3 bg-[#0C0F1D] rounded-xl p-3">
              <div className="flex items-center justify-between mb-1"><span className="text-[#94A3B8] text-xs">שיעור תפוסה</span><span className="text-white text-sm font-bold">{100 - deadTime.percentage}%</span></div>
              <div className="h-2 bg-[#1A1F35] rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${100 - deadTime.percentage}%`, background: 'linear-gradient(90deg, #FF6B35, #22C55E)' }} /></div>
            </div>
          </div>

          <div className="bg-[#1A1F35] rounded-2xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-4"><CalendarDays className="w-5 h-5 text-[#FF6B35]" /><h3 className="font-bold text-white">היום הכי עמוס</h3></div>
            <div className="flex items-center gap-4 mb-3"><div className="bg-[#FF6B35]/20 rounded-xl px-4 py-2"><p className="text-[#FF6B35] text-2xl font-bold">{busiestDay.day}</p></div><p className="text-[#94A3B8] text-sm">{busiestDay.count} תורים</p></div>
            <div className="flex gap-1">
              {busiestDay.data.map((day, index) => { const maxBookings = Math.max(...busiestDay.data.map(d => d.bookings)); const height = maxBookings > 0 ? (day.bookings / maxBookings) * 100 : 0; const isBusiest = day.bookings === maxBookings && maxBookings > 0;
                return (<div key={index} className="flex-1 flex flex-col items-center gap-1"><div className="w-full h-16 bg-[#0C0F1D] rounded-lg flex items-end justify-center p-1"><div className={`w-full rounded transition-all ${isBusiest ? 'bg-[#FF6B35]' : 'bg-[#FF6B35]/40'}`} style={{ height: `${Math.max(height, 5)}%` }} /></div><span className="text-[10px] text-[#64748B]">{day.name.charAt(0)}</span></div>);
              })}
            </div>
          </div>

          <div className="bg-[#1A1F35] rounded-2xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-3"><Sparkles className="w-5 h-5 text-[#FF6B35]" /><h3 className="font-bold text-white">תובנות מהירות</h3></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0C0F1D] rounded-xl p-3"><p className="text-[#64748B] text-xs mb-1">שעת שיא</p><p className="text-white font-bold">{peakHour}</p></div>
              <div className="bg-[#0C0F1D] rounded-xl p-3"><p className="text-[#64748B] text-xs mb-1">לקוחות ליום</p><p className="text-white font-bold">{clientsPerDay}</p></div>
              <div className="bg-[#0C0F1D] rounded-xl p-3"><p className="text-[#64748B] text-xs mb-1">ממוצע לתור</p><p className="text-white font-bold">₪{stats.avgBookingValue.toFixed(0)}</p></div>
              <div className="bg-[#0C0F1D] rounded-xl p-3"><p className="text-[#64748B] text-xs mb-1">הכנסה ללקוח</p><p className="text-white font-bold">₪{revenuePerClient.toLocaleString()}</p></div>
              <div className="bg-[#0C0F1D] rounded-xl p-3"><p className="text-[#64748B] text-xs mb-1">משך טיפול ממוצע</p><p className="text-white font-bold">{avgServiceDuration} דק׳</p></div>
              <div className="bg-[#0C0F1D] rounded-xl p-3"><p className="text-[#64748B] text-xs mb-1">מרווח בין ביקורים</p><p className="text-white font-bold">{rebookingInterval > 0 ? `${rebookingInterval} ימים` : '-'}</p></div>
            </div>
          </div>

          <div className="bg-[#1A1F35] rounded-2xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-4"><BarChart3 className="w-5 h-5 text-[#FF6B35]" /><h3 className="font-bold text-white">תורים לפי יום</h3></div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={bookingsByDay.slice(-14)}>
                  <defs><linearGradient id="bookingsGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FF6B35" stopOpacity={0.3} /><stop offset="100%" stopColor="#FF6B35" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="bookings" stroke="#FF6B35" strokeWidth={2} fill="url(#bookingsGradient)" name="תורים" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#1A1F35] rounded-2xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-4"><Clock className="w-5 h-5 text-[#FF6B35]" /><h3 className="font-bold text-white">שעות פעילות</h3></div>
            <div className="flex gap-1.5 overflow-x-auto pb-2">
              {bookingsByHour.map((hour) => { const maxBookings = Math.max(...bookingsByHour.map(h => h.bookings)); const intensity = maxBookings > 0 ? hour.bookings / maxBookings : 0;
                return (<div key={hour.hour} className="flex flex-col items-center gap-1.5 min-w-[32px]"><div className="w-8 h-12 rounded-lg flex items-end justify-center pb-1 text-xs font-medium transition-colors" style={{ backgroundColor: `rgba(255, 107, 53, ${0.1 + intensity * 0.5})`, color: intensity > 0.5 ? 'white' : '#94A3B8' }}>{hour.bookings > 0 && hour.bookings}</div><span className="text-[10px] text-[#64748B]">{hour.shortHour}</span></div>);
              })}
            </div>
          </div>

          {revenueByService.length > 0 && (
            <div className="bg-[#1A1F35] rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-2 mb-4"><DollarSign className="w-5 h-5 text-[#FF6B35]" /><h3 className="font-bold text-white">הכנסות לפי שירות</h3></div>
              <div className="space-y-3">
                {revenueByService.map((service, index) => (
                  <div key={service.name}>
                    <div className="flex items-center justify-between mb-1.5"><span className="text-white text-sm truncate flex-1">{service.name}</span><span className="text-[#FF6B35] text-sm font-bold mr-2">₪{service.revenue.toLocaleString()}</span></div>
                    <div className="h-2 bg-[#0C0F1D] rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${service.percentage}%`, background: index === 0 ? 'linear-gradient(90deg, #FF6B35, #FF1744)' : '#FF6B35', opacity: 1 - (index * 0.15) }} /></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {serviceMix.length > 0 && (
            <div className="bg-[#1A1F35] rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-2 mb-4"><PieChart className="w-5 h-5 text-[#FF6B35]" /><h3 className="font-bold text-white">תמהיל שירותים</h3></div>
              <div className="space-y-3">
                {serviceMix.slice(0, 5).map((service, index) => (
                  <div key={service.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-white text-sm truncate flex-1">{service.name}</span>
                      <span className="text-[#FF6B35] text-sm font-bold mr-2">{service.percentage.toFixed(0)}%</span>
                      <span className="text-[#64748B] text-xs">({service.count})</span>
                    </div>
                    <div className="h-2 bg-[#0C0F1D] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${service.percentage}%`, background: index === 0 ? 'linear-gradient(90deg, #FF6B35, #FF1744)' : '#FF6B35', opacity: 1 - (index * 0.12) }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {servicePopularity.length > 0 && (
            <div className="bg-[#1A1F35] rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-2 mb-4"><Target className="w-5 h-5 text-[#FF6B35]" /><h3 className="font-bold text-white">שירותים פופולריים</h3></div>
              <div className="space-y-3">
                {servicePopularity.map((service, index) => (
                  <div key={service.name}>
                    <div className="flex items-center justify-between mb-1.5"><span className="text-white text-sm truncate flex-1">{service.name}</span><span className="text-[#64748B] text-sm mr-2">{service.count} תורים</span></div>
                    <div className="h-2 bg-[#0C0F1D] rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${service.percentage}%`, background: index === 0 ? 'linear-gradient(90deg, #FF6B35, #FF1744)' : '#FF6B35', opacity: 1 - (index * 0.15) }} /></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-[#1A1F35] rounded-2xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-4"><TrendingUp className="w-5 h-5 text-[#FF6B35]" /><h3 className="font-bold text-white">מגמת הכנסות</h3></div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={bookingsByDay.slice(-14)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} width={40} tickFormatter={(value) => `₪${value}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="revenue" stroke="#FF6B35" strokeWidth={2} dot={false} name="הכנסות" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      <UpgradeModal
        isOpen={showExportUpgrade}
        onClose={() => setShowExportUpgrade(false)}
        feature="dataExport"
        highlightPlan="pro"
      />
    </div>
  );
}

function StatCard({ label, value, change, icon: Icon, invertChange = false }) {
  const isPositive = invertChange ? change < 0 : change > 0;
  const isNegative = invertChange ? change > 0 : change < 0;
  return (
    <div className="bg-[#1A1F35] rounded-xl p-3 border border-white/5">
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-4 h-4 text-[#FF6B35]" />
        {change !== 0 && (<div className={`flex items-center gap-0.5 text-[10px] font-medium ${isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-[#64748B]'}`}>{isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{Math.abs(change).toFixed(0)}%</div>)}
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-[10px] text-[#64748B] mt-0.5">{label}</p>
    </div>
  );
}