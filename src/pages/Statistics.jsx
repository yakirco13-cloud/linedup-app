import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useUser } from "@/components/UserContext";
import { useQuery } from "@tanstack/react-query";
import { 
  Calendar, TrendingUp, TrendingDown, Users, DollarSign, 
  XCircle, Clock, ArrowRight, Loader2, BarChart3, PieChart,
  Sparkles, Target
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, subDays, subWeeks, subMonths,
  eachDayOfInterval, isWithinInterval
} from "date-fns";
import { he } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Area, AreaChart
} from "recharts";

export default function Statistics() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [timeRange, setTimeRange] = useState('month');

  // Fetch business
  const { data: business, isLoading: businessLoading, error: businessError } = useQuery({
    queryKey: ['business', user?.business_id],
    queryFn: async () => {
      const businesses = await base44.entities.Business.filter({ id: user.business_id });
      return businesses[0];
    },
    enabled: !!user?.business_id,
  });

  // No business state
  if (!user?.business_id) {
    return (
      <div className="min-h-screen bg-[#0C0F1D] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1A1F35] flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8 text-[#FF6B35]" />
          </div>
          <p className="text-white font-medium mb-2">לא נמצא עסק</p>
          <p className="text-[#64748B] text-sm mb-6">יש להגדיר עסק כדי לצפות בסטטיסטיקות</p>
          <Button 
            onClick={() => navigate(createPageUrl("BusinessDashboard"))}
            style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
            className="rounded-xl"
          >
            חזור לדשבורד
          </Button>
        </div>
      </div>
    );
  }

  // Loading state
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

  // Error state
  if (businessError) {
    return (
      <div className="min-h-screen bg-[#0C0F1D] flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-400 mb-4">שגיאה בטעינת נתונים</p>
          <Button onClick={() => navigate(createPageUrl("BusinessDashboard"))}>
            חזור לדשבורד
          </Button>
        </div>
      </div>
    );
  }

  // Main content component (after business is loaded)
  return <StatisticsContent business={business} timeRange={timeRange} setTimeRange={setTimeRange} navigate={navigate} />;
}

function StatisticsContent({ business, timeRange, setTimeRange, navigate }) {
  // Fetch all bookings
  const { data: allBookings = [], isLoading } = useQuery({
    queryKey: ['statistics-bookings', business?.id],
    queryFn: async () => {
      const bookings = await base44.entities.Booking.filter(
        { business_id: business.id },
        '-date',
        2000
      );
      return bookings;
    },
    enabled: !!business?.id,
  });

  // Fetch services
  const { data: services = [] } = useQuery({
    queryKey: ['services', business?.id],
    queryFn: () => base44.entities.Service.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });

  // Calculate date ranges
  const dateRanges = useMemo(() => {
    const now = new Date();
    let currentStart, currentEnd, previousStart, previousEnd;

    switch (timeRange) {
      case 'today':
        currentStart = startOfDay(now);
        currentEnd = endOfDay(now);
        previousStart = startOfDay(subDays(now, 1));
        previousEnd = endOfDay(subDays(now, 1));
        break;
      case 'week':
        currentStart = startOfWeek(now, { weekStartsOn: 0 });
        currentEnd = endOfWeek(now, { weekStartsOn: 0 });
        previousStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 0 });
        previousEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 0 });
        break;
      case 'month':
      default:
        currentStart = startOfMonth(now);
        currentEnd = endOfMonth(now);
        previousStart = startOfMonth(subMonths(now, 1));
        previousEnd = endOfMonth(subMonths(now, 1));
        break;
    }

    return { currentStart, currentEnd, previousStart, previousEnd };
  }, [timeRange]);

  // Filter bookings by range
  const filterBookingsByRange = (bookings, start, end) => {
    return bookings.filter(booking => {
      const bookingDate = parseISO(booking.date);
      return isWithinInterval(bookingDate, { start, end });
    });
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const { currentStart, currentEnd, previousStart, previousEnd } = dateRanges;
    
    const currentBookings = filterBookingsByRange(allBookings, currentStart, currentEnd);
    const previousBookings = filterBookingsByRange(allBookings, previousStart, previousEnd);

    const currentConfirmed = currentBookings.filter(b => 
      b.status === 'confirmed' || b.status === 'completed'
    );
    const previousConfirmed = previousBookings.filter(b => 
      b.status === 'confirmed' || b.status === 'completed'
    );

    const currentCancelled = currentBookings.filter(b => b.status === 'cancelled');
    const previousCancelled = previousBookings.filter(b => b.status === 'cancelled');

    const calculateRevenue = (bookings) => {
      return bookings.reduce((sum, booking) => {
        const service = services.find(s => s.id === booking.service_id);
        return sum + (service?.price || 0);
      }, 0);
    };

    const currentRevenue = calculateRevenue(currentConfirmed);
    const previousRevenue = calculateRevenue(previousConfirmed);

    const currentClients = new Set(currentConfirmed.map(b => b.client_phone)).size;
    const previousClients = new Set(previousConfirmed.map(b => b.client_phone)).size;

    const currentCancellationRate = currentBookings.length > 0 
      ? (currentCancelled.length / currentBookings.length) * 100 
      : 0;
    const previousCancellationRate = previousBookings.length > 0 
      ? (previousCancelled.length / previousBookings.length) * 100 
      : 0;

    const calcChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    // Average booking value
    const avgBookingValue = currentConfirmed.length > 0 
      ? currentRevenue / currentConfirmed.length 
      : 0;

    return {
      bookings: {
        current: currentConfirmed.length,
        previous: previousConfirmed.length,
        change: calcChange(currentConfirmed.length, previousConfirmed.length)
      },
      revenue: {
        current: currentRevenue,
        previous: previousRevenue,
        change: calcChange(currentRevenue, previousRevenue)
      },
      clients: {
        current: currentClients,
        previous: previousClients,
        change: calcChange(currentClients, previousClients)
      },
      cancellations: {
        current: currentCancellationRate,
        previous: previousCancellationRate,
        change: calcChange(currentCancellationRate, previousCancellationRate)
      },
      avgBookingValue
    };
  }, [allBookings, dateRanges, services]);

  // Bookings by day
  const bookingsByDay = useMemo(() => {
    const { currentStart } = dateRanges;
    const days = eachDayOfInterval({ start: currentStart, end: new Date() });
    
    return days.map(day => {
      const dayBookings = allBookings.filter(b => {
        const bookingDate = parseISO(b.date);
        return format(bookingDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd') &&
          (b.status === 'confirmed' || b.status === 'completed');
      });

      const revenue = dayBookings.reduce((sum, b) => {
        const service = services.find(s => s.id === b.service_id);
        return sum + (service?.price || 0);
      }, 0);

      return {
        date: format(day, 'd', { locale: he }),
        fullDate: format(day, 'dd/MM', { locale: he }),
        day: format(day, 'EEEEEE', { locale: he }),
        bookings: dayBookings.length,
        revenue
      };
    });
  }, [allBookings, dateRanges, services]);

  // Bookings by hour
  const bookingsByHour = useMemo(() => {
    const hours = Array.from({ length: 12 }, (_, i) => i + 8);
    
    return hours.map(hour => {
      const hourBookings = allBookings.filter(b => {
        if (!b.time) return false;
        const bookingHour = parseInt(b.time.split(':')[0]);
        return bookingHour === hour && 
          (b.status === 'confirmed' || b.status === 'completed');
      });

      return {
        hour: `${hour}:00`,
        shortHour: `${hour}`,
        bookings: hourBookings.length
      };
    });
  }, [allBookings]);

  // Services popularity (for horizontal bars)
  const servicePopularity = useMemo(() => {
    const serviceCounts = {};
    const maxCount = { value: 0 };
    
    allBookings
      .filter(b => b.status === 'confirmed' || b.status === 'completed')
      .forEach(booking => {
        const serviceName = booking.service_name || 'אחר';
        serviceCounts[serviceName] = (serviceCounts[serviceName] || 0) + 1;
        if (serviceCounts[serviceName] > maxCount.value) {
          maxCount.value = serviceCounts[serviceName];
        }
      });

    return Object.entries(serviceCounts)
      .map(([name, count]) => ({ 
        name, 
        count, 
        percentage: maxCount.value > 0 ? (count / maxCount.value) * 100 : 0 
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [allBookings]);

  // Peak hour
  const peakHour = useMemo(() => {
    const sorted = [...bookingsByHour].sort((a, b) => b.bookings - a.bookings);
    return sorted[0]?.hour || '-';
  }, [bookingsByHour]);

  const timeRangeLabels = {
    today: 'היום',
    week: 'השבוע',
    month: 'החודש'
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1A1F35] border border-white/10 rounded-lg p-3 shadow-xl">
          <p className="text-white font-medium text-sm">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-[#94A3B8] text-sm">
              {entry.name}: {entry.value.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0C0F1D] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF6B35]" />
      </div>
    );
  }

  const hasData = allBookings.length > 0;

  return (
    <div className="min-h-screen bg-[#0C0F1D] pb-24">
      {/* Header */}
      <div className="bg-[#0C0F1D] border-b border-white/5 px-5 pt-14 pb-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate(createPageUrl("BusinessDashboard"))}
            className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-xl transition-colors"
          >
            <ArrowRight className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-xl font-bold text-white">סטטיסטיקות</h1>
          <div className="w-10" />
        </div>

        {/* Time Range Tabs */}
        <div className="flex gap-2 bg-[#1A1F35] p-1 rounded-xl">
          {Object.entries(timeRangeLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTimeRange(key)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                timeRange === key
                  ? 'bg-[#FF6B35] text-white'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        // Empty State
        <div className="flex flex-col items-center justify-center px-6 py-20">
          <div className="w-20 h-20 rounded-2xl bg-[#1A1F35] flex items-center justify-center mb-4">
            <BarChart3 className="w-10 h-10 text-[#64748B]" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">אין נתונים עדיין</h2>
          <p className="text-[#64748B] text-center">
            הסטטיסטיקות יופיעו כאן לאחר שיהיו תורים במערכת
          </p>
        </div>
      ) : (
        <div className="px-5 py-6 space-y-5">
          
          {/* Hero Revenue Card */}
          <div 
            className="rounded-2xl p-5 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #FF1744 100%)' }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-5 h-5 text-white/80" />
                <span className="text-white/80 text-sm">הכנסות {timeRangeLabels[timeRange]}</span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold text-white">
                  ₪{stats.revenue.current.toLocaleString()}
                </span>
                {stats.revenue.change !== 0 && (
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                    stats.revenue.change > 0 ? 'bg-white/20 text-white' : 'bg-black/20 text-white'
                  }`}>
                    {stats.revenue.change > 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {Math.abs(stats.revenue.change).toFixed(0)}%
                  </div>
                )}
              </div>
              <p className="text-white/60 text-sm mt-2">
                ממוצע לתור: ₪{stats.avgBookingValue.toFixed(0)}
              </p>
            </div>
          </div>

          {/* Secondary Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              label="תורים"
              value={stats.bookings.current}
              change={stats.bookings.change}
              icon={Calendar}
            />
            <StatCard
              label="לקוחות"
              value={stats.clients.current}
              change={stats.clients.change}
              icon={Users}
            />
            <StatCard
              label="ביטולים"
              value={`${stats.cancellations.current.toFixed(0)}%`}
              change={stats.cancellations.change}
              icon={XCircle}
              invertChange
            />
          </div>

          {/* Quick Insights */}
          <div className="bg-[#1A1F35] rounded-2xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-[#FF6B35]" />
              <h3 className="font-bold text-white">תובנות מהירות</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0C0F1D] rounded-xl p-3">
                <p className="text-[#64748B] text-xs mb-1">שעת שיא</p>
                <p className="text-white font-bold">{peakHour}</p>
              </div>
              <div className="bg-[#0C0F1D] rounded-xl p-3">
                <p className="text-[#64748B] text-xs mb-1">ממוצע יומי</p>
                <p className="text-white font-bold">
                  {bookingsByDay.length > 0 
                    ? (stats.bookings.current / Math.max(bookingsByDay.length, 1)).toFixed(1) 
                    : '0'
                  } תורים
                </p>
              </div>
            </div>
          </div>

          {/* Bookings Chart */}
          <div className="bg-[#1A1F35] rounded-2xl p-4 border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#FF6B35]" />
                <h3 className="font-bold text-white">תורים לפי יום</h3>
              </div>
            </div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={bookingsByDay.slice(-14)}>
                  <defs>
                    <linearGradient id="bookingsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF6B35" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#FF6B35" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: '#64748B', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fill: '#64748B', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="bookings" 
                    stroke="#FF6B35" 
                    strokeWidth={2}
                    fill="url(#bookingsGradient)"
                    name="תורים"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Hours Heatmap */}
          <div className="bg-[#1A1F35] rounded-2xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-[#FF6B35]" />
              <h3 className="font-bold text-white">שעות פעילות</h3>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-2">
              {bookingsByHour.map((hour, index) => {
                const maxBookings = Math.max(...bookingsByHour.map(h => h.bookings));
                const intensity = maxBookings > 0 ? hour.bookings / maxBookings : 0;
                
                return (
                  <div key={hour.hour} className="flex flex-col items-center gap-1.5 min-w-[32px]">
                    <div 
                      className="w-8 h-12 rounded-lg flex items-end justify-center pb-1 text-xs font-medium transition-colors"
                      style={{ 
                        backgroundColor: `rgba(255, 107, 53, ${0.1 + intensity * 0.5})`,
                        color: intensity > 0.5 ? 'white' : '#94A3B8'
                      }}
                    >
                      {hour.bookings > 0 && hour.bookings}
                    </div>
                    <span className="text-[10px] text-[#64748B]">{hour.shortHour}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Popular Services - Horizontal Bars */}
          {servicePopularity.length > 0 && (
            <div className="bg-[#1A1F35] rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-[#FF6B35]" />
                <h3 className="font-bold text-white">שירותים פופולריים</h3>
              </div>
              <div className="space-y-3">
                {servicePopularity.map((service, index) => (
                  <div key={service.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-white text-sm truncate flex-1">{service.name}</span>
                      <span className="text-[#64748B] text-sm mr-2">{service.count}</span>
                    </div>
                    <div className="h-2 bg-[#0C0F1D] rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ 
                          width: `${service.percentage}%`,
                          background: index === 0 
                            ? 'linear-gradient(90deg, #FF6B35, #FF1744)' 
                            : '#FF6B35',
                          opacity: 1 - (index * 0.15)
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Revenue Chart */}
          <div className="bg-[#1A1F35] rounded-2xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-[#FF6B35]" />
              <h3 className="font-bold text-white">מגמת הכנסות</h3>
            </div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={bookingsByDay.slice(-14)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: '#64748B', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fill: '#64748B', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                    tickFormatter={(value) => `₪${value}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#FF6B35" 
                    strokeWidth={2}
                    dot={false}
                    name="הכנסות"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

// Stat Card Component
function StatCard({ label, value, change, icon: Icon, invertChange = false }) {
  const isPositive = invertChange ? change < 0 : change > 0;
  const isNegative = invertChange ? change > 0 : change < 0;
  
  return (
    <div className="bg-[#1A1F35] rounded-xl p-3 border border-white/5">
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-4 h-4 text-[#FF6B35]" />
        {change !== 0 && (
          <div className={`flex items-center gap-0.5 text-[10px] font-medium ${
            isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-[#64748B]'
          }`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(change).toFixed(0)}%
          </div>
        )}
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-[10px] text-[#64748B] mt-0.5">{label}</p>
    </div>
  );
}