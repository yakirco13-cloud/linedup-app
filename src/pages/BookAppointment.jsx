import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { supabase } from "@/lib/supabase/client";
import { useUser } from "@/components/UserContext";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, Clock, User, Loader2, CheckCircle, Briefcase, ChevronLeft, ChevronRight, Lightbulb, Sparkles, Bell, CalendarPlus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, parseISO, addMonths, subMonths, startOfDay, startOfWeek, endOfWeek } from "date-fns";
import { he } from "date-fns/locale";
import { generateGoogleCalendarLink } from "@/utils/calendarLinks";
import WaitingListModal from "@/components/WaitingListModal";

// Import centralized services
import { sendConfirmation, sendUpdate } from "@/services/whatsappService";
import { notifyWaitingListForOpenedSlot } from "@/services/waitingListService";
import { getCurrentPlan } from "@/services/subscriptionService";

export default function BookAppointment() {
  const navigate = useNavigate();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const bookingLockRef = useRef(false); // Synchronous lock to prevent double-clicks
  const [step, setStep] = useState(2);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [notes, setNotes] = useState("");
  const [success, setSuccess] = useState(false);
  const [bookingStatus, setBookingStatus] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleBookingId, setRescheduleBookingId] = useState(null);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [isBooking, setIsBooking] = useState(false); // Prevent double-click
  const [alternativeSuggestions, setAlternativeSuggestions] = useState({ services: [], dates: [], loading: false });
  
  // Waiting list state
  const [waitingListStatus, setWaitingListStatus] = useState({ joining: false, joined: false, error: null });
  const [waitingListSuccess, setWaitingListSuccess] = useState(false);
  const [waitingListModalOpen, setWaitingListModalOpen] = useState(false);

  // Load business automatically from user's joined businesses
  useEffect(() => {
    const loadBusiness = async () => {
      if (user?.joined_business_id) {
        const businesses = await base44.entities.Business.filter({ id: user.joined_business_id });
        if (businesses.length > 0) {
          setSelectedBusiness(businesses[0]);
        }
      }
    };

    loadBusiness();
  }, [user?.joined_business_id]);

  // Check for reschedule parameter and pre-load booking
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const rescheduleId = urlParams.get('reschedule');
    const serviceId = urlParams.get('service');
    const preselectedDate = urlParams.get('date');
    const preselectedTime = urlParams.get('time');

    if (rescheduleId) {
      setIsRescheduling(true);
      setRescheduleBookingId(rescheduleId);
      setRescheduleLoading(true);

      // Load the booking to reschedule
      base44.entities.Booking.filter({ id: rescheduleId }).then(async bookings => {
        if (bookings.length > 0) {
          const booking = bookings[0];

          // Load all necessary data
          const [businesses, services, staffMembers] = await Promise.all([
            base44.entities.Business.filter({ id: booking.business_id }),
            base44.entities.Service.filter({ business_id: booking.business_id }),
            base44.entities.Staff.filter({ business_id: booking.business_id })
          ]);

          // Set all selections
          if (businesses.length > 0) setSelectedBusiness(businesses[0]);

          const service = services.find(s => s.id === booking.service_id);
          if (service) setSelectedService(service);

          const staff = staffMembers.find(s => s.id === booking.staff_id);
          if (staff) setSelectedStaff(staff);

          setNotes(booking.notes || "");

          // Start at service selection so user can change service if needed
          setStep(2);
          setRescheduleLoading(false);
        } else {
          setRescheduleLoading(false);
        }
      }).catch((error) => {
        setRescheduleLoading(false);
      });
    } else if (serviceId) {
      // Pre-select service if provided
      base44.entities.Service.filter({ id: serviceId }).then(async services => {
        if (services.length > 0) {
          const service = services[0];
          setSelectedService(service);

          // Also load the business
          const businesses = await base44.entities.Business.filter({ id: service.business_id });
          if (businesses.length > 0) {
            setSelectedBusiness(businesses[0]);
            setStep(3); // Go to staff selection
          }
        }
      });
    }

    // Handle pre-selected date from waiting list
    if (preselectedDate && !rescheduleId) {
      try {
        const dateObj = parseISO(preselectedDate);
        setSelectedDate(dateObj);
      } catch (e) {
        // Invalid date format
      }
    }

    // Handle pre-selected time from waiting list notification
    if (preselectedTime && !rescheduleId) {
      setSelectedTime(preselectedTime);
    }
  }, []);

  // Check if user is already on waiting list for selected date
  useEffect(() => {
    const checkWaitingList = async () => {
      if (!selectedBusiness || !selectedDate || !user?.phone) return;

      try {
        const existingEntries = await base44.entities.WaitingList.filter({
          business_id: selectedBusiness.id,
          client_phone: user.phone,
          date: format(selectedDate, 'yyyy-MM-dd'),
          status: 'waiting'
        });

        if (existingEntries.length > 0) {
          setWaitingListStatus({ joining: false, joined: true, error: null });
        } else {
          setWaitingListStatus({ joining: false, joined: false, error: null });
        }
      } catch (error) {
        // Error checking waiting list
      }
    };

    checkWaitingList();
  }, [selectedBusiness, selectedDate, user?.phone]);

  const { data: services = [], isLoading: servicesLoading, refetch: refetchServices } = useQuery({
    queryKey: ['services', selectedBusiness?.id],
    queryFn: async () => {
      const result = await base44.entities.Service.filter({ business_id: selectedBusiness.id });
      return result;
    },
    enabled: !!selectedBusiness?.id && step >= 2,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  // Refetch services when business is loaded
  useEffect(() => {
    if (selectedBusiness?.id && step >= 2) {
      refetchServices();
    }
  }, [selectedBusiness?.id, step, refetchServices]);

  const { data: staff = [], isLoading: staffLoading } = useQuery({
    queryKey: ['staff', selectedBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('business_id', selectedBusiness.id)
        .neq('is_active', false) // Only show active staff
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedBusiness && step >= 3,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  // Check if business has waiting list feature (PRO+ plan)
  const { data: businessPlan } = useQuery({
    queryKey: ['business-plan', selectedBusiness?.id],
    queryFn: () => getCurrentPlan(selectedBusiness.id),
    enabled: !!selectedBusiness?.id,
    staleTime: 5 * 60 * 1000,
  });
  const hasWaitingListFeature = businessPlan?.features?.waitingList || false;

  // Auto-select service if only one
  useEffect(() => {
    if (step === 2 && services.length === 1 && !selectedService) {
      setSelectedService(services[0]);
      setStep(3);
    }
  }, [services, step, selectedService]);

  // Auto-select staff if only one and auto-advance
  useEffect(() => {
    if (step === 3 && staff.length === 1 && !selectedStaff) {
      setSelectedStaff(staff[0]);
      setStep(4);
    }
  }, [staff, step, selectedStaff]);

  const { data: existingBookings = [], refetch: refetchExistingBookings } = useQuery({
    queryKey: ['existing-bookings', selectedStaff?.id, selectedDate],
    queryFn: async () => {
      // Get both confirmed and pending_approval bookings
      const allBookings = await base44.entities.Booking.filter({
        business_id: selectedBusiness.id,
        staff_id: selectedStaff.id,
        date: format(selectedDate, 'yyyy-MM-dd')
      });
      // Filter to only include confirmed and pending_approval (not cancelled/completed)
      return allBookings.filter(b => b.status === 'confirmed' || b.status === 'pending_approval');
    },
    enabled: !!selectedBusiness && !!selectedStaff && !!selectedDate && step >= 4,
    staleTime: 0, // Always fetch fresh data
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });

  // Refetch bookings when entering step 5 (time selection)
  useEffect(() => {
    if (step === 5 && selectedDate && selectedStaff) {
      refetchExistingBookings();
    }
  }, [step, selectedDate, selectedStaff]);

  // Query for schedule overrides
  const { data: scheduleOverrides = [] } = useQuery({
    queryKey: ['schedule-overrides', selectedBusiness?.id],
    queryFn: () => base44.entities.ScheduleOverride.filter({ business_id: selectedBusiness.id }),
    enabled: !!selectedBusiness,
    staleTime: 5 * 60 * 1000,
  });

  // Helper to get schedule for a specific date (checks overrides first)
  const getScheduleForDate = (date, staffMember) => {
    if (!date || !staffMember) return null;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // Check for override - first staff-specific, then all-staff
    const staffOverride = scheduleOverrides.find(o => 
      o.date === dateStr && o.staff_id === staffMember.id
    );
    const allStaffOverride = scheduleOverrides.find(o => 
      o.date === dateStr && o.staff_id === null
    );
    
    const override = staffOverride || allStaffOverride;
    
    if (override) {
      if (override.is_day_off) {
        return { enabled: false, shifts: [], isDayOff: true };
      }
      return { 
        enabled: true, 
        shifts: override.shifts || [], 
        isOverride: true 
      };
    }
    
    // No override - use regular schedule
    const dayName = format(date, 'EEEE').toLowerCase();
    const dayKey = {
      'sunday': 'sunday',
      'monday': 'monday',
      'tuesday': 'tuesday',
      'wednesday': 'wednesday',
      'thursday': 'thursday',
      'friday': 'friday',
      'saturday': 'saturday'
    }[dayName];
    
    return staffMember.schedule?.[dayKey] || { enabled: false, shifts: [] };
  };

  const bookingMutation = useMutation({
    mutationFn: (data) => {
      return base44.entities.Booking.create(data);
    },
    onSuccess: async (data) => {
      // Send WhatsApp confirmation if booking is confirmed and user has phone
      if (data.status === 'confirmed' && data.client_phone && user?.whatsapp_notifications_enabled !== false) {
        await sendConfirmation({
          phone: data.client_phone,
          clientName: data.client_name,
          businessName: selectedBusiness.name,
          date: data.date,
          time: data.time,
          serviceName: data.service_name,
          businessId: selectedBusiness.id
        });
      }

      // Create notification for business owner
      try {
        const isPendingApproval = data.status === 'pending_approval';
        await base44.entities.Notification.create({
          business_id: data.business_id,
          type: 'booking_created',
          title: isPendingApproval ? 'תור חדש ממתין לאישור' : 'תור חדש נקבע',
          message: isPendingApproval
            ? `${data.client_name} ביקש/ה תור ל-${data.service_name} בתאריך ${format(parseISO(data.date), 'd.M.yyyy', { locale: he })} בשעה ${data.time} - דורש אישור`
            : `${data.client_name} קבע/ה תור ל-${data.service_name} בתאריך ${format(parseISO(data.date), 'd.M.yyyy', { locale: he })} בשעה ${data.time}`,
          booking_id: data.id,
          client_name: data.client_name,
          is_read: false
        });
      } catch (error) {
        // Failed to create notification
      }

      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['next-appointment'] });
      await queryClient.refetchQueries({ queryKey: ['notifications', data.business_id] });
      setBookingStatus(data.status);
      setSuccess(true);
      bookingLockRef.current = false;
      setIsBooking(false);
      setTimeout(() => {
        navigate("/MyBookings");
      }, 2500);
    },
    onError: (error) => {
      bookingLockRef.current = false;
      setIsBooking(false);
      alert('שגיאה בקביעת התור. אנא נסה שנית.');
    },
  });

  const updateBookingMutation = useMutation({
    mutationFn: async ({ id, data, fullBooking }) => {
      const updated = await base44.entities.Booking.update(id, data);
      return { ...fullBooking, ...updated, oldDate: fullBooking.date, oldTime: fullBooking.time };
    },
    onSuccess: async (data) => {
      // Send WhatsApp update notification
      if (data.client_phone && user?.whatsapp_notifications_enabled !== false) {
        await sendUpdate({
          phone: data.client_phone,
          clientName: data.client_name,
          businessName: selectedBusiness.name,
          oldDate: data.oldDate,
          oldTime: data.oldTime,
          newDate: data.date,
          newTime: data.time,
          businessId: selectedBusiness.id
        });
      }

      // Notify waiting list if date or time changed (old slot now available)
      if (data.oldDate !== data.date || data.oldTime !== data.time) {
        const freedDuration = data.duration || 30;
        const [h, m] = data.oldTime.split(':').map(Number);
        const endMinutes = h * 60 + m + freedDuration;
        const endH = Math.floor(endMinutes / 60);
        const endM = endMinutes % 60;
        const endTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

        await notifyWaitingListForOpenedSlot({
          businessId: data.business_id,
          date: data.oldDate,
          startTime: data.oldTime,
          endTime
        });
      }

      // Create notification for business owner about rescheduling
      try {
        await base44.entities.Notification.create({
          business_id: data.business_id,
          type: 'booking_rescheduled',
          title: 'תור עודכן',
          message: `${data.client_name} שינה/תה את התור ל-${data.service_name} מ-${format(parseISO(data.oldDate), 'd.M.yyyy', { locale: he })} בשעה ${data.oldTime} ל-${format(parseISO(data.date), 'd.M.yyyy', { locale: he })} בשעה ${data.time}`,
          booking_id: data.id,
          client_name: data.client_name,
          is_read: false
        });
      } catch (error) {
        // Failed to create reschedule notification
      }

      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['next-appointment'] });
      await queryClient.refetchQueries({ queryKey: ['notifications', data.business_id] });
      setBookingStatus(data.status);
      setSuccess(true);
      bookingLockRef.current = false;
      setIsBooking(false);
      setTimeout(() => {
        navigate("/MyBookings");
      }, 2500);
    },
    onError: (error) => {
      bookingLockRef.current = false;
      setIsBooking(false);
      alert('שגיאה בעדכון התור. אנא נסה שנית.');
    },
  });

  // Join waiting list function (called from modal)
  const joinWaitingList = async (waitingListData) => {
    try {
      await base44.entities.WaitingList.create(waitingListData);

      // Invalidate waiting list query so MyBookings shows the new entry
      queryClient.invalidateQueries({ queryKey: ['my-waiting-list'] });

      return { success: true };
    } catch (error) {
      throw error;
    }
  };

  const generateTimeSlots = () => {
    if (!selectedDate || !selectedStaff || !selectedService) return [];
    
    // Use getScheduleForDate to check for overrides
    const daySchedule = getScheduleForDate(selectedDate, selectedStaff);
    
    if (!daySchedule?.enabled) {
      return [];
    }

    const serviceDuration = selectedService.duration;
    
    // Minimum usable gap - 30 minutes
    const MIN_GAP = 30;
    
    // Get all existing bookings for this day, sorted by time
    const dayBookings = existingBookings
      .filter(booking => {
        if (rescheduleBookingId && booking.id === rescheduleBookingId) {
          return false;
        }
        return true;
      })
      .map(booking => ({
        start: parseInt(booking.time.split(':')[0]) * 60 + parseInt(booking.time.split(':')[1]),
        end: parseInt(booking.time.split(':')[0]) * 60 + parseInt(booking.time.split(':')[1]) + booking.duration
      }))
      .sort((a, b) => a.start - b.start);

    const allSlots = [];
    
    const processShift = (shiftStart, shiftEnd) => {
      let currentMinutes = shiftStart;
      
      while (currentMinutes + serviceDuration <= shiftEnd) {
        const slotStart = currentMinutes;
        const slotEnd = slotStart + serviceDuration;
        
        // Check for conflicts with existing bookings
        const hasConflict = dayBookings.some(booking => 
          (slotStart < booking.end && slotEnd > booking.start)
        );

        if (!hasConflict) {
          // Smart scheduling: Check if this slot creates unusable gaps (< 30 min)
          let createsUnusableGap = false;
          
          // Find the previous booking (ends before this slot starts)
          const prevBooking = dayBookings
            .filter(b => b.end <= slotStart)
            .sort((a, b) => b.end - a.end)[0];
          
          // Find the next booking (starts after this slot ends)
          const nextBooking = dayBookings
            .filter(b => b.start >= slotEnd)
            .sort((a, b) => a.start - b.start)[0];
          
          // Check gap BEFORE this slot (between previous booking and this slot)
          if (prevBooking) {
            const gapBefore = slotStart - prevBooking.end;
            if (gapBefore > 0 && gapBefore < MIN_GAP) {
              createsUnusableGap = true;
            }
          }
          
          // Check gap AFTER this slot (between this slot and next booking)
          if (nextBooking) {
            const gapAfter = nextBooking.start - slotEnd;
            if (gapAfter > 0 && gapAfter < MIN_GAP) {
              createsUnusableGap = true;
            }
          }
          
          if (!createsUnusableGap) {
            const hour = Math.floor(currentMinutes / 60);
            const minute = currentMinutes % 60;
            const timeSlot = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            allSlots.push(timeSlot);
          }
        }

        currentMinutes += 15;
      }
    };

    if (daySchedule.shifts && Array.isArray(daySchedule.shifts) && daySchedule.shifts.length > 0) {
      daySchedule.shifts.forEach((shift) => {
        const startHour = parseInt(shift.start.split(':')[0]);
        const startMinute = parseInt(shift.start.split(':')[1]);
        const endHour = parseInt(shift.end.split(':')[0]);
        const endMinute = parseInt(shift.end.split(':')[1]);
        
        const shiftStart = startHour * 60 + startMinute;
        const shiftEnd = endHour * 60 + endMinute;
        
        processShift(shiftStart, shiftEnd);
      });
    } else if (daySchedule.start && daySchedule.end) {
      const startHour = parseInt(daySchedule.start.split(':')[0]);
      const startMinute = parseInt(daySchedule.start.split(':')[1]);
      const endHour = parseInt(daySchedule.end.split(':')[0]);
      const endMinute = parseInt(daySchedule.end.split(':')[1]);

      const shiftStart = startHour * 60 + startMinute;
      const shiftEnd = endHour * 60 + endMinute;
      
      processShift(shiftStart, shiftEnd);
    }

    return allSlots;
  };

  const getAvailableDates = () => {
    if (!selectedStaff) return [];
    
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    return daysInMonth.filter(date => {
      if (date < startOfDay(new Date())) return false;
      
      // Use getScheduleForDate to check for overrides
      const daySchedule = getScheduleForDate(date, selectedStaff);
      return daySchedule?.enabled;
    });
  };

  // Function to check time slots for a specific service on a specific date
  const checkSlotsForService = async (service, date, bookingsForDate) => {
    if (!selectedStaff) return 0;
    
    // Use getScheduleForDate to check for overrides
    const daySchedule = getScheduleForDate(date, selectedStaff);
    
    if (!daySchedule?.enabled) return 0;
    
    const serviceDuration = service.duration;
    const MIN_GAP = 30;
    
    const dayBookings = bookingsForDate
      .filter(b => b.status === 'confirmed' || b.status === 'pending_approval')
      .filter(b => !(rescheduleBookingId && b.id === rescheduleBookingId))
      .map(booking => ({
        start: parseInt(booking.time.split(':')[0]) * 60 + parseInt(booking.time.split(':')[1]),
        end: parseInt(booking.time.split(':')[0]) * 60 + parseInt(booking.time.split(':')[1]) + booking.duration
      }))
      .sort((a, b) => a.start - b.start);
    
    let slotsCount = 0;
    
    const processShift = (shiftStart, shiftEnd) => {
      let currentMinutes = shiftStart;
      
      while (currentMinutes + serviceDuration <= shiftEnd) {
        const slotStart = currentMinutes;
        const slotEnd = slotStart + serviceDuration;
        
        const hasConflict = dayBookings.some(booking => 
          (slotStart < booking.end && slotEnd > booking.start)
        );
        
        if (!hasConflict) {
          const prevBooking = dayBookings.filter(b => b.end <= slotStart).sort((a, b) => b.end - a.end)[0];
          const nextBooking = dayBookings.filter(b => b.start >= slotEnd).sort((a, b) => a.start - b.start)[0];
          
          let createsUnusableGap = false;
          
          if (prevBooking) {
            const gapBefore = slotStart - prevBooking.end;
            if (gapBefore > 0 && gapBefore < MIN_GAP) createsUnusableGap = true;
          }
          
          if (nextBooking) {
            const gapAfter = nextBooking.start - slotEnd;
            if (gapAfter > 0 && gapAfter < MIN_GAP) createsUnusableGap = true;
          }
          
          if (!createsUnusableGap) slotsCount++;
        }
        
        currentMinutes += 15;
      }
    };
    
    if (daySchedule.shifts && Array.isArray(daySchedule.shifts) && daySchedule.shifts.length > 0) {
      daySchedule.shifts.forEach(shift => {
        const shiftStart = parseInt(shift.start.split(':')[0]) * 60 + parseInt(shift.start.split(':')[1]);
        const shiftEnd = parseInt(shift.end.split(':')[0]) * 60 + parseInt(shift.end.split(':')[1]);
        processShift(shiftStart, shiftEnd);
      });
    } else if (daySchedule.start && daySchedule.end) {
      const shiftStart = parseInt(daySchedule.start.split(':')[0]) * 60 + parseInt(daySchedule.start.split(':')[1]);
      const shiftEnd = parseInt(daySchedule.end.split(':')[0]) * 60 + parseInt(daySchedule.end.split(':')[1]);
      processShift(shiftStart, shiftEnd);
    }
    
    return slotsCount;
  };

  // Find alternative services and dates when no slots available
  const findAlternatives = async () => {
    if (!selectedBusiness || !selectedStaff || !selectedDate || !selectedService) return;
    
    setAlternativeSuggestions({ services: [], dates: [], loading: true });
    
    try {
      // Get bookings for selected date
      const bookingsForSelectedDate = await base44.entities.Booking.filter({
        business_id: selectedBusiness.id,
        staff_id: selectedStaff.id,
        date: format(selectedDate, 'yyyy-MM-dd')
      });
      
      // Check alternative services for the same date
      const alternativeServices = [];
      for (const service of services) {
        if (service.id === selectedService.id) continue;
        
        const slots = await checkSlotsForService(service, selectedDate, bookingsForSelectedDate);
        if (slots > 0) {
          alternativeServices.push({ ...service, availableSlots: slots });
        }
      }
      
      // Check alternative dates for the same service (next 14 days)
      const alternativeDates = [];
      const today = startOfDay(new Date());
      
      for (let i = 1; i <= 14; i++) {
        const checkDate = addDays(today, i);
        if (isSameDay(checkDate, selectedDate)) continue;
        
        // Check if staff works on this day (using schedule overrides)
        const daySchedule = getScheduleForDate(checkDate, selectedStaff);
        if (!daySchedule?.enabled) continue;
        
        // Get bookings for this date
        const bookingsForDate = await base44.entities.Booking.filter({
          business_id: selectedBusiness.id,
          staff_id: selectedStaff.id,
          date: format(checkDate, 'yyyy-MM-dd')
        });
        
        const slots = await checkSlotsForService(selectedService, checkDate, bookingsForDate);
        if (slots > 0) {
          alternativeDates.push({ date: checkDate, availableSlots: slots });
          if (alternativeDates.length >= 3) break; // Limit to 3 dates
        }
      }
      
      setAlternativeSuggestions({ services: alternativeServices, dates: alternativeDates, loading: false });
    } catch (error) {
      setAlternativeSuggestions({ services: [], dates: [], loading: false });
    }
  };

  // Find alternatives when reaching step 5 with no available slots
  useEffect(() => {
    if (step === 5 && generateTimeSlots().length === 0) {
      findAlternatives();
    }
  }, [step, selectedDate, existingBookings]);

const handleBooking = async () => {
  // Synchronous lock check - this happens before any async operation
  if (bookingLockRef.current) {
    return;
  }

  // Prevent double-clicks with state too
  if (isBooking) {
    return;
  }

  if (!user?.phone) {
    return;
  }

  // Lock immediately with ref (synchronous)
  bookingLockRef.current = true;
  setIsBooking(true);

  // Check for double booking before proceeding
  const latestBookings = await base44.entities.Booking.filter({
    business_id: selectedBusiness.id,
    staff_id: selectedStaff.id,
    date: format(selectedDate, 'yyyy-MM-dd')
  });

  const activeBookings = latestBookings.filter(b =>
    b.status === 'confirmed' || b.status === 'pending_approval'
  );

  const slotStart = parseInt(selectedTime.split(':')[0]) * 60 + parseInt(selectedTime.split(':')[1]);
  const slotEnd = slotStart + selectedService.duration;

  const hasConflict = activeBookings.some(booking => {
    // Skip the booking being rescheduled
    if (rescheduleBookingId && booking.id === rescheduleBookingId) {
      return false;
    }

    const bookingStart = parseInt(booking.time.split(':')[0]) * 60 + parseInt(booking.time.split(':')[1]);
    const bookingEnd = bookingStart + booking.duration;

    return (slotStart < bookingEnd && slotEnd > bookingStart);
  });

  if (hasConflict) {
    alert('השעה שבחרת כבר לא פנויה. המערכת תרענן את השעות הזמינות.');
    queryClient.invalidateQueries({ queryKey: ['existing-bookings', selectedStaff?.id, selectedDate] });
    setSelectedTime(null);
    bookingLockRef.current = false;
    setIsBooking(false);
    return;
  }

  // If rescheduling, just update the existing booking
  if (rescheduleBookingId) {
    
    // Fetch the current booking to get all details
    const currentBooking = await base44.entities.Booking.filter({ id: rescheduleBookingId });
    
    updateBookingMutation.mutate({
      id: rescheduleBookingId,
      data: {
        date: format(selectedDate, 'yyyy-MM-dd'),
        time: selectedTime,
        notes: notes,
        service_id: selectedService.id,
        service_name: selectedService.name,
        duration: selectedService.duration,
        staff_id: selectedStaff.id,
        staff_name: selectedStaff.name,
      },
      fullBooking: currentBooking[0]
    });
    return;
  }

  // Otherwise, create a new booking
  const clientBookings = await base44.entities.Booking.filter({
    business_id: selectedBusiness.id,
    client_phone: user.phone
  });
  
  const confirmedOrCompletedBookings = clientBookings.filter(
    b => b.status === 'confirmed' || b.status === 'completed'
  );

  const isFirstBooking = confirmedOrCompletedBookings.length === 0;
  
  const selectedWeekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
  const selectedWeekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 });
  
  const bookingsThisWeek = confirmedOrCompletedBookings.filter(booking => {
    const bookingDate = startOfDay(parseISO(booking.date));
    const isInWeek = bookingDate >= selectedWeekStart && bookingDate <= selectedWeekEnd;
    return isInWeek;
  });
  
  const hasBookingThisWeek = bookingsThisWeek.length > 0;
  // Check if business has access to newClientApproval feature (STARTER+)
  const hasApprovalFeature = businessPlan?.features?.newClientApproval || false;
  const requiresApproval = hasApprovalFeature && selectedBusiness.require_approval_for_new_clients !== false;

  let status = 'confirmed';

  if (hasBookingThisWeek) {
    status = 'pending_approval';
  } else if (isFirstBooking && requiresApproval) {
    status = 'pending_approval';
  }

  const bookingData = {
    business_id: selectedBusiness.id,
    client_phone: user.phone,
    client_name: user.name,
    staff_id: selectedStaff.id,
    staff_name: selectedStaff.name,
    service_id: selectedService.id,
    service_name: selectedService.name,
    date: format(selectedDate, 'yyyy-MM-dd'),
    time: selectedTime,
    duration: selectedService.duration,
    status: status,
    notes: notes,
    is_first_booking: isFirstBooking,
    booked_by_owner: false
  };

  bookingMutation.mutate(bookingData);
};

  const previousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  // Show loading screen while preparing reschedule
  if (rescheduleLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin text-[#FF6B35] mx-auto mb-4" />
          <p className="text-[#94A3B8] text-lg">טוען את התור...</p>
        </div>
      </div>
    );
  }

  if (success) {
    const calendarLink = generateGoogleCalendarLink({
      title: `תור ל${selectedService?.name || 'שירות'} ב${selectedBusiness?.name || 'העסק'}`,
      description: `לקוח: ${user?.name || user?.full_name || ''}\nטלפון: ${user?.phone || ''}\nשירות: ${selectedService?.name || ''}`,
      location: selectedBusiness?.address || '',
      startDate: selectedDate,
      startTime: selectedTime,
      duration: selectedService?.duration || 30
    });

    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-16 h-16 text-green-500" />
          </div>
          <h2 className="text-3xl font-bold mb-3">
            {isRescheduling ? 'התור עודכן!' : bookingStatus === 'pending_approval' ? 'נשלח לאישור' : 'התור נקבע!'}
          </h2>
          <p className="text-[#94A3B8] text-lg leading-relaxed mb-6">
            {isRescheduling
              ? `התור שלך עודכן ל-${format(selectedDate, 'd.M', { locale: he })} בשעה ${selectedTime}`
              : bookingStatus === 'pending_approval'
                ? 'התור שלך ממתין לאישור. נעדכן אותך ברגע שיאושר.'
                : `התור שלך ל-${format(selectedDate, 'd.M', { locale: he })} בשעה ${selectedTime}`
            }
          </p>

          {/* Add to Calendar Button */}
          <a
            href={calendarLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 w-full bg-[#1A1F35] hover:bg-[#252B45] text-white font-semibold py-3 px-6 rounded-xl border border-gray-700 transition-colors mb-4"
          >
            <CalendarPlus className="w-5 h-5" />
            הוסף ליומן Google
          </a>

          <div className="bg-[#1A1F35] rounded-xl p-4 border border-[#FF6B35]/30 text-right space-y-3">
             <p className="text-white text-sm font-medium leading-relaxed">
               לתשומת ליבך ניתן לבטל / לשנות את התור עד {selectedBusiness?.cancellation_hours_limit || 24} שעות לפני המועד שנקבע !!! אי הגעה לתור ללא הודעה מוקדמת תגרור חיוב מלא על השירות שנבחר !!!
             </p>
             <p className="text-[#FF6B35] text-sm font-bold">
               שים ❤ איחור לשעת התור יפגע באיכות השירות !!!
             </p>
          </div>
        </div>
      </div>
    );
  }

  // Waiting list success screen
  if (waitingListSuccess) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-6">
            <Bell className="w-16 h-16 text-blue-400" />
          </div>
          <h2 className="text-3xl font-bold mb-3 text-blue-400">
            נרשמת לרשימת ההמתנה!
          </h2>
          <p className="text-[#94A3B8] text-lg leading-relaxed mb-6">
            נרשמת לתאריך {format(selectedDate, 'd.M.yyyy', { locale: he })}
            {selectedService?.name && ` לשירות ${selectedService.name}`}
          </p>

          <div className="bg-[#1A1F35] rounded-xl p-4 border border-blue-500/30 text-center space-y-3">
             <p className="text-white text-sm font-medium leading-relaxed">
               נודיע לך בהודעת WhatsApp ברגע שיתפנה מקום 📱
             </p>
             <p className="text-blue-400 text-sm">
               מעבר לתורים שלי...
             </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => {
          if (step > 2) {
            if (step === 4 && staff.length === 1 && selectedStaff) {
              setSelectedStaff(null);
              setStep(2);
            } else {
              setStep(step - 1);
            }
          } else {
            navigate("/MyBookings");
          }
        }}
        className="flex items-center gap-2 text-[#94A3B8] mb-6 hover:text-white transition-colors h-12"
      >
        <ArrowRight className="w-5 h-5" />
        <span className="font-medium">חזרה</span>
      </button>

        {/* Progress with step labels */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-2 flex-1 rounded-full transition-all ${
                  s <= (step - 1) ? 'bg-gradient-to-r from-[#FF6B35] to-[#FF1744]' : 'bg-[#1A1F35]'
                }`}
              />
            ))}
          </div>
          <p className="text-center text-[#94A3B8] text-sm">
            {isRescheduling ? 'בחר תאריך ושעה חדשים' : `שלב ${step - 1} מתוך 4`}
          </p>
        </div>

        {/* Step 2: Select Service */}
        {step === 2 && (
          <div>
            <h1 className="text-3xl font-bold mb-2">איזה שירות?</h1>
            <p className="text-[#94A3B8] mb-6">ב-{selectedBusiness?.name}</p>
            {!selectedBusiness || servicesLoading ? (
              <div className="text-center py-12 bg-[#1A1F35] rounded-2xl border border-gray-800">
                <Loader2 className="w-12 h-12 text-[#FF6B35] mx-auto mb-3 animate-spin" />
                <p className="text-[#94A3B8]">טוען שירותים...</p>
              </div>
            ) : services.length === 0 ? (
              <div className="text-center py-12 bg-[#1A1F35] rounded-2xl border border-gray-800">
                <Briefcase className="w-12 h-12 text-[#94A3B8] mx-auto mb-3" />
                <p className="text-[#94A3B8] mb-2">אין שירותים זמינים כרגע</p>
              </div>
            ) : (
              <div className="space-y-3">
                {services.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => {
                      setSelectedService(service);
                      setSelectedStaff(null);
                      setStep(3);
                    }}
                    className="w-full bg-[#1A1F35] rounded-2xl p-5 text-right border-2 border-gray-800 hover:border-[#FF6B35] hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-lg">{service.name}</h3>
                      {service.price > 0 && (
                        <span className="text-[#FF6B35] font-bold text-lg">₪{service.price}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[#94A3B8] text-sm">
                      <Clock className="w-4 h-4" />
                      <span>{service.duration} דקות</span>
                    </div>
                    {service.description && (
                      <p className="text-[#94A3B8] text-sm mt-2 line-clamp-2">{service.description}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Select Staff - Only show if more than one */}
        {step === 3 && staff.length > 1 && (
          <div>
            <h1 className="text-3xl font-bold mb-2">עם מי?</h1>
            <p className="text-[#94A3B8] mb-6">{selectedService?.name}</p>
            <div className="space-y-3">
              {staff.map((staffMember) => (
                <button
                  key={staffMember.id}
                  onClick={() => {
                    setSelectedStaff(staffMember);
                    setStep(4);
                  }}
                  className="w-full bg-[#1A1F35] rounded-2xl p-5 text-right border-2 border-gray-800 hover:border-[#FF6B35] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-4"
                >
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FF1744] flex items-center justify-center flex-shrink-0">
                    <User className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="font-bold text-xl">{staffMember.name}</h3>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Select Date with Monthly Calendar */}
        {step === 4 && (
          <div>
            <h1 className="text-3xl font-bold mb-2">באיזה תאריך?</h1>
            <p className="text-[#94A3B8] mb-6">
              {selectedService?.name} • {selectedService?.duration} דקות
            </p>

            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-6 bg-[#1A1F35] rounded-2xl p-4 border border-gray-800">
              <button onClick={previousMonth} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <ChevronRight className="w-6 h-6" />
              </button>
              <h2 className="text-xl font-bold">
                {format(currentMonth, 'MMMM yyyy', { locale: he })}
              </h2>
              <button onClick={nextMonth} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <ChevronLeft className="w-6 h-6" />
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="bg-[#1A1F35] rounded-2xl p-4 border border-gray-800">
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map((day, i) => (
                  <div key={i} className="text-center text-[#94A3B8] text-sm font-medium py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar days */}
              <div className="grid grid-cols-7 gap-2">
                {/* Fill empty cells before month starts */}
                {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                
                {/* Month days */}
                {eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) }).map((date) => {
                  const dayIsToday = isToday(date);
                  const isPast = date < startOfDay(new Date());
                  const isAvailable = getAvailableDates().some(d => isSameDay(d, date));
                  
                  // Check booking window limit
                  const bookingWindowDays = selectedBusiness?.booking_window_days || 0;
                  const bookingWindowEnabled = selectedBusiness?.booking_window_enabled;
                  const maxDate = bookingWindowEnabled && bookingWindowDays > 0 
                    ? addDays(startOfDay(new Date()), bookingWindowDays)
                    : null;
                  const isBeyondWindow = maxDate && date > maxDate;
                  
                  return (
                    <button
                      key={date.toString()}
                      onClick={() => {
                        // Invalidate caches to force fresh fetch
                        queryClient.invalidateQueries({ queryKey: ['existing-bookings'] });
                        queryClient.invalidateQueries({ queryKey: ['schedule-overrides'] });
                        setSelectedDate(date);
                        setStep(5);
                      }}
                      disabled={isPast || !isAvailable || isBeyondWindow}
                      className={`aspect-square rounded-xl flex flex-col items-center justify-center transition-all ${
                        dayIsToday && isAvailable && !isPast && !isBeyondWindow
                          ? 'bg-gradient-to-r from-[#FF6B35] to-[#FF1744] text-white font-bold scale-105'
                          : isAvailable && !isPast && !isBeyondWindow
                            ? 'bg-[#0C0F1D] text-white hover:bg-[#FF6B35]/20 hover:scale-105'
                            : isBeyondWindow && isAvailable
                              ? 'bg-[#1A1F35]/30 text-[#94A3B8]/30 cursor-not-allowed border border-dashed border-gray-700'
                              : 'bg-[#1A1F35]/50 text-[#94A3B8]/50 cursor-not-allowed'
                      } ${selectedDate && isSameDay(selectedDate, date) && 'border-2 border-[#FF6B35]'}
                        disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <span className="text-lg">{format(date, 'd')}</span>
                      {isBeyondWindow && isAvailable && (
                        <span className="text-[8px] text-[#94A3B8]/50">🔒</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Booking window notice */}
            {selectedBusiness?.booking_window_enabled && selectedBusiness?.booking_window_days > 0 && (
              <div className="mt-4 p-3 bg-[#1A1F35] rounded-xl border border-gray-700 flex items-center gap-2 text-sm">
                <span className="text-lg">🔒</span>
                <span className="text-[#94A3B8]">
                  ניתן לקבוע תורים עד {selectedBusiness.booking_window_days} ימים מראש
                </span>
              </div>
            )}

            {getAvailableDates().length === 0 && (
              <div className="text-center py-12 bg-[#1A1F35] rounded-2xl border border-gray-800 mt-6">
                <Calendar className="w-16 h-16 text-[#94A3B8] mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">אין תאריכים זמינים בחודש זה</h3>
                <p className="text-[#94A3B8] mb-6">נסה לבחור חודש אחר</p>
                <Button
                  onClick={() => setStep(step - 1)}
                  className="h-12 px-6 rounded-xl"
                  style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
                >
                  חזור אחורה
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step 5: Select Time & Confirm */}
        {step === 5 && (
          <div>
            <h1 className="text-3xl font-bold mb-2">באיזו שעה?</h1>
            <p className="text-[#94A3B8] mb-6">
              {format(selectedDate, 'EEEE, d בMMMM', { locale: he })}
            </p>
            
            {generateTimeSlots().length === 0 ? (
              <div className="space-y-6">
                {/* Main message */}
                <div className="text-center py-8 bg-[#1A1F35] rounded-2xl border border-gray-800">
                  <Clock className="w-16 h-16 text-[#94A3B8] mx-auto mb-4" />
                  <h3 className="text-xl font-bold mb-2">אין שעות פנויות ל{selectedService?.name}</h3>
                  <p className="text-[#94A3B8]">ב-{format(selectedDate, 'd בMMMM', { locale: he })}</p>
                </div>

                {/* Waiting List Section - Only shown if business has PRO+ */}
                {hasWaitingListFeature && (
                <div className="bg-gradient-to-br from-[#1A1F35] to-[#0C0F1D] rounded-2xl p-5 border-2 border-blue-500/30">
                  <div className="flex items-center gap-2 mb-3">
                    <Bell className="w-5 h-5 text-blue-400" />
                    <h3 className="font-bold text-lg text-blue-400">רשימת המתנה</h3>
                  </div>

                  <p className="text-[#94A3B8] text-sm mb-4">
                    הצטרף לרשימת ההמתנה ונודיע לך בהודעת WhatsApp כשיתפנה מקום בטווח השעות שתבחר
                  </p>
                  <Button
                    onClick={() => setWaitingListModalOpen(true)}
                    className="w-full h-12 rounded-xl bg-blue-500 hover:bg-blue-600 font-medium"
                  >
                    <Bell className="w-4 h-4 ml-2" />
                    הצטרף לרשימת ההמתנה
                  </Button>
                </div>
                )}

                {/* Loading alternatives */}
                {alternativeSuggestions.loading && (
                  <div className="text-center py-8 bg-[#1A1F35] rounded-2xl border border-gray-800">
                    <Loader2 className="w-8 h-8 text-[#FF6B35] mx-auto mb-3 animate-spin" />
                    <p className="text-[#94A3B8]">מחפש אפשרויות אחרות...</p>
                  </div>
                )}

                {/* Alternative suggestions */}
                {!alternativeSuggestions.loading && (alternativeSuggestions.dates.length > 0 || alternativeSuggestions.services.length > 0) && (
                  <div className="bg-gradient-to-br from-[#1A1F35] to-[#0C0F1D] rounded-2xl p-5 border-2 border-[#FF6B35]/30">
                    <div className="flex items-center gap-2 mb-4">
                      <Lightbulb className="w-5 h-5 text-[#FF6B35]" />
                      <h3 className="font-bold text-lg">אפשרויות אחרות</h3>
                    </div>

                    {/* Alternative dates for same service */}
                    {alternativeSuggestions.dates.length > 0 && (
                      <div className="mb-5">
                        <div className="flex items-center gap-2 mb-3">
                          <Calendar className="w-4 h-4 text-[#94A3B8]" />
                          <p className="text-[#94A3B8] text-sm">תאריכים קרובים ל{selectedService?.name}:</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {alternativeSuggestions.dates.map((item, index) => (
                            <button
                              key={index}
                              onClick={() => {
                                setSelectedDate(item.date);
                                setAlternativeSuggestions({ services: [], dates: [], loading: false });
                              }}
                              className="flex items-center gap-2 px-4 py-3 bg-[#0C0F1D] rounded-xl border-2 border-gray-700 hover:border-[#FF6B35] transition-all hover:scale-105"
                            >
                              <span className="font-bold text-white">{format(item.date, 'd.M', { locale: he })}</span>
                              <span className="text-[#94A3B8] text-sm">({format(item.date, 'EEEE', { locale: he })})</span>
                              <span className="text-[#FF6B35] text-xs">{item.availableSlots} שעות</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Alternative services for same date */}
                    {alternativeSuggestions.services.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles className="w-4 h-4 text-[#94A3B8]" />
                          <p className="text-[#94A3B8] text-sm">שירותים זמינים ב-{format(selectedDate, 'd.M', { locale: he })}:</p>
                        </div>
                        <div className="space-y-2">
                          {alternativeSuggestions.services.map((service) => (
                            <button
                              key={service.id}
                              onClick={() => {
                                setSelectedService(service);
                                setSelectedTime(null);
                                setAlternativeSuggestions({ services: [], dates: [], loading: false });
                              }}
                              className="w-full flex items-center justify-between px-4 py-3 bg-[#0C0F1D] rounded-xl border-2 border-gray-700 hover:border-[#FF6B35] transition-all hover:scale-[1.02]"
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-white">{service.name}</span>
                                <span className="text-[#94A3B8] text-sm">({service.duration} דק')</span>
                              </div>
                              <span className="text-[#FF6B35] text-sm">{service.availableSlots} שעות</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* No alternatives found */}
                {!alternativeSuggestions.loading && alternativeSuggestions.dates.length === 0 && alternativeSuggestions.services.length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-[#94A3B8] text-sm mb-4">לא נמצאו אפשרויות נוספות בימים הקרובים</p>
                  </div>
                )}

                {/* Back button */}
                <Button
                  onClick={() => setStep(4)}
                  className="w-full h-12 rounded-xl"
                  style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
                >
                  בחר תאריך אחר
                </Button>
              </div>
            ) : (
              <>
                {/* Time slots without max-height restriction */}
                <div className="space-y-2 mb-4">
                  {generateTimeSlots().map((time) => (
                    <button
                      key={time}
                      onClick={() => setSelectedTime(time)}
                      className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 ${
                        selectedTime === time
                          ? 'bg-gradient-to-r from-[#FF6B35] to-[#FF1744] text-white scale-[1.02] shadow-lg'
                          : 'bg-[#1A1F35] text-white border-2 border-gray-800 hover:border-[#FF6B35] hover:scale-[1.01]'
                      }`}
                    >
                      <Clock className="w-5 h-5" />
                      <span>{time}</span>
                    </button>
                  ))}
                </div>

                {/* Waiting List Option - Only if business has PRO+ */}
                {hasWaitingListFeature && (
                <button
                  onClick={() => setWaitingListModalOpen(true)}
                  className="w-full py-3 px-4 rounded-xl bg-[#1A1F35]/50 border border-dashed border-blue-500/50 text-blue-400 hover:bg-blue-500/10 transition-all flex items-center justify-center gap-2 mb-6"
                >
                  <Bell className="w-4 h-4" />
                  <span className="text-sm">לא מתאים? הצטרף לרשימת המתנה לשעות אחרות</span>
                </button>
                )}

                {selectedTime && (
                  <>
                    <div className="bg-[#1A1F35] rounded-2xl p-5 mb-4 border border-gray-800">
                      <h3 className="font-bold mb-3 text-lg">רוצה להוסיף הערה?</h3>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="bg-[#0C0F1D] border-gray-700 text-white rounded-xl min-h-[80px] resize-none"
                        placeholder="למשל: בבקשה להזכיר לי יום לפני..."
                      />
                    </div>

                    <div className="bg-gradient-to-br from-[#1A1F35] to-[#0C0F1D] rounded-2xl p-6 mb-6 border-2 border-[#FF6B35]/30">
                      <h3 className="font-bold mb-4 text-lg flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-[#FF6B35]" />
                        סיכום התור
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[#94A3B8]">עסק</span>
                          <span className="text-white font-bold">{selectedBusiness?.name}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[#94A3B8]">שירות</span>
                          <span className="text-white font-bold">{selectedService?.name}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[#94A3B8]">תאריך</span>
                          <span className="text-white font-bold">
                            {format(selectedDate, 'd בMMMM yyyy', { locale: he })}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[#94A3B8]">שעה</span>
                          <span className="text-[#FF6B35] font-bold text-xl">{selectedTime}</span>
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t border-gray-700">
                          <span className="text-[#94A3B8]">משך</span>
                          <span className="text-white font-bold">{selectedService?.duration} דקות</span>
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={handleBooking}
                      disabled={isBooking || bookingMutation.isPending || updateBookingMutation.isPending}
                      className="w-full h-16 rounded-xl text-white font-bold text-xl hover:scale-105 active:scale-95 transition-transform shadow-2xl"
                      style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
                    >
                      {(isBooking || bookingMutation.isPending || updateBookingMutation.isPending) ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : isRescheduling ? (
                        'עדכן את התור'
                      ) : (
                        'קבע את התור'
                      )}
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        )}

      {/* Waiting List Modal */}
      <WaitingListModal
        isOpen={waitingListModalOpen}
        onClose={() => setWaitingListModalOpen(false)}
        business={selectedBusiness}
        services={services}
        selectedService={selectedService}
        selectedDate={selectedDate}
        selectedStaff={selectedStaff}
        existingBookings={existingBookings || []}
        user={user}
        onJoin={joinWaitingList}
        getScheduleForDate={getScheduleForDate}
      />
    </>
  );
}