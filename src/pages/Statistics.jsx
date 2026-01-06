import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useUser } from "@/components/UserContext";
import { useQuery } from "@tanstack/react-query";
import { 
  Calendar, TrendingUp, TrendingDown, Users, DollarSign, 
  XCircle, Clock, ArrowRight, Loader2, BarChart3, PieChart,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, subDays, subWeeks, subMonths,
  eachDayOfInterval, eachHourOfInterval, isWithinInterval,
  differenceInDays
} from "date-fns";
import { he } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart as RechartsPie, Pie, Cell, Legend
} from "recharts";

const COLORS = ['#FF6B35', '#FF8555', '#FFB088', '#FFD4BB', '#94A3B8', '#64748B'];

export default function Statistics() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [timeRange, setTimeRange] = useState('month'); // 'today', 'week', 'month'
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);

  console.log('📊 Statistics - user:', user);
  console.log('📊 Statistics - business_id:', user?.business_id);

  // Fetch business
  const { data: business, isLoading: businessLoading, error: businessError } = useQuery({
    queryKey: ['business', user?.business_id],
    queryFn: async () => {
      console.log('📊 Fetching business...');
      const businesses = await base44.entities.Business.filter({ id: user.business_id });
      console.log('📊 Business result:', businesses);
      return businesses[0];
    },
    enabled: !!user?.business_id,
  });

  // Show message if no business_id
  if (!user?.business_id) {
    return (
      <div className="min-h-screen bg-[#0C0F1D] flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-[#94A3B8] mb-4">לא נמצא עסק</p>
          <Button onClick={() => navigate(createPageUrl("BusinessDashboard"))}>
            חזור לדשבורד
          </Button>
        </div>
      </div>
    );
  }

  // Show loading while fetching business
  if (businessLoading) {
    return (
      <div className="min-h-screen bg-[#0C0F1D] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF6B35]" />
      </div>
    );
  }

  // Show error if business fetch failed
  if (businessError) {
    return (
      <div className="min-h-screen bg-[#0C0F1D] flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-400 mb-4">שגיאה בטעינת נתוני העסק</p>
          <p className="text-[#94A3B8] text-sm mb-4">{businessError.message}</p>
          <Button onClick={() => navigate(createPageUrl("BusinessDashboard"))}>
            חזור לדשבורד
          </Button>
        </div>
      </div>
    );
  }

  // Fetch all bookings for statistics (last 60 days for comparison)
  const { data: allBookings = [], isLoading } = useQuery({
    queryKey: ['statistics-bookings', business?.id],
    queryFn: async () => {
      const sixtyDaysAgo = format(subDays(new Date(), 60), 'yyyy-MM-dd');
      const bookings = await base44.entities.Booking.filter(
        { business_id: business.id },
        '-date',
        2000
      );
      return bookings;
    },
    enabled: !!business?.id,
  });

  // Fetch services for names and prices
  const { data: services = [] } = useQuery({
    queryKey: ['services', business?.id],
    queryFn: () => base44.entities.Service.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });

  // Calculate date ranges based on selected time range
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

  // Filter bookings by date range
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

    // Confirmed/completed bookings only
    const currentConfirmed = currentBookings.filter(b => 
      b.status === 'confirmed' || b.status === 'completed'
    );
    const previousConfirmed = previousBookings.filter(b => 
      b.status === 'confirmed' || b.status === 'completed'
    );

    // Cancelled bookings
    const currentCancelled = currentBookings.filter(b => b.status === 'cancelled');
    const previousCancelled = previousBookings.filter(b => b.status === 'cancelled');

    // Calculate revenue
    const calculateRevenue = (bookings) => {
      return bookings.reduce((sum, booking) => {
        const service = services.find(s => s.id === booking.service_id);
        return sum + (service?.price || 0);
      }, 0);
    };

    const currentRevenue = calculateRevenue(currentConfirmed);
    const previousRevenue = calculateRevenue(previousConfirmed);

    // Unique clients
    const currentClients = new Set(currentConfirmed.map(b => b.client_phone)).size;
    const previousClients = new Set(previousConfirmed.map(b => b.client_phone)).size;

    // New clients (first booking ever)
    const allClientPhones = new Set(allBookings.map(b => b.client_phone));
    const newClients = currentConfirmed.filter(b => {
      const clientBookings = allBookings.filter(ab => ab.client_phone === b.client_phone);
      const firstBooking = clientBookings.sort((a, b) => 
        new Date(a.created_at) - new Date(b.created_at)
      )[0];
      return firstBooking?.id === b.id;
    }).length;

    // Cancellation rate
    const currentCancellationRate = currentBookings.length > 0 
      ? (currentCancelled.length / currentBookings.length) * 100 
      : 0;
    const previousCancellationRate = previousBookings.length > 0 
      ? (previousCancelled.length / previousBookings.length) * 100 
      : 0;

    // Calculate percentage change
    const calcChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

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
        change: calcChange(currentClients, previousClients),
        new: newClients
      },
      cancellations: {
        current: currentCancellationRate,
        previous: previousCancellationRate,
        change: calcChange(currentCancellationRate, previousCancellationRate)
      }
    };
  }, [allBookings, dateRanges, services]);

  // Bookings by day chart data
  const bookingsByDay = useMemo(() => {
    const { currentStart, currentEnd } = dateRanges;
    const days = eachDayOfInterval({ start: currentStart, end: new Date() });
    
    return days.map(day => {
      const dayBookings = allBookings.filter(b => {
        const bookingDate = parseISO(b.date);
        return format(bookingDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd') &&
          (b.status === 'confirmed' || b.status === 'completed');
      });

      return {
        date: format(day, 'dd/MM', { locale: he }),
        day: format(day, 'EEEEEE', { locale: he }),
        bookings: dayBookings.length,
        revenue: dayBookings.reduce((sum, b) => {
          const service = services.find(s => s.id === b.service_id);
          return sum + (service?.price || 0);
        }, 0)
      };
    });
  }, [allBookings, dateRanges, services]);

  // Bookings by hour chart data
  const bookingsByHour = useMemo(() => {
    const hours = Array.from({ length: 12 }, (_, i) => i + 8); // 8:00 - 19:00
    
    return hours.map(hour => {
      const hourBookings = allBookings.filter(b => {
        if (!b.time) return false;
        const bookingHour = parseInt(b.time.split(':')[0]);
        return bookingHour === hour && 
          (b.status === 'confirmed' || b.status === 'completed');
      });

      return {
        hour: `${hour}:00`,
        bookings: hourBookings.length
      };
    });
  }, [allBookings]);

  // Services popularity chart data
  // Services popularity chart data - now includes colors
  const servicePopularity = useMemo(() => {
    const serviceCounts = {};
    
    allBookings
      .filter(b => b.status === 'confirmed' || b.status === 'completed')
      .forEach(booking => {
        const serviceName = booking.service_name || 'אחר';
        if (!serviceCounts[serviceName]) {
          // Find the service to get its color
          const service = services.find(s => s.name === serviceName || s.id === booking.service_id);
          serviceCounts[serviceName] = {
            count: 0,
            color: service?.color || '#94A3B8'
          };
        }
        serviceCounts[serviceName].count += 1;
      });

    return Object.entries(serviceCounts)
      .map(([name, data]) => ({ name, value: data.count, color: data.color }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [allBookings, services]);

  // Revenue over time chart data
  const revenueOverTime = useMemo(() => {
    const { currentStart } = dateRanges;
    const days = eachDayOfInterval({ start: currentStart, end: new Date() });
    
    let cumulative = 0;
    return days.map(day => {
      const dayBookings = allBookings.filter(b => {
        const bookingDate = parseISO(b.date);
        return format(bookingDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd') &&
          (b.status === 'confirmed' || b.status === 'completed');
      });

      const dayRevenue = dayBookings.reduce((sum, b) => {
        const service = services.find(s => s.id === b.service_id);
        return sum + (service?.price || 0);
      }, 0);

      cumulative += dayRevenue;

      return {
        date: format(day, 'dd/MM', { locale: he }),
        revenue: dayRevenue,
        cumulative
      };
    });
  }, [allBookings, dateRanges, services]);

  const timeRangeLabels = {
    today: 'היום',
    week: 'השבוע',
    month: 'החודש'
  };

  const StatCard = ({ title, value, change, icon: Icon, prefix = '', suffix = '', invertChange = false }) => {
    const isPositive = invertChange ? change < 0 : change > 0;
    const isNegative = invertChange ? change > 0 : change < 0;
    
    return (
      <div className="bg-[#1A1F35] rounded-2xl p-4 border border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <Icon className="w-5 h-5 text-[#FF6B35]" />
          {change !== 0 && (
            <div className={`flex items-center gap-1 text-xs font-medium ${
              isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-gray-400'
            }`}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(change).toFixed(0)}%
            </div>
          )}
        </div>
        <p className="text-2xl font-bold mb-1">
          {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
        </p>
        <p className="text-xs text-[#94A3B8]">{title}</p>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0C0F1D] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF6B35]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0C0F1D] pb-24">
      {/* Header */}
      <div className="sticky top-0 bg-[#0C0F1D]/95 backdrop-blur-sm border-b border-gray-800 z-10 px-6 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(createPageUrl("BusinessDashboard"))}
            className="p-2 hover:bg-[#1A1F35] rounded-lg transition-colors"
          >
            <ArrowRight className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">סטטיסטיקות ודוחות</h1>
          
          {/* Time Range Selector */}
          <div className="relative">
            <button
              onClick={() => setShowTimeDropdown(!showTimeDropdown)}
              className="flex items-center gap-1 px-3 py-2 bg-[#1A1F35] rounded-lg text-sm"
            >
              {timeRangeLabels[timeRange]}
              <ChevronDown className="w-4 h-4" />
            </button>
            
            {showTimeDropdown && (
              <div className="absolute left-0 top-full mt-1 bg-[#1A1F35] rounded-lg border border-gray-700 overflow-hidden z-20">
                {Object.entries(timeRangeLabels).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setTimeRange(key);
                      setShowTimeDropdown(false);
                    }}
                    className={`block w-full px-4 py-2 text-sm text-right hover:bg-[#FF6B35]/10 ${
                      timeRange === key ? 'bg-[#FF6B35]/20 text-[#FF6B35]' : ''
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            title={`תורים ${timeRangeLabels[timeRange]}`}
            value={stats.bookings.current}
            change={stats.bookings.change}
            icon={Calendar}
          />
          <StatCard
            title={`הכנסות ${timeRangeLabels[timeRange]}`}
            value={stats.revenue.current}
            change={stats.revenue.change}
            icon={DollarSign}
            prefix="₪"
          />
          <StatCard
            title="לקוחות"
            value={stats.clients.current}
            change={stats.clients.change}
            icon={Users}
            suffix={stats.clients.new > 0 ? ` (${stats.clients.new} חדשים)` : ''}
          />
          <StatCard
            title="שיעור ביטולים"
            value={stats.cancellations.current.toFixed(1)}
            change={stats.cancellations.change}
            icon={XCircle}
            suffix="%"
            invertChange={true}
          />
        </div>

        {/* Bookings by Day Chart */}
        <div className="bg-[#1A1F35] rounded-2xl p-4 border border-gray-800">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-[#FF6B35]" />
            <h3 className="font-bold">תורים לפי יום</h3>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bookingsByDay.slice(-14)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: '#94A3B8', fontSize: 10 }}
                  interval={timeRange === 'month' ? 2 : 0}
                />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1A1F35', 
                    border: '1px solid #374151',
                    borderRadius: '8px'
                  }}
                  labelStyle={{ color: '#fff' }}
                />
                <Bar dataKey="bookings" fill="#FF6B35" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Busiest Hours Chart */}
        <div className="bg-[#1A1F35] rounded-2xl p-4 border border-gray-800">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-[#FF6B35]" />
            <h3 className="font-bold">שעות עמוסות</h3>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bookingsByHour}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="hour" 
                  tick={{ fill: '#94A3B8', fontSize: 10 }}
                />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1A1F35', 
                    border: '1px solid #374151',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="bookings" fill="#FFB088" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Services Popularity */}
        {servicePopularity.length > 0 && (
          <div className="bg-[#1A1F35] rounded-2xl p-4 border border-gray-800">
            <div className="flex items-center gap-2 mb-4">
              <PieChart className="w-5 h-5 text-[#FF6B35]" />
              <h3 className="font-bold">שירותים פופולריים</h3>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={servicePopularity}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {servicePopularity.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1A1F35', 
                      border: '1px solid #374151',
                      borderRadius: '8px'
                    }}
                  />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-2 mt-2 justify-center">
              {servicePopularity.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-1 text-xs">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: entry.color || COLORS[index % COLORS.length] }}
                  />
                  <span className="text-[#94A3B8]">{entry.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Revenue Over Time */}
        <div className="bg-[#1A1F35] rounded-2xl p-4 border border-gray-800">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-[#FF6B35]" />
            <h3 className="font-bold">הכנסות לאורך זמן</h3>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: '#94A3B8', fontSize: 10 }}
                  interval={timeRange === 'month' ? 4 : 0}
                />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1A1F35', 
                    border: '1px solid #374151',
                    borderRadius: '8px'
                  }}
                  formatter={(value) => [`₪${value}`, '']}
                />
                <Line 
                  type="monotone" 
                  dataKey="cumulative" 
                  stroke="#FF6B35" 
                  strokeWidth={2}
                  dot={false}
                  name="הכנסות מצטברות"
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#FFB088" 
                  strokeWidth={2}
                  dot={false}
                  name="הכנסות יומיות"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-gradient-to-r from-[#FF6B35]/20 to-[#FF1744]/20 rounded-2xl p-4 border border-[#FF6B35]/30">
          <h3 className="font-bold mb-2">סיכום {timeRangeLabels[timeRange]}</h3>
          <p className="text-sm text-[#94A3B8]">
            {stats.bookings.current} תורים • ₪{stats.revenue.current.toLocaleString()} הכנסות • {stats.clients.current} לקוחות
          </p>
        </div>
      </div>
    </div>
  );
}
