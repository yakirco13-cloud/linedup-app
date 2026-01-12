import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useUser } from "@/components/UserContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Loader2, CheckCircle, UserPlus, Users, Search, Clock, Bell, BellOff, Repeat, Calendar } from "lucide-react";
import { format, addDays, addWeeks, getDay } from "date-fns";
import { he } from "date-fns/locale";

// Import centralized services
import { sendConfirmation, sendUpdate } from "@/services/whatsappService";
import { formatNumeric } from "@/services/dateService";

export default function CreateBooking() {
  const navigate = useNavigate();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const submitLockRef = useRef(false); // Synchronous lock to prevent double-submit
  const [success, setSuccess] = useState(false);
  const [clientType, setClientType] = useState('existing');
  const [editMode, setEditMode] = useState(false);
  const [editingBookingId, setEditingBookingId] = useState(null);
  const [clientSearch, setClientSearch] = useState("");
  const [conflictWarning, setConflictWarning] = useState(null);
  const [selectedHour, setSelectedHour] = useState('09');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [urlParamsProcessed, setUrlParamsProcessed] = useState(false);
  const [sendNotification, setSendNotification] = useState(false); // Toggle for walk-in notifications
  
  // Recurring appointment states
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState('weekly');
  const [recurringPreview, setRecurringPreview] = useState([]);
  const [creatingRecurring, setCreatingRecurring] = useState(false);

  const [formData, setFormData] = useState({
    client_name: "",
    client_email: "",
    client_phone: "",
    service_id: "",
    staff_id: "",
    date: "",
    notes: ""
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const dateParam = urlParams.get('date');
    const timeParam = urlParams.get('time');
    const editParam = urlParams.get('edit');
    
    if (dateParam) {
      setFormData(prev => ({ ...prev, date: dateParam }));
    }
    
    if (timeParam) {
      const [h, m] = timeParam.split(':');
      setSelectedHour(h);
      setSelectedMinute(m || '00');
    }
    
    if (editParam) {
      setEditMode(true);
      setEditingBookingId(editParam);
      loadBookingForEdit(editParam);
    }
    
    setUrlParamsProcessed(true);
  }, []);

  const loadBookingForEdit = async (bookingId) => {
    const bookings = await base44.entities.Booking.filter({ id: bookingId });
    if (bookings.length > 0) {
      const booking = bookings[0];
      const [h, m] = booking.time.split(':');
      setSelectedHour(h);
      setSelectedMinute(m);
      setFormData({
        client_name: booking.client_name,
        client_email: booking.client_email,
        client_phone: booking.client_phone || "", // Keep phone from booking
        service_id: booking.service_id,
        staff_id: booking.staff_id,
        date: booking.date,
        notes: booking.notes || ""
      });
      if (booking.client_email && !booking.client_email.includes('walkin_')) {
        setClientType('existing');
      } else {
        setClientType('walkin');
      }
    }
  };

  const { data: business } = useQuery({
    queryKey: ['business', user?.business_id],
    queryFn: async () => {
      const businesses = await base44.entities.Business.filter({ id: user.business_id });
      return businesses[0];
    },
    enabled: !!user?.business_id,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services', business?.id],
    queryFn: () => base44.entities.Service.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['staff', business?.id],
    queryFn: () => base44.entities.Staff.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });

  const { data: previousClients = [] } = useQuery({
    queryKey: ['previous-clients', business?.id],
    queryFn: async () => {
      const bookings = await base44.entities.Booking.filter({ business_id: business.id });
      const uniqueClients = {};
      
      bookings.forEach(booking => {
        // Use phone as primary identifier for clients
        // Skip walkin bookings (no phone or walkin email pattern)
        const isWalkin = booking.client_email?.includes('walkin_');
        
        if (booking.client_name && booking.client_phone && !isWalkin) {
          if (!uniqueClients[booking.client_phone]) {
            uniqueClients[booking.client_phone] = {
              name: booking.client_name,
              email: booking.client_email || "",
              phone: booking.client_phone
            };
          }
        }
      });
      
      return Object.values(uniqueClients);
    },
    enabled: !!business?.id,
  });

  // Get all bookings for conflict checking
  const { data: allBookings = [] } = useQuery({
    queryKey: ['all-bookings'], // Changed from all-bookings-check to all-bookings for consistency with invalidateQueries
    queryFn: () => base44.entities.Booking.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });

  useEffect(() => {
    if (staff.length === 1 && !formData.staff_id) {
      setFormData(prev => ({ ...prev, staff_id: staff[0].id }));
    }
  }, [staff, formData.staff_id]);

  // Initialize date/time with defaults ONLY if URL params were not provided
  useEffect(() => {
    if (!urlParamsProcessed) return;
    
    if (!formData.date) {
      setFormData(prev => ({ ...prev, date: new Date().toISOString().split('T')[0] }));
    }
    
    // Only set default hour if selectedHour is still its initial default ('09') AND no time param was provided
    if (selectedHour === '09') { 
      const urlParams = new URLSearchParams(window.location.search);
      const timeParam = urlParams.get('time');
      
      if (!timeParam) {
        const now = new Date();
        const nextHour = now.getHours() + 1;
        // Ensure time is within a reasonable range (e.g., 08:00 to 21:00 for hourOptions)
        const defaultHour = Math.min(21, Math.max(8, nextHour)); 
        setSelectedHour(String(defaultHour).padStart(2, '0'));
      }
    }
  }, [urlParamsProcessed, formData.date, selectedHour]);

  const selectedService = services.find(s => s.id === formData.service_id);
  const selectedClient = previousClients.find(c => c.email === formData.client_email); // Added selectedClient
  const selectedTime = `${selectedHour}:${selectedMinute}`;

  const checkTimeConflict = (date, time, duration) => {
    if (!date || !time || !duration) return [];

    const appointmentStart = new Date(`${date}T${time}`);
    const appointmentEnd = new Date(appointmentStart.getTime() + duration * 60000);
    
    return allBookings.filter(apt => {
      // Exclude appointments that are cancelled or are the current one being edited
      if (apt.status === 'cancelled' || (editMode && apt.id === editingBookingId)) {
        return false;
      }
      
      const existingStart = new Date(`${apt.date}T${apt.time}`);
      const existingEnd = new Date(existingStart.getTime() + apt.duration * 60000);
      
      return (
        (appointmentStart < existingEnd && appointmentEnd > existingStart) // Standard overlap condition
      );
    });
  };

  // Calculate recurring dates based on booking window
  const calculateRecurringDates = () => {
    if (!formData.date || !isRecurring) return [];
    
    const startDate = new Date(formData.date);
    const dayOfWeek = getDay(startDate);
    const bookingWindowDays = business?.booking_window_enabled ? (business?.booking_window_days || 30) : 90;
    const maxDate = addDays(new Date(), bookingWindowDays);
    
    const dates = [];
    let currentDate = startDate;
    
    while (currentDate <= maxDate) {
      dates.push(new Date(currentDate));
      
      if (recurringFrequency === 'weekly') {
        currentDate = addWeeks(currentDate, 1);
      } else if (recurringFrequency === 'biweekly') {
        currentDate = addWeeks(currentDate, 2);
      }
    }
    
    return dates;
  };

  // Update recurring preview when date/frequency changes
  useEffect(() => {
    if (isRecurring && formData.date) {
      const dates = calculateRecurringDates();
      setRecurringPreview(dates);
    } else {
      setRecurringPreview([]);
    }
  }, [isRecurring, formData.date, recurringFrequency, business?.booking_window_days]);

  // Check for conflicts when date/time/service changes
  useEffect(() => {
    if (formData.date && selectedTime && selectedService?.duration) {
      const conflicts = checkTimeConflict(formData.date, selectedTime, selectedService.duration);
      if (conflicts.length > 0) {
        setConflictWarning(conflicts[0]);
      } else {
        setConflictWarning(null);
      }
    } else {
      setConflictWarning(null); // Clear warning if essential data is missing
    }
  }, [formData.date, selectedHour, selectedMinute, selectedService, allBookings, editMode, editingBookingId]);


  const bookingMutation = useMutation({
    mutationFn: async (data) => {
      if (editMode) {
        return base44.entities.Booking.update(editingBookingId, data);
      }
      return base44.entities.Booking.create(data);
    },
    onSuccess: async (data) => {
      // Send WhatsApp notification if:
      // 1. Client has phone number AND
      // 2. Either it's not a walk-in OR sendNotification is enabled for walk-in
      const clientPhone = formData.client_phone || data.client_phone;
      const isWalkin = formData.client_email?.includes('walkin_');
      const shouldSendNotification = clientPhone && (!isWalkin || (isWalkin && sendNotification));
      
      if (shouldSendNotification) {
        if (editMode) {
          await sendUpdate({
            phone: clientPhone,
            clientName: formData.client_name,
            businessName: business.name
          });
        } else {
          await sendConfirmation({
            phone: clientPhone,
            clientName: formData.client_name,
            businessName: business.name,
            date: formData.date,
            time: selectedTime
          });
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['all-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['recurring-appointments'] });
      submitLockRef.current = false; // Reset lock on success
      setSuccess(true);
      setTimeout(() => {
        navigate(createPageUrl("CalendarView"));
      }, 1500);
    },
    onError: (error) => {
      console.error('❌ Booking failed:', error);
      submitLockRef.current = false; // Reset lock on error
      alert('שגיאה ביצירת התור. אנא נסה שנית.');
    },
  });

  // Create recurring appointment rule and all initial bookings
  const createRecurringAppointment = async () => {
    if (!isRecurring || recurringPreview.length === 0) return null;
    
    setCreatingRecurring(true);
    
    try {
      const selectedStaff = staff.find(s => s.id === formData.staff_id);
      const dayOfWeek = getDay(new Date(formData.date));
      
      // 1. Create the recurring rule
      const recurringRule = await base44.entities.RecurringAppointment.create({
        business_id: business.id,
        client_phone: formData.client_phone || "",
        client_name: formData.client_name,
        service_id: formData.service_id,
        service_name: selectedService?.name,
        staff_id: formData.staff_id,
        staff_name: selectedStaff?.name,
        day_of_week: dayOfWeek,
        time: selectedTime,
        duration: selectedService?.duration || 30,
        frequency: recurringFrequency,
        biweekly_start_date: recurringFrequency === 'biweekly' ? formData.date : null,
        is_active: true,
        notes: formData.notes,
        last_booking_date: recurringPreview[recurringPreview.length - 1].toISOString().split('T')[0]
      });
      
      console.log('✅ Created recurring rule:', recurringRule);
      
      // 2. Create all the bookings
      const bookingsCreated = [];
      for (const date of recurringPreview) {
        try {
          const dateStr = format(date, 'yyyy-MM-dd');
          const bookingData = {
            business_id: business.id,
            client_name: formData.client_name,
            client_phone: formData.client_phone || "",
            service_id: formData.service_id,
            service_name: selectedService?.name,
            staff_id: formData.staff_id,
            staff_name: selectedStaff?.name,
            date: dateStr,
            time: selectedTime,
            duration: selectedService?.duration || 30,
            status: 'confirmed',
            notes: formData.notes,
            is_first_booking: false,
            booked_by_owner: true
          };
          
          const booking = await base44.entities.Booking.create(bookingData);
          bookingsCreated.push(booking);
          console.log(`✅ Created booking for ${dateStr}`);
        } catch (error) {
          console.error(`❌ Failed to create booking for ${format(date, 'yyyy-MM-dd')}:`, error);
        }
      }
      
      // 3. Send single WhatsApp confirmation for recurring (only if phone exists and notifications enabled)
      if (formData.client_phone && sendNotification) {
        await sendConfirmation({
          phone: formData.client_phone,
          clientName: formData.client_name,
          businessName: business.name,
          date: formData.date,
          time: selectedTime,
          serviceName: `${selectedService?.name} (תור חוזר - ${recurringPreview.length} תורים)`
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['all-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['recurring-appointments'] });
      
      submitLockRef.current = false; // Reset lock on success
      setSuccess(true);
      setTimeout(() => {
        navigate(createPageUrl("CalendarView"));
      }, 1500);
      
      return { rule: recurringRule, bookings: bookingsCreated };
    } catch (error) {
      console.error('❌ Failed to create recurring appointment:', error);
      submitLockRef.current = false; // Reset lock on error
      alert('שגיאה ביצירת תור חוזר. אנא נסה שנית.');
      throw error;
    } finally {
      setCreatingRecurring(false);
    }
  };

  const handleClientSelect = (clientPhone) => {
    const client = previousClients.find(c => c.phone === clientPhone);
    if (client) {
      setFormData(prev => ({
        ...prev,
        client_name: client.name,
        client_email: client.email,
        client_phone: client.phone || ""
      }));
      setClientSearch(""); // Clear search after selection
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Synchronous lock check - prevents double-submit
    if (submitLockRef.current) {
      console.log('⚠️ Submit already in progress (ref), ignoring');
      return;
    }
    
    // Lock immediately
    submitLockRef.current = true;

    // Check for conflicts and show warning
    if (conflictWarning) {
      const conflictBookingEnd = new Date(`${conflictWarning.date}T${conflictWarning.time}`);
      conflictBookingEnd.setMinutes(conflictBookingEnd.getMinutes() + conflictWarning.duration);
      
      const newBookingStart = new Date(`${formData.date}T${selectedTime}`);
      const newBookingEnd = new Date(newBookingStart.getTime() + (selectedService?.duration || 30) * 60000);
      
      const shouldContinue = window.confirm(
        `⚠️ אזהרה: יש חפיפה עם תור קיים!\n\n` +
        `תור קיים: ${conflictWarning.client_name}\n` +
        `שעה: ${conflictWarning.time} (${conflictWarning.duration} דקות)\n` +
        `שירות: ${conflictWarning.service_name}\n\n` +
        `התור החדש:\n` +
        `שעה: ${selectedTime} (${selectedService?.duration || 30} דקות)\n\n` +
        `האם להמשיך בכל זאת?`
      );
      
      if (!shouldContinue) {
        submitLockRef.current = false; // Unlock on cancel
        return;
      }
    }

    // If recurring is enabled, use the recurring flow
    if (isRecurring && recurringPreview.length > 0) {
      await createRecurringAppointment();
      return;
    }

    const selectedStaff = staff.find(s => s.id === formData.staff_id);

    const bookingData = {
      business_id: business.id,
      client_name: formData.client_name,
      client_phone: formData.client_phone || "",
      staff_id: formData.staff_id,
      staff_name: selectedStaff?.name || "",
      service_id: formData.service_id,
      service_name: selectedService?.name || "",
      date: formData.date,
      time: selectedTime,
      duration: selectedService?.duration || 30,
      status: 'confirmed',
      notes: formData.notes,
      is_first_booking: false,
      booked_by_owner: true
    };

    bookingMutation.mutate(bookingData);
  };

  // Filter clients based on search
  const filteredClients = previousClients.filter(client =>
    client.name.toLowerCase().includes(clientSearch.toLowerCase()) || 
    client.email.toLowerCase().includes(clientSearch.toLowerCase())
  );

  // Time selection options
  const hourOptions = Array.from({ length: 14 }, (_, i) => String(i + 8).padStart(2, '0')); // From 08 to 21
  const minuteOptions = ['00', '15', '30', '45'];

  if (success) {
    return (
      <div className="min-h-screen bg-[#0C0F1D] flex items-center justify-center p-6">
        <div className="text-center">
          <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-2">
            {editMode ? 'התור עודכן בהצלחה!' : 
             isRecurring ? `נקבעו ${recurringPreview.length} תורים בהצלחה!` : 
             'התור נקבע בהצלחה!'}
          </h2>
          <p className="text-[#94A3B8]">חוזר ליומן...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0C0F1D] p-6">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate(createPageUrl("CalendarView"))}
          className="flex items-center gap-2 text-[#94A3B8] mb-6 hover:text-white transition-colors py-2 px-1 -ml-1 min-h-[44px]"
        >
          <ArrowRight className="w-5 h-5" />
          <span>חזרה</span>
        </button>

        <h1 className="text-3xl font-bold mb-8">{editMode ? 'ערוך תור' : 'תור חדש'}</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {!editMode && (
            <div className="bg-[#1A1F35] rounded-2xl p-6 border border-gray-800">
              <h2 className="text-xl font-bold mb-4">סוג לקוח</h2>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => setClientType('existing')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    clientType === 'existing'
                      ? 'border-[#FF6B35] bg-[#FF6B35]/10'
                      : 'border-gray-700 bg-[#0C0F1D]'
                  }`}
                >
                  <Users className="w-6 h-6 mx-auto mb-2 text-[#FF6B35]" />
                  <p className="font-medium text-white text-sm">לקוח קיים</p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setClientType('walkin');
                    setFormData(prev => ({ ...prev, client_email: '', client_name: '', client_phone: '' }));
                  }}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    clientType === 'walkin'
                      ? 'border-[#FF6B35] bg-[#FF6B35]/10'
                      : 'border-gray-700 bg-[#0C0F1D]'
                  }`}
                >
                  <UserPlus className="w-6 h-6 mx-auto mb-2 text-[#FF6B35]" />
                  <p className="font-medium text-white text-sm">לקוח חדש/Walk-in</p>
                </button>
              </div>

              {clientType === 'existing' ? (
                <div className="space-y-3">
                  {!formData.client_email ? (
                    <>
                      <Label htmlFor="client_search" className="text-white">חפש לקוח</Label>
                      <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                        <Input
                          id="client_search"
                          type="text"
                          value={clientSearch}
                          onChange={(e) => setClientSearch(e.target.value)}
                          className="bg-[#0C0F1D] border-gray-700 text-white h-12 rounded-xl pr-11"
                          placeholder="הקלד שם לקוח"
                        />
                      </div>

                      <div className="max-h-64 overflow-y-auto space-y-2 mt-3">
                        {filteredClients.length === 0 ? (
                          <p className="text-[#94A3B8] text-sm text-center py-4">לא נמצאו לקוחות</p>
                        ) : (
                          filteredClients.map((client, index) => (
                            <button
                              key={client.phone || `client-${index}`}
                              type="button"
                              onClick={() => handleClientSelect(client.phone)}
                              className="w-full text-right p-4 rounded-xl transition-all bg-[#0C0F1D] border-2 border-gray-700 hover:border-[#FF6B35]"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FF1744] flex items-center justify-center text-lg font-bold text-white flex-shrink-0">
                                  {client.name[0]?.toUpperCase() || 'N/A'}
                                </div>
                                <div className="flex-1 min-w-0 text-right">
                                  <p className="font-semibold text-base text-white mb-0.5">{client.name}</p>
                                  {client.phone && (
                                    <p className="text-xs text-[#94A3B8]">{client.phone}</p>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <Label className="text-white">לקוח נבחר</Label>
                      <div className="bg-[#0C0F1D] border-2 border-[#FF6B35] rounded-xl p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FF1744] flex items-center justify-center text-lg font-bold text-white flex-shrink-0">
                              {formData.client_name[0]?.toUpperCase() || 'N/A'}
                            </div>
                            <div className="flex-1 min-w-0 text-right">
                              <p className="font-semibold text-base text-white mb-0.5">{formData.client_name}</p>
                              {formData.client_phone && (
                                <p className="text-xs text-[#94A3B8]">{formData.client_phone}</p>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, client_email: '', client_name: '', client_phone: '' }))}
                            className="text-[#FF6B35] hover:text-white text-sm font-medium"
                          >
                            שנה
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="client_name" className="text-white">שם הלקוח *</Label>
                    <Input
                      id="client_name"
                      value={formData.client_name}
                      onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                      className="bg-[#0C0F1D] border-gray-700 text-white h-12 rounded-xl"
                      placeholder="שם מלא"
                      required
                    />
                  </div>

                  {/* Send Notification Toggle */}
                  <div className="flex items-center justify-between bg-[#0C0F1D] rounded-xl p-4 border border-gray-700">
                    <div className="flex items-center gap-3">
                      {sendNotification ? (
                        <Bell className="w-5 h-5 text-[#FF6B35]" />
                      ) : (
                        <BellOff className="w-5 h-5 text-[#94A3B8]" />
                      )}
                      <div>
                        <p className="text-white font-medium">שלח הודעת אישור</p>
                        <p className="text-xs text-[#94A3B8]">שלח ללקוח הודעת WhatsApp</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSendNotification(!sendNotification);
                        if (!sendNotification) {
                          // Clearing phone when turning off notifications
                        } else {
                          setFormData(prev => ({ ...prev, client_phone: '' }));
                        }
                      }}
                      className={`relative w-14 h-8 rounded-full transition-colors ${
                        sendNotification ? 'bg-[#FF6B35]' : 'bg-gray-600'
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform ${
                          sendNotification ? 'right-1' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Phone field - only shown when sendNotification is true */}
                  {sendNotification && (
                    <div className="space-y-2">
                      <Label htmlFor="client_phone" className="text-white">טלפון *</Label>
                      <Input
                        id="client_phone"
                        type="tel"
                        value={formData.client_phone}
                        onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })}
                        className="bg-[#0C0F1D] border-gray-700 text-white h-12 rounded-xl"
                        placeholder="050-1234567"
                        required
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {editMode && (
            <div className="bg-[#1A1F35] rounded-2xl p-6 border border-gray-800">
              <h2 className="text-xl font-bold mb-4">לקוח</h2>
              <p className="text-white text-lg">{formData.client_name}</p>
              {formData.client_email && !formData.client_email.includes('walkin_') && (
                <p className="text-[#94A3B8] text-sm">{formData.client_email}</p>
              )}
            </div>
          )}

          {/* Appointment Details */}
          <div className="bg-[#1A1F35] rounded-2xl p-6 border border-gray-800">
            <h2 className="text-xl font-bold mb-4">פרטי התור</h2>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="service" className="text-white">שירות *</Label>
                <Select
                  value={formData.service_id}
                  onValueChange={(value) => setFormData({ ...formData, service_id: value })}
                  required
                >
                  <SelectTrigger className="bg-[#0C0F1D] border-gray-700 text-white h-12 rounded-xl [&>span]:text-right [&>span]:flex-1">
                    <SelectValue placeholder="בחר שירות" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name} ({service.duration} דקות)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {selectedService && (
                  <div className="flex items-center gap-3 text-sm pt-2">
                    {selectedService.price > 0 && (
                      <span className="text-[#FF6B35] font-bold text-lg">₪{selectedService.price}</span>
                    )}
                    {selectedService.price > 0 && <span className="text-[#94A3B8]">•</span>}
                    <span className="text-[#94A3B8]">{selectedService.duration} דקות</span>
                  </div>
                )}
              </div>

              {staff.length > 1 && (
                <div className="space-y-2">
                  <Label htmlFor="staff" className="text-white">עובד *</Label>
                  <Select
                    value={formData.staff_id}
                    onValueChange={(value) => setFormData({ ...formData, staff_id: value })}
                    required
                  >
                    <SelectTrigger className="bg-[#0C0F1D] border-gray-700 text-white h-12 rounded-xl [&>span]:text-right [&>span]:flex-1">
                      <SelectValue placeholder="בחר עובד" />
                    </SelectTrigger>
                    <SelectContent>
                      {staff.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="date" className="text-white">תאריך *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="bg-[#0C0F1D] border-gray-700 text-white h-12 rounded-xl"
                  required
                />
              </div>

              {/* Time Picker with 15-minute intervals */}
              <div className="space-y-2">
                <Label className="text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#FF6B35]" />
                  שעה *
                </Label>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#94A3B8] mb-1 block">שעה</label>
                    <Select value={selectedHour} onValueChange={setSelectedHour}>
                      <SelectTrigger className="bg-[#0C0F1D] border-gray-700 text-white h-12 rounded-xl [&>span]:text-right [&>span]:flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {hourOptions.map(h => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-xs text-[#94A3B8] mb-1 block">דקות</label>
                    <Select value={selectedMinute} onValueChange={setSelectedMinute}>
                      <SelectTrigger className="bg-[#0C0F1D] border-gray-700 text-white h-12 rounded-xl [&>span]:text-right [&>span]:flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {minuteOptions.map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="mt-2 text-center">
                  <span className="text-2xl font-bold text-[#FF6B35]">
                    {selectedHour}:{selectedMinute}
                  </span>
                </div>
              </div>

              {conflictWarning && (
                <div className="bg-yellow-500/10 border-2 border-yellow-500/50 rounded-xl p-4">
                  <p className="text-yellow-400 text-sm font-medium">
                    ⚠️ יש תור חופף עם {conflictWarning.client_name} ב-{conflictWarning.time}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-white">הערות</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="bg-[#0C0F1D] border-gray-700 text-white rounded-xl min-h-[100px]"
                  placeholder="הערות נוספות..."
                />
              </div>
            </div>
          </div>

          {/* Recurring Appointment Section - Only show for new bookings (not edit mode) */}
          {!editMode && formData.date && (
            <div className="bg-[#1A1F35] rounded-2xl p-6 border border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Repeat className={`w-6 h-6 ${isRecurring ? 'text-[#FF6B35]' : 'text-[#94A3B8]'}`} />
                  <div>
                    <h2 className="text-xl font-bold">תור חוזר</h2>
                    <p className="text-sm text-[#94A3B8]">קבע תורים אוטומטיים לאותו יום ושעה</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRecurring(!isRecurring)}
                  className={`relative w-14 h-8 rounded-full transition-colors ${
                    isRecurring ? 'bg-[#FF6B35]' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform ${
                      isRecurring ? 'right-1' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {isRecurring && (
                <div className="space-y-4 mt-4 pt-4 border-t border-gray-700">
                  {/* Frequency Selection */}
                  <div className="space-y-2">
                    <Label className="text-white">תדירות</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setRecurringFrequency('weekly')}
                        className={`p-3 rounded-xl border-2 transition-all ${
                          recurringFrequency === 'weekly'
                            ? 'border-[#FF6B35] bg-[#FF6B35]/10'
                            : 'border-gray-700 bg-[#0C0F1D]'
                        }`}
                      >
                        <span className="text-white font-medium">כל שבוע</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecurringFrequency('biweekly')}
                        className={`p-3 rounded-xl border-2 transition-all ${
                          recurringFrequency === 'biweekly'
                            ? 'border-[#FF6B35] bg-[#FF6B35]/10'
                            : 'border-gray-700 bg-[#0C0F1D]'
                        }`}
                      >
                        <span className="text-white font-medium">כל שבועיים</span>
                      </button>
                    </div>
                  </div>

                  {/* Preview of recurring dates */}
                  {recurringPreview.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-white flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-[#FF6B35]" />
                        תורים שייקבעו ({recurringPreview.length} תורים)
                      </Label>
                      <div className="bg-[#0C0F1D] rounded-xl p-3 max-h-40 overflow-y-auto">
                        <div className="space-y-2">
                          {recurringPreview.map((date, index) => (
                            <div key={index} className="flex items-center justify-between text-sm">
                              <span className="text-white">
                                {format(date, 'EEEE', { locale: he })}
                              </span>
                              <span className="text-[#94A3B8]">
                                {format(date, 'd/M/yyyy')} בשעה {selectedHour}:{selectedMinute}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-[#94A3B8]">
                        💡 תורים חדשים ייקבעו אוטומטית כשיפתחו תאריכים נוספים
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Appointment Summary */}
          {(selectedService && formData.date && selectedTime && formData.client_name) && (
            <div className="bg-[#1A1F35] border-2 border-gray-800 rounded-2xl p-5">
              <h3 className="text-sm font-semibold mb-4 text-[#94A3B8]">סיכום התור</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#94A3B8]">לקוח</span>
                  <span className="font-semibold">{formData.client_name}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#94A3B8]">שירות</span>
                  <span className="font-semibold">{selectedService.name}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#94A3B8]">מועד</span>
                  <span className="font-semibold">
                    {formatNumeric(formData.date)}, {selectedTime}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#94A3B8]">משך</span>
                  <span className="font-semibold">{selectedService.duration} דקות</span>
                </div>
                
                {selectedService.price > 0 && (
                  <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                    <span className="text-sm text-[#94A3B8]">מחיר</span>
                    <span className="text-2xl font-bold text-[#FF6B35]">₪{selectedService.price}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <Button
            type="submit"
            disabled={
              bookingMutation.isPending || 
              creatingRecurring ||
              !formData.service_id || 
              !formData.date || 
              !selectedHour ||
              !selectedMinute ||
              !formData.client_name || // Client name is required
              (clientType === 'walkin' && sendNotification && !formData.client_phone) // Phone required only if notifications enabled
            }
            className="w-full h-14 rounded-xl text-white font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
          >
            {bookingMutation.isPending || creatingRecurring ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin" />
                {creatingRecurring && <span>יוצר {recurringPreview.length} תורים...</span>}
              </div>
            ) : (
              editMode ? 'עדכן תור' : 
              isRecurring ? `צור ${recurringPreview.length} תורים חוזרים` : 
              'צור תור'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}