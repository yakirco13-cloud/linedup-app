import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl, formatTime } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useUser } from "@/components/UserContext";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Plus, Home, X, Edit, Trash2, Calendar, Clock, Scissors, Bell, RefreshCw, Settings2 } from "lucide-react";
import NotificationDropdown from "../components/NotificationDropdown";
import ScheduleOverrideModal from "../components/ScheduleOverrideModal";
import { Button } from "@/components/ui/button";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay, isToday, parseISO, addDays } from "date-fns";
import { he } from "date-fns/locale";
import { toast } from "sonner";

// Drag and drop
import { DndContext, useDraggable, useSensor, useSensors, PointerSensor, TouchSensor } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

// Import centralized services
import { sendCancellation, sendUpdate } from "@/services/whatsappService";
import { notifyWaitingListForOpenedSlot } from "@/services/waitingListService";
import { toISO, parseDate, getDayKey, formatNumeric } from "@/services/dateService";
import { isSlotAvailable } from "@/services/availabilityService";
import { positionToMinutes, snapToInterval, minutesToTime, positionToColumnIndex, columnIndexToDate, timeToPosition } from "@/utils/calendarDragUtils";

export default function CalendarView() {
  const navigate = useNavigate();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Swipe handling state
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);
  const [isSwipingHorizontally, setIsSwipingHorizontally] = useState(false);
  
  // Animation state
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Schedule override state
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [selectedOverrideDate, setSelectedOverrideDate] = useState(null);
  const [editingOverride, setEditingOverride] = useState(null);

  // Drag and drop state
  const [activeBooking, setActiveBooking] = useState(null);
  const [dropPreview, setDropPreview] = useState(null); // { date, time, hasConflict }
  const [originalPosition, setOriginalPosition] = useState(null); // { date, time } - where booking was before drag
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 }); // Offset from pointer to booking top-left
  const calendarGridRef = useRef(null);

  // Reschedule confirmation state
  const [pendingReschedule, setPendingReschedule] = useState(null); // { booking, oldDate, oldTime, newDate, newTime }

  // Configure drag sensors with activation constraints
  // - PointerSensor: requires 8px movement to start drag (prevents accidental drags)
  // - TouchSensor: 200ms delay before drag starts (allows quick swipes for navigation)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    })
  );

  const minSwipeDistance = 50;

  const { data: business } = useQuery({
    queryKey: ['business', user?.business_id],
    queryFn: async () => {
      const businesses = await base44.entities.Business.filter({ id: user.business_id });
      return businesses[0];
    },
    enabled: !!user?.business_id,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  // Fetch services for colors
  const { data: services = [] } = useQuery({
    queryKey: ['services', business?.id],
    queryFn: () => base44.entities.Service.filter({ business_id: business.id }),
    enabled: !!business?.id,
    staleTime: 10 * 60 * 1000,
  });

  // Fetch staff for schedule overrides
  const { data: staffList = [] } = useQuery({
    queryKey: ['staff', business?.id],
    queryFn: () => base44.entities.Staff.filter({ business_id: business.id }),
    enabled: !!business?.id,
    staleTime: 10 * 60 * 1000,
  });

  // Fetch schedule overrides (with error handling in case table doesn't exist yet)
  const { data: scheduleOverrides = [] } = useQuery({
    queryKey: ['schedule-overrides', business?.id],
    queryFn: async () => {
      try {
        return await base44.entities.ScheduleOverride.filter({ business_id: business.id });
      } catch (error) {
        console.warn('Schedule overrides table may not exist yet:', error);
        return [];
      }
    },
    enabled: !!business?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Helper to get service color
  const getServiceColor = (serviceId, serviceName) => {
    const service = services.find(s => s.id === serviceId || s.name === serviceName);
    return service?.color || '#FF6B35';
  };

  const { data: bookings = [], isLoading, refetch: refetchBookings } = useQuery({
    queryKey: ['bookings', business?.id],
    queryFn: async () => {
      // Calculate date range: 30 days ago to far future
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const pastDateStr = format(thirtyDaysAgo, 'yyyy-MM-dd');
      
      // Fetch ALL bookings (no limit), we'll filter by date client-side
      const allBookings = await base44.entities.Booking.filter(
        { business_id: business.id },
        '-date',
        1000
      );

      // Filter: only confirmed/pending AND (future OR last 30 days)
      return allBookings.filter(b => {
        // Status filter
        if (b.status !== 'confirmed' && b.status !== 'pending_approval') {
          return false;
        }
        
        // Date filter: include all future dates + last 30 days
        const bookingDateStr = toISO(b.date);
        return bookingDateStr >= pastDateStr;
      });
    },
    enabled: !!business?.id,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });

  // Fetch notifications for the bell icon
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', business?.id],
    queryFn: () => base44.entities.Notification.filter({ business_id: business.id }, '-created_at', 10),
    enabled: !!business?.id,
    staleTime: 10 * 1000,
    refetchInterval: 10000,
  });

  // Calculate unread count for badge
  const unreadCount = notifications.filter(n => !n.is_read).length;

  const cancelMutation = useMutation({
    mutationFn: async (booking) => {
      await base44.entities.Booking.update(booking.id, { status: 'cancelled' });
      return booking;
    },
    onSuccess: async (booking) => {
      // Send WhatsApp cancellation notification if client has phone
      if (booking.client_phone && !booking.client_email?.includes('walkin_')) {
        await sendCancellation({
          phone: booking.client_phone,
          clientName: booking.client_name,
          businessName: business?.name || 'העסק',
          date: booking.date,
          time: booking.time,
          businessId: business?.id
        });
      }
      
      // Notify waiting list that a slot opened up (only if booking time hasn't passed)
      try {
        const bookingDate = parseDate(booking.date);
        if (bookingDate) {
          const [hours, minutes] = booking.time.split(':').map(Number);
          bookingDate.setHours(hours, minutes, 0, 0);
          
          if (bookingDate >= new Date()) {
            // Calculate the end time of the freed slot
            const cancelledDuration = booking.duration || 30;
            const [h, m] = booking.time.split(':').map(Number);
            const endMinutes = h * 60 + m + cancelledDuration;
            const endH = Math.floor(endMinutes / 60);
            const endM = endMinutes % 60;
            const endTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
            
            await notifyWaitingListForOpenedSlot({
              businessId: booking.business_id,
              date: booking.date,
              startTime: booking.time,
              endTime
            });
          } else {
            console.log('⏭️ Booking time has passed, skipping waiting list notification');
          }
        }
      } catch (error) {
        console.error('❌ Error notifying waiting list:', error);
      }
      
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setSelectedBooking(null);
    },
  });

  // Reschedule booking mutation (for drag and drop)
  const rescheduleMutation = useMutation({
    mutationFn: async ({ bookingId, newDate, newTime }) => {
      return base44.entities.Booking.update(bookingId, {
        date: newDate,
        time: newTime,
      });
    },
    onMutate: async ({ bookingId, newDate, newTime }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['bookings'] });

      // Snapshot previous value for rollback
      const previousBookings = queryClient.getQueryData(['bookings', business?.id]);

      // Optimistically update the cache
      queryClient.setQueryData(['bookings', business?.id], (old) => {
        if (!old) return old;
        return old.map(booking =>
          booking.id === bookingId
            ? { ...booking, date: newDate, time: newTime }
            : booking
        );
      });

      return { previousBookings };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousBookings) {
        queryClient.setQueryData(['bookings', business?.id], context.previousBookings);
      }
      toast.error('שגיאה בהעברת התור');
    },
    onSettled: () => {
      // Refetch to ensure sync
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
    onSuccess: (updatedBooking, { newDate, newTime }) => {
      toast.success(`התור הועבר ל-${formatNumeric(newDate)} בשעה ${newTime}`);
    },
  });

  // Schedule Override Mutations
  const createOverrideMutation = useMutation({
    mutationFn: (data) => base44.entities.ScheduleOverride.create({
      ...data,
      business_id: business.id
    }),
    onSuccess: async (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['schedule-overrides'] });
      setShowOverrideModal(false);
      setSelectedOverrideDate(null);
      setEditingOverride(null);
      
      // Check if this override OPENS availability (not a day off and has shifts)
      if (!variables.is_day_off && variables.shifts && variables.shifts.length > 0) {
        const firstShift = variables.shifts[0];
        const lastShift = variables.shifts[variables.shifts.length - 1];
        await notifyWaitingListForOpenedSlot({
          businessId: business.id,
          date: variables.date,
          startTime: firstShift.start,
          endTime: lastShift.end
        });
      }
    },
  });

  const updateOverrideMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ScheduleOverride.update(id, data),
    onSuccess: async (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['schedule-overrides'] });
      setShowOverrideModal(false);
      setSelectedOverrideDate(null);
      setEditingOverride(null);
      
      // Check if this override OPENS availability (not a day off and has shifts)
      if (!variables.data.is_day_off && variables.data.shifts && variables.data.shifts.length > 0) {
        const firstShift = variables.data.shifts[0];
        const lastShift = variables.data.shifts[variables.data.shifts.length - 1];
        await notifyWaitingListForOpenedSlot({
          businessId: business.id,
          date: variables.data.date,
          startTime: firstShift.start,
          endTime: lastShift.end
        });
      }
    },
  });

  const deleteOverrideMutation = useMutation({
    mutationFn: (id) => base44.entities.ScheduleOverride.delete(id),
    onSuccess: async () => {
      // Get the date from editingOverride before clearing it
      const deletedDate = editingOverride?.date;
      
      queryClient.invalidateQueries({ queryKey: ['schedule-overrides'] });
      setShowOverrideModal(false);
      setSelectedOverrideDate(null);
      setEditingOverride(null);
      
      // When override is deleted, it reverts to default business hours
      if (deletedDate && business?.working_hours) {
        const dayKey = getDayKey(deletedDate);
        const defaultHours = business.working_hours[dayKey];
        
        if (defaultHours?.enabled && defaultHours?.shifts?.length > 0) {
          const firstShift = defaultHours.shifts[0];
          const lastShift = defaultHours.shifts[defaultHours.shifts.length - 1];
          await notifyWaitingListForOpenedSlot({
            businessId: business.id,
            date: deletedDate,
            startTime: firstShift.start,
            endTime: lastShift.end
          });
        } else if (defaultHours?.enabled && defaultHours?.start && defaultHours?.end) {
          // Old format
          await notifyWaitingListForOpenedSlot({
            businessId: business.id,
            date: deletedDate,
            startTime: defaultHours.start,
            endTime: defaultHours.end
          });
        }
      }
    },
  });

  // Helper to get override for a specific date
  const getOverrideForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return scheduleOverrides.find(o => o.date === dateStr);
  };

  // Handle opening override modal
  const handleOpenOverrideModal = (date, existingOverride = null) => {
    setSelectedOverrideDate(date);
    setEditingOverride(existingOverride);
    setShowOverrideModal(true);
  };

  // Handle saving override
  const handleSaveOverride = (data) => {
    if (editingOverride) {
      updateOverrideMutation.mutate({ id: editingOverride.id, data });
    } else {
      createOverrideMutation.mutate(data);
    }
  };

  // Handle deleting override
  const handleDeleteOverride = (id) => {
    if (window.confirm('האם למחוק את השינוי ולחזור לשעות הרגילות?')) {
      deleteOverrideMutation.mutate(id);
    }
  };

  const weekStart = startOfWeek(currentDate, { locale: he, weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { locale: he, weekStartsOn: 0 });
  const allDaysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const daysInWeek = viewMode === 'week'
    ? allDaysInWeek.filter((_, index) => index !== 6)
    : allDaysInWeek;

  const displayDays = viewMode === 'day' ? [currentDate] : [...daysInWeek].reverse();
  const hours = Array.from({ length: 14 }, (_, i) => i + 8);

  // Helper to parse date - handles both DD/MM/YYYY and YYYY-MM-DD formats
  // Get bookings for a specific day
  const getBookingsForDay = (day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return bookings.filter(booking => {
      const bookingDateISO = toISO(booking.date);
      return bookingDateISO === dayStr;
    });
  };

  const getBookingPosition = (booking) => {
    const [hours, minutes] = booking.time.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    const startMinutes = 8 * 60;
    const minutesFromStart = totalMinutes - startMinutes;
    const position = (minutesFromStart / 60) * 52;
    const height = (booking.duration / 60) * 52;

    return { top: position, height: Math.max(height, 20) };
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'pending_approval': return 'bg-yellow-500';
      case 'confirmed': return 'bg-green-500';
      case 'completed': return 'bg-gray-500';
      case 'cancelled': return 'bg-red-500/50';
      default: return 'bg-[#FF6B35]';
    }
  };

  const previousPeriod = () => {
    if (viewMode === 'day') {
      setCurrentDate(addDays(currentDate, -1));
    } else {
      setCurrentDate(subWeeks(currentDate, 1));
    }
  };

  const nextPeriod = () => {
    if (viewMode === 'day') {
      setCurrentDate(addDays(currentDate, 1));
    } else {
      setCurrentDate(addWeeks(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetchBookings();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleCancelBooking = () => {
    if (window.confirm(`האם אתה בטוח שברצונך לבטל את התור של ${selectedBooking.client_name}?`)) {
      cancelMutation.mutate(selectedBooking);
    }
  };

  const handleEditBooking = () => {
    navigate(createPageUrl("CreateBooking") + `?edit=${selectedBooking.id}`);
  };

  // Improved swipe handlers with animation
  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setTouchStartY(e.targetTouches[0].clientY);
    setIsSwipingHorizontally(false);
    setSwipeOffset(0);
  };

  const onTouchMove = (e) => {
    if (!touchStart || !touchStartY) return;
    
    const currentTouch = e.targetTouches[0].clientX;
    const currentTouchY = e.targetTouches[0].clientY;
    setTouchEnd(currentTouch);
    
    const diffX = Math.abs(currentTouch - touchStart);
    const diffY = Math.abs(currentTouchY - touchStartY);
    
    // Determine if this is a horizontal swipe (more horizontal than vertical)
    if (!isSwipingHorizontally && diffX > 10) {
      if (diffX > diffY * 2) {
        // Definitely horizontal swipe
        setIsSwipingHorizontally(true);
      }
    }
    
    // Show live swipe preview if we're swiping horizontally
    if (isSwipingHorizontally && diffX > diffY) {
      // Apply swipe offset with rubber band effect (damping)
      const offset = (currentTouch - touchStart) * 0.4; // 0.4 = damping factor
      setSwipeOffset(offset);
    }
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd || !isSwipingHorizontally) {
      setIsSwipingHorizontally(false);
      setSwipeOffset(0);
      return;
    }
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe || isRightSwipe) {
      // Animate to full swipe
      setIsAnimating(true);
      const targetOffset = isLeftSwipe ? -window.innerWidth : window.innerWidth;
      setSwipeOffset(targetOffset);
      
      // Change week after animation starts
      setTimeout(() => {
        if (isLeftSwipe) {
          nextPeriod();
        } else {
          previousPeriod();
        }
        
        // Reset after week changes
        setTimeout(() => {
          setSwipeOffset(0);
          setIsAnimating(false);
          setIsSwipingHorizontally(false);
        }, 50);
      }, 250);
    } else {
      // Snap back animation if swipe was too short
      setIsAnimating(true);
      setSwipeOffset(0);
      setTimeout(() => {
        setIsAnimating(false);
        setIsSwipingHorizontally(false);
      }, 200);
    }
  };

  const todayBookings = getBookingsForDay(currentDate);

  // Drag and drop handlers
  const handleDragStart = (event) => {
    const { active, activatorEvent } = event;
    const booking = bookings.find(b => b.id === active.id);
    if (booking) {
      setActiveBooking(booking);
      setDropPreview(null);
      // Save original position to show ghost
      setOriginalPosition({
        date: toISO(booking.date),
        time: booking.time,
      });

      // Calculate offset from pointer to booking top
      // This ensures the drop preview aligns with where the booking visually appears
      if (activatorEvent && calendarGridRef.current) {
        const containerRect = calendarGridRef.current.getBoundingClientRect();
        const bookingTopPosition = timeToPosition(booking.time);
        const pointerY = activatorEvent.clientY - containerRect.top;
        const offsetY = pointerY - bookingTopPosition;
        setDragOffset({ x: 0, y: offsetY });
      }
    }
  };

  const handleDragMove = (event) => {
    if (!activeBooking || !calendarGridRef.current) return;

    const { activatorEvent, delta } = event;

    // Get the current pointer position
    const pointerEvent = activatorEvent;
    if (!pointerEvent) return;

    const containerRect = calendarGridRef.current.getBoundingClientRect();

    // Calculate current position (initial position + delta)
    const currentY = pointerEvent.clientY + delta.y;
    const currentX = pointerEvent.clientX + delta.x;

    // Convert Y position to time, accounting for where user grabbed the booking
    const rawMinutes = positionToMinutes(currentY - dragOffset.y, containerRect.top);
    const snappedMinutes = snapToInterval(rawMinutes, 15);
    const snappedTime = minutesToTime(snappedMinutes);

    // Convert X position to day
    const columnCount = displayDays.length;
    let columnIndex = positionToColumnIndex(currentX, containerRect, columnCount);
    // Clamp to valid range
    columnIndex = Math.max(0, Math.min(columnCount - 1, columnIndex));
    const targetDate = columnIndexToDate(columnIndex, displayDays);
    const targetDateStr = format(targetDate, 'yyyy-MM-dd');

    // Check for conflicts
    const dayBookings = getBookingsForDay(targetDate);
    const hasConflict = !isSlotAvailable({
      time: snappedTime,
      duration: activeBooking.duration || 30,
      bookings: dayBookings,
      ignoreBookingId: activeBooking.id,
    });

    setDropPreview({
      date: targetDateStr,
      time: snappedTime,
      hasConflict,
      targetDate,
    });
  };

  const handleDragEnd = (event) => {
    if (!activeBooking || !dropPreview) {
      setActiveBooking(null);
      setDropPreview(null);
      setOriginalPosition(null);
      setDragOffset({ x: 0, y: 0 });
      return;
    }

    // Block if there's a conflict
    if (dropPreview.hasConflict) {
      toast.error('לא ניתן להזיז - יש תור אחר בזמן זה');
      setActiveBooking(null);
      setDropPreview(null);
      setOriginalPosition(null);
      setDragOffset({ x: 0, y: 0 });
      return;
    }

    // Check if position actually changed
    const originalDate = toISO(activeBooking.date);
    if (originalDate === dropPreview.date && activeBooking.time === dropPreview.time) {
      setActiveBooking(null);
      setDropPreview(null);
      setOriginalPosition(null);
      setDragOffset({ x: 0, y: 0 });
      return;
    }

    // Show confirmation modal instead of immediately rescheduling
    setPendingReschedule({
      booking: activeBooking,
      oldDate: originalDate,
      oldTime: activeBooking.time,
      newDate: dropPreview.date,
      newTime: dropPreview.time,
    });

    setActiveBooking(null);
    setDropPreview(null);
    setOriginalPosition(null);
    setDragOffset({ x: 0, y: 0 });
  };

  // Handle reschedule confirmation
  const handleConfirmReschedule = async () => {
    if (!pendingReschedule) return;

    const { booking, oldDate, oldTime, newDate, newTime } = pendingReschedule;

    // Execute the reschedule
    rescheduleMutation.mutate({
      bookingId: booking.id,
      newDate,
      newTime,
    });

    // Send WhatsApp notification to client
    if (booking.client_phone && !booking.client_email?.includes('walkin_')) {
      try {
        await sendUpdate({
          phone: booking.client_phone,
          clientName: booking.client_name,
          businessName: business?.name || 'העסק',
          oldDate,
          oldTime,
          newDate,
          newTime,
          businessId: business?.id
        });
        toast.success('הודעת עדכון נשלחה ללקוח');
      } catch (error) {
        console.error('Failed to send update notification:', error);
      }
    }

    setPendingReschedule(null);
  };

  // Handle reschedule cancellation
  const handleCancelReschedule = () => {
    setPendingReschedule(null);
  };

  const handleDragCancel = () => {
    setActiveBooking(null);
    setDropPreview(null);
    setOriginalPosition(null);
    setDragOffset({ x: 0, y: 0 });
  };

  const DayHeader = ({ day }) => {
    const dayIsToday = isToday(day);
    const dayNameShort = format(day, 'EEEEEE', { locale: he });
    const dayNumber = format(day, 'd');
    const override = getOverrideForDate(day);
    const hasOverride = !!override;
    const isDayOff = override?.is_day_off;

    return (
      <button
        onClick={() => handleOpenOverrideModal(day, override)}
        className={`h-14 flex flex-col items-center justify-center border-l border-gray-800 last:border-l-0 relative transition-colors hover:bg-white/5 ${
          dayIsToday ? 'bg-[#FF6B35]/10' : ''
        } ${isDayOff ? 'bg-red-500/10' : ''}`}
      >
        {/* Override indicator */}
        {hasOverride && (
          <div className={`absolute top-1 left-1 w-2 h-2 rounded-full ${isDayOff ? 'bg-red-500' : 'bg-blue-500'}`} />
        )}
        
        <span className={`text-xs mb-0.5 ${
          dayIsToday ? 'text-[#FF6B35] font-semibold' : isDayOff ? 'text-red-400' : 'text-[#94A3B8]'
        }`}>
          {dayNameShort}
        </span>

        <span className={`text-base font-bold leading-none ${
          dayIsToday ? 'text-[#FF6B35]' : isDayOff ? 'text-red-400' : 'text-white'
        }`}>
          {dayNumber}
        </span>
        
        {/* Small settings icon on hover */}
        <Settings2 className="w-3 h-3 text-[#94A3B8] absolute bottom-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  };

  const AppointmentBlock = ({ appointment, onClick }) => {
    const isPending = appointment.status === 'pending_approval';
    const { top, height } = getBookingPosition(appointment);
    const serviceColor = getServiceColor(appointment.service_id, appointment.service_name);
    const isDragging = activeBooking?.id === appointment.id;

    // Make the appointment draggable
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
      id: appointment.id,
      data: appointment,
    });

    const style = {
      top: `${top}px`,
      height: `${height}px`,
      backgroundColor: isPending ? '#EAB308' : serviceColor,
      borderRight: `3px solid ${serviceColor}`,
      transform: CSS.Translate.toString(transform),
      opacity: isDragging ? 0.5 : 1,
      cursor: 'grab',
      touchAction: 'none',
    };

    return (
      <button
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        onClick={(e) => {
          // Only trigger click if not dragging
          if (!isDragging) {
            e.stopPropagation();
            onClick();
          }
        }}
        className={`absolute left-1 right-1 rounded-lg p-1.5 text-right overflow-hidden hover:brightness-110 transition-all shadow-lg ${isDragging ? 'z-50' : ''}`}
        style={style}
      >
        {isPending && (
          <div className="absolute top-1 left-1 w-2 h-2 bg-white rounded-full animate-pulse" />
        )}

        <p className="text-[10px] font-bold text-white leading-tight break-words">
          {appointment.client_name || 'Walk-in'}
        </p>
        {height >= 40 && (
          <p className="text-[8px] text-white/80 truncate">
            {appointment.service_name}
          </p>
        )}
      </button>
    );
  };

  return (
    <div className="h-screen bg-[#0C0F1D] flex flex-col overflow-hidden fixed inset-0">
      {/* Notification Dropdown */}
      {showNotifications && (
        <NotificationDropdown
          businessId={business?.id}
          onClose={() => setShowNotifications(false)}
        />
      )}

      {/* Schedule Override Modal */}
      <ScheduleOverrideModal
        isOpen={showOverrideModal}
        onClose={() => {
          setShowOverrideModal(false);
          setSelectedOverrideDate(null);
          setEditingOverride(null);
        }}
        date={selectedOverrideDate}
        staff={staffList}
        existingOverride={editingOverride}
        onSave={handleSaveOverride}
        onDelete={handleDeleteOverride}
        isLoading={createOverrideMutation.isPending || updateOverrideMutation.isPending || deleteOverrideMutation.isPending}
      />

      {/* Reschedule Confirmation Modal */}
      {pendingReschedule && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6" onClick={handleCancelReschedule}>
          <div className="bg-[#1A1F35] rounded-3xl max-w-md w-full border-2 border-gray-800" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-800 p-5 flex items-center justify-between">
              <h3 className="text-xl font-bold">אישור העברת תור</h3>
              <button onClick={handleCancelReschedule} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Client Info */}
              <div className="bg-[#0C0F1D] rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FF1744] flex items-center justify-center text-xl font-bold flex-shrink-0">
                    {pendingReschedule.booking.client_name ? pendingReschedule.booking.client_name[0].toUpperCase() : '?'}
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">{pendingReschedule.booking.client_name}</h4>
                    <p className="text-[#94A3B8] text-sm">{pendingReschedule.booking.service_name}</p>
                  </div>
                </div>
              </div>

              {/* Old vs New Details */}
              <div className="grid grid-cols-2 gap-3">
                {/* Old Details */}
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                  <p className="text-red-400 text-xs font-semibold mb-2">מקור</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-white">
                      <Calendar className="w-4 h-4 text-red-400" />
                      <span className="text-sm">{formatNumeric(pendingReschedule.oldDate)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-white">
                      <Clock className="w-4 h-4 text-red-400" />
                      <span className="text-sm font-bold">{pendingReschedule.oldTime.substring(0, 5)}</span>
                    </div>
                  </div>
                </div>

                {/* New Details */}
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                  <p className="text-green-400 text-xs font-semibold mb-2">יעד חדש</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-white">
                      <Calendar className="w-4 h-4 text-green-400" />
                      <span className="text-sm">{formatNumeric(pendingReschedule.newDate)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-white">
                      <Clock className="w-4 h-4 text-green-400" />
                      <span className="text-sm font-bold">{pendingReschedule.newTime}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* WhatsApp notification notice */}
              {pendingReschedule.booking.client_phone && !pendingReschedule.booking.client_email?.includes('walkin_') && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <p className="text-blue-300 text-xs">הלקוח יקבל הודעת WhatsApp על השינוי</p>
                </div>
              )}
            </div>

            <div className="border-t border-gray-800 p-5 flex gap-3">
              <button
                onClick={handleCancelReschedule}
                className="flex-1 h-12 rounded-xl border-2 border-gray-600 text-[#94A3B8] hover:bg-white/5 hover:text-white transition-colors font-medium"
              >
                ביטול
              </button>
              <Button
                onClick={handleConfirmReschedule}
                disabled={rescheduleMutation.isPending}
                className="flex-1 h-12 rounded-xl font-semibold"
                style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
              >
                {rescheduleMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'אישור העברה'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Booking Details Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6" onClick={() => setSelectedBooking(null)}>
          <div className="bg-[#1A1F35] rounded-3xl max-w-md w-full border-2 border-gray-800" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-800 p-5 flex items-center justify-between">
              <h3 className="text-xl font-bold">פרטי התור</h3>
              <button onClick={() => setSelectedBooking(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-[#0C0F1D] rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FF1744] flex items-center justify-center text-2xl font-bold flex-shrink-0">
                    {selectedBooking.client_name ? selectedBooking.client_name[0].toUpperCase() : '?'}
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">{selectedBooking.client_name}</h4>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2 text-[#94A3B8]">
                    <Scissors className="w-4 h-4" />
                    <span className="text-sm">שירות</span>
                  </div>
                  <span className="font-semibold">{selectedBooking.service_name}</span>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2 text-[#94A3B8]">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm">תאריך</span>
                  </div>
                  <span className="font-semibold">{formatNumeric(selectedBooking.date)}</span>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2 text-[#94A3B8]">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">שעה</span>
                  </div>
                  <span className="font-semibold">{formatTime(selectedBooking.time)}</span>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2 text-[#94A3B8]">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">משך</span>
                  </div>
                  <span className="font-semibold">{selectedBooking.duration} דקות</span>
                </div>
              </div>

              {selectedBooking.notes && (
                <div className="bg-[#0C0F1D] rounded-2xl p-4">
                  <p className="text-sm text-[#94A3B8] mb-1">הערות</p>
                  <p className="text-sm">{selectedBooking.notes}</p>
                </div>
              )}
            </div>

            <div className="border-t border-gray-800 p-5 flex gap-3">
              <Button
                onClick={handleEditBooking}
                variant="outline"
                className="flex-1 h-12 rounded-xl border-2 border-blue-500 text-blue-500 hover:bg-blue-500/10"
              >
                <Edit className="w-5 h-5 ml-2" />
                ערוך
              </Button>
              <Button
                onClick={handleCancelBooking}
                disabled={cancelMutation.isPending}
                variant="outline"
                className="flex-1 h-12 rounded-xl border-2 border-red-500 text-red-500 hover:bg-red-500/10"
              >
                {cancelMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-5 h-5 ml-2" />
                    בטל תור
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-[#1A1F35] border-b border-gray-800 pt-safe">
        <div className="p-4 pb-2">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate(createPageUrl("BusinessDashboard"))}
              className="text-[#94A3B8] hover:text-white"
            >
              <Home className="w-6 h-6" />
            </button>

            <div className="text-center flex-1">
              <div className="flex items-center justify-center mb-1">
                <button onClick={nextPeriod} className="p-2">
                  <ChevronRight className="w-6 h-6" />
                </button>

                <h1 className="text-base font-bold px-3 whitespace-nowrap">
                  {viewMode === 'day'
                    ? format(currentDate, 'd בMMMM yyyy', { locale: he })
                    : `${format(weekStart, 'd', { locale: he })}-${format(weekEnd, 'd', { locale: he })} ${format(weekEnd, 'MMMM yyyy', { locale: he })}`
                  }
                </h1>

                <button onClick={previousPeriod} className="p-2">
                  <ChevronLeft className="w-6 h-6" />
                </button>
              </div>

              {!isToday(currentDate) && (
                <Button
                  onClick={goToToday}
                  variant="ghost"
                  size="sm"
                  className="text-[#FF6B35] hover:text-[#FF6B35]/80 h-7 text-xs"
                >
                  חזור להיום
                </Button>
              )}
            </div>

            <button
              onClick={() => setShowNotifications(true)}
              className="relative p-3 bg-[#1A1F35] rounded-xl border-2 border-gray-800 hover:border-[#FF6B35] transition-all hover:scale-110"
            >
              <Bell className="w-6 h-6 text-white" />
              {unreadCount > 0 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-[#FF6B35] to-[#FF1744] rounded-full flex items-center justify-center text-xs font-bold animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </div>
              )}
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('week')}
              className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                viewMode === 'week'
                  ? 'bg-gradient-to-r from-[#FF6B35] to-[#FF1744] text-white scale-105'
                  : 'bg-[#0C0F1D] text-[#94A3B8] border-2 border-gray-800 hover:border-[#FF6B35]'
              }`}
            >
              שבוע
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                viewMode === 'day'
                  ? 'bg-gradient-to-r from-[#FF6B35] to-[#FF1744] text-white scale-105'
                  : 'bg-[#0C0F1D] text-[#94A3B8] border-2 border-gray-800 hover:border-[#FF6B35]'
              }`}
            >
              יום
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#FF6B35]" />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
        <div
          className="flex-1 overflow-x-auto overflow-y-auto pb-safe"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{
            transform: `translateX(${swipeOffset}px)`,
            transition: isAnimating ? 'transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)' : 'none',
            opacity: isAnimating ? 1 - Math.abs(swipeOffset) / window.innerWidth * 0.3 : 1,
            touchAction: isSwipingHorizontally ? 'none' : 'pan-y',
          }}
        >
          {/* Day Headers */}
          {viewMode === 'week' && (
            <div className="flex flex-row-reverse border-b-2 border-gray-800 bg-[#0C0F1D]">
              <div className="w-16 flex-shrink-0 border-r-2 border-gray-800" />
              <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(6, 1fr)` }}>
                {displayDays.map((day) => (
                  <DayHeader key={day.toString()} day={day} />
                ))}
              </div>
            </div>
          )}

          {/* Grid Body */}
          <div className="flex flex-row-reverse" ref={calendarGridRef}>
            {/* Time Column */}
            <div className="w-16 flex-shrink-0 bg-[#0C0F1D] border-r-2 border-gray-800">
              {hours.map(hour => (
                <div
                  key={hour}
                  className="h-13 flex items-center justify-center border-t border-gray-800 first:border-t-0"
                  style={{ height: '52px' }}
                >
                  <span className="text-xs text-[#94A3B8] font-medium">
                    {String(hour).padStart(2, '0')}:00
                  </span>
                </div>
              ))}
            </div>

            {/* Day Columns */}
            <div className="flex-1 relative" style={{ minHeight: `${hours.length * 52}px` }}>
              <div className="grid h-full" style={{ gridTemplateColumns: viewMode === 'week' ? `repeat(6, 1fr)` : '1fr' }}>
                {displayDays.map((day) => {
                  const dayBookings = getBookingsForDay(day);
                  const dayIsToday = isToday(day);

                  return (
                    <div
                      key={day.toString()}
                      className="relative border-r border-gray-800 first:border-r-0"
                    >
                      {hours.map((hour) => (
                        <div
                          key={`${day}-${hour}`}
                          className={`border-t border-gray-800 first:border-t-0 relative hover:bg-white/5 cursor-pointer transition-colors group ${
                            dayIsToday ? 'bg-[#FF6B35]/5' : ''
                          }`}
                          style={{ height: '52px' }}
                          onClick={() => navigate(createPageUrl("CreateBooking") + `?date=${format(day, 'yyyy-MM-dd')}&time=${String(hour).padStart(2, '0')}:00`)}
                        >
                          <span className="absolute inset-0 flex items-center justify-center text-[#94A3B8] text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                            +
                          </span>
                        </div>
                      ))}

                      {dayBookings.map((booking) => {
                        return (
                          <AppointmentBlock
                            key={booking.id}
                            appointment={booking}
                            onClick={() => setSelectedBooking(booking)}
                          />
                        );
                      })}

                      {/* Ghost at original position - shows where booking came from */}
                      {activeBooking && originalPosition && originalPosition.date === format(day, 'yyyy-MM-dd') && (
                        <div
                          className="absolute left-1 right-1 rounded-lg border-2 border-dashed border-gray-400 bg-gray-500/20 pointer-events-none"
                          style={{
                            top: `${timeToPosition(originalPosition.time)}px`,
                            height: `${Math.max((activeBooking.duration / 60) * 52, 20)}px`,
                          }}
                        >
                          <p className="text-[10px] text-gray-400 p-1">
                            {originalPosition.time}
                          </p>
                        </div>
                      )}

                      {/* Drop preview indicator - shows where booking will land */}
                      {activeBooking && dropPreview && dropPreview.date === format(day, 'yyyy-MM-dd') && (
                        <div
                          className={`absolute left-1 right-1 rounded-lg border-2 border-dashed pointer-events-none z-10 ${
                            dropPreview.hasConflict
                              ? 'border-red-500 bg-red-500/20'
                              : 'border-green-500 bg-green-500/20'
                          }`}
                          style={{
                            top: `${timeToPosition(dropPreview.time)}px`,
                            height: `${Math.max((activeBooking.duration / 60) * 52, 20)}px`,
                          }}
                        >
                          <p className={`text-[10px] font-bold p-1 ${
                            dropPreview.hasConflict ? 'text-red-400' : 'text-green-400'
                          }`}>
                            {dropPreview.time}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {viewMode === 'day' && todayBookings.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center px-6">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#1A1F35] flex items-center justify-center">
                      <Calendar className="w-10 h-10 text-[#94A3B8]" />
                    </div>
                    <h3 className="lg font-semibold mb-2">אין תורים ליום זה</h3>
                    <p className="text-sm text-[#94A3B8] mb-4">
                      {isToday(currentDate) ? 'התחל ליצור תורים להיום' : 'בחר יום אחר או הוסף תור חדש'}
                    </p>
                    <button
                      onClick={() => navigate(createPageUrl("CreateBooking"))}
                      className="bg-gradient-to-l from-[#FF6B35] to-[#FF1744] px-6 py-3 rounded-xl font-semibold pointer-events-auto"
                    >
                      הוסף תור
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        </DndContext>
      )}

      {/* Fixed action buttons - positioned properly above bottom nav */}
      <div className="fixed bottom-28 right-6 flex flex-col gap-3 z-20">
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="w-12 h-12 rounded-full bg-[#1A1F35] border-2 border-gray-800 flex items-center justify-center shadow-xl hover:scale-110 hover:border-[#FF6B35] transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 text-white ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
        <button
          onClick={() => navigate(createPageUrl("CreateBooking"))}
          className="w-12 h-12 rounded-full bg-gradient-to-r from-[#FF6B35] to-[#FF1744] flex items-center justify-center shadow-2xl hover:scale-110 transition-transform"
        >
          <Plus className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  );
}