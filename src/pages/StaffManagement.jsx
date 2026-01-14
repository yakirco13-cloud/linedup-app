import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useUser } from "@/components/UserContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Plus, Trash2, Users, Clock, Loader2, Copy, Pencil, Lock } from "lucide-react";
import { useFeatureGate } from "@/components/FeatureGate";
import UpgradeModal from "@/components/UpgradeModal";

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export default function StaffManagement() {
  const navigate = useNavigate();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [useBusinessHours, setUseBusinessHours] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const { hasAccess: canAddMultipleStaff } = useFeatureGate('multipleStaff');

  const [formData, setFormData] = useState({
    name: ""
  });

  const [schedule, setSchedule] = useState({
    sunday: { enabled: true, shifts: [{ start: "09:00", end: "17:00" }] },
    monday: { enabled: true, shifts: [{ start: "09:00", end: "17:00" }] },
    tuesday: { enabled: true, shifts: [{ start: "09:00", end: "17:00" }] },
    wednesday: { enabled: true, shifts: [{ start: "09:00", end: "17:00" }] },
    thursday: { enabled: true, shifts: [{ start: "09:00", end: "17:00" }] },
    friday: { enabled: false, shifts: [{ start: "09:00", end: "14:00" }] },
    saturday: { enabled: false, shifts: [{ start: "09:00", end: "17:00" }] },
  });

  const { data: business } = useQuery({
    queryKey: ['business', user?.business_id],
    queryFn: async () => {
      const businesses = await base44.entities.Business.filter({ id: user.business_id });
      return businesses[0];
    },
    enabled: !!user?.business_id,
  });

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['staff', business?.id],
    queryFn: async () => {
      const allStaff = await base44.entities.Staff.filter({ business_id: business.id });
      console.log('Loaded staff:', allStaff);
      return allStaff;
    },
    enabled: !!business?.id,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Staff.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Staff.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Staff.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });

  const resetForm = () => {
    setFormData({ name: "" });
    setSchedule({
      sunday: { enabled: true, shifts: [{ start: "09:00", end: "17:00" }] },
      monday: { enabled: true, shifts: [{ start: "09:00", end: "17:00" }] },
      tuesday: { enabled: true, shifts: [{ start: "09:00", end: "17:00" }] },
      wednesday: { enabled: true, shifts: [{ start: "09:00", end: "17:00" }] },
      thursday: { enabled: true, shifts: [{ start: "09:00", end: "17:00" }] },
      friday: { enabled: false, shifts: [{ start: "09:00", end: "14:00" }] },
      saturday: { enabled: false, shifts: [{ start: "09:00", end: "17:00" }] },
    });
    setUseBusinessHours(true);
    setShowForm(false);
    setEditingStaff(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // If using business hours, copy ALL shifts from business
    let finalSchedule = schedule;
    if (useBusinessHours && business?.working_hours) {
      console.log('Converting business hours to staff schedule...');
      console.log('Business working hours:', business.working_hours);
      
      finalSchedule = {};
      DAY_KEYS.forEach(dayKey => {
        const businessDay = business.working_hours[dayKey];
        if (businessDay && businessDay.shifts && Array.isArray(businessDay.shifts) && businessDay.shifts.length > 0) {
          // Copy ALL shifts from business - not just the range!
          finalSchedule[dayKey] = {
            enabled: businessDay.enabled,
            shifts: businessDay.shifts.map(shift => ({ start: shift.start, end: shift.end }))
          };
          console.log(`${dayKey}: Copied ${businessDay.shifts.length} shifts`);
        } else if (businessDay && businessDay.start && businessDay.end) {
          // Fallback for business hours in old format (single start/end)
          finalSchedule[dayKey] = {
            enabled: businessDay.enabled,
            shifts: [{ start: businessDay.start, end: businessDay.end }]
          };
          console.log(`${dayKey}: Converted old business format to single shift.`);
        }
        else {
          // Fallback - use default (disabled with one default shift)
          finalSchedule[dayKey] = {
            enabled: false,
            shifts: [{ start: "09:00", end: "17:00" }]
          };
          console.log(`${dayKey}: Business day undefined or no shifts, using default.`);
        }
      });
      
      console.log('Final staff schedule:', finalSchedule);
    }
    
    const staffData = {
      business_id: business.id,
      name: formData.name,
      schedule: finalSchedule,
      uses_business_hours: useBusinessHours
    };

    console.log('Submitting staff data:', staffData);

    if (editingStaff) {
      updateMutation.mutate({ id: editingStaff.id, data: staffData });
    } else {
      createMutation.mutate(staffData);
    }
  };

  const handleEdit = (staffMember) => {
    setEditingStaff(staffMember);
    setFormData({
      name: staffMember.name
    });
    
    // Check if staff uses business hours
    setUseBusinessHours(staffMember.uses_business_hours !== false);
    
    const staffScheduleForEdit = {}; // This will be the schedule state for the form

    // 1. Prepare staffScheduleForEdit (always in { enabled, shifts: [{start,end}] } format)
    if (staffMember.schedule) {
      DAY_KEYS.forEach(dayKey => {
        const dayData = staffMember.schedule[dayKey];
        if (dayData && dayData.shifts && Array.isArray(dayData.shifts)) {
          staffScheduleForEdit[dayKey] = {
            enabled: dayData.enabled,
            shifts: dayData.shifts.map(shift => ({ ...shift })) // Deep copy shifts
          };
        } else if (dayData && dayData.start && dayData.end) {
          // Old format - convert to shifts array
          staffScheduleForEdit[dayKey] = {
            enabled: dayData.enabled,
            shifts: [{ start: dayData.start, end: dayData.end }]
          };
        } else {
          // Default for missing or malformed day in staff schedule
          staffScheduleForEdit[dayKey] = {
            enabled: DAY_KEYS.indexOf(dayKey) < 5, // Default enabled (Sun-Thu)
            shifts: [{ start: "09:00", end: dayKey === 'friday' ? "14:00" : "17:00" }] // Default shift values
          };
        }
      });
    } else {
      // If staffMember.schedule is completely missing, use default schedule structure
      DAY_KEYS.forEach(dayKey => {
        staffScheduleForEdit[dayKey] = {
          enabled: DAY_KEYS.indexOf(dayKey) < 5, // Default enabled (Sun-Thu)
          shifts: [{ start: "09:00", end: dayKey === 'friday' ? "14:00" : "17:00" }]
        };
      });
    }
    setSchedule(staffScheduleForEdit); // Update the state

    // 2. Normalize business working hours for comparison (also in { enabled, shifts: [{start,end}] } format)
    const businessWorkingHoursNormalized = {};
    if (business?.working_hours) {
      DAY_KEYS.forEach(dayKey => {
        const businessDay = business.working_hours[dayKey];
        if (businessDay && businessDay.shifts && Array.isArray(businessDay.shifts) && businessDay.shifts.length > 0) {
          businessWorkingHoursNormalized[dayKey] = {
            enabled: businessDay.enabled,
            shifts: businessDay.shifts.map(shift => ({ ...shift }))
          };
        } else if (businessDay && businessDay.start && businessDay.end) {
          businessWorkingHoursNormalized[dayKey] = {
            enabled: businessDay.enabled,
            shifts: [{ start: businessDay.start, end: businessDay.end }]
          };
        } else {
          // Default for missing or malformed day in business schedule
          businessWorkingHoursNormalized[dayKey] = {
            enabled: false, // Default to disabled if no specific info
            shifts: [{ start: "09:00", end: "17:00" }] // Default shift if no info
          };
        }
      });
    }

    // 3. Compare the two normalized schedules
    let schedulesMatch = false;
    if (Object.keys(businessWorkingHoursNormalized).length > 0) { // Only compare if business hours exist
      schedulesMatch = DAY_KEYS.every(dayKey => {
        const staffDay = staffScheduleForEdit[dayKey];
        const businessDay = businessWorkingHoursNormalized[dayKey]; // Use normalized business day

        // Assuming both staffDay and businessDay will always exist after initialization/normalization
        if (!staffDay || !businessDay) return false;

        // Compare enabled status
        if (staffDay.enabled !== businessDay.enabled) return false;

        // If both are disabled, they match for this day
        if (!staffDay.enabled) return true; // Enabled status matches (both false)

        // If enabled, compare shifts
        if (staffDay.shifts.length !== businessDay.shifts.length) return false;

        return staffDay.shifts.every((sShift, idx) => {
          const bShift = businessDay.shifts[idx];
          // Ensure bShift exists and then compare
          return bShift && sShift.start === bShift.start && sShift.end === bShift.end;
        });
      });
    }
    
    setUseBusinessHours(schedulesMatch);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק איש צוות זה?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleDayToggle = (dayKey) => {
    setSchedule(prev => ({
      ...prev,
      [dayKey]: { ...prev[dayKey], enabled: !prev[dayKey].enabled }
    }));
  };

  const handleShiftChange = (dayKey, shiftIndex, field, value) => {
    setSchedule(prev => {
      const newShifts = [...prev[dayKey].shifts];
      newShifts[shiftIndex] = { ...newShifts[shiftIndex], [field]: value };
      return {
        ...prev,
        [dayKey]: { ...prev[dayKey], shifts: newShifts }
      };
    });
  };

  const addShift = (dayKey) => {
    setSchedule(prev => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        shifts: [...prev[dayKey].shifts, { start: "09:00", end: "17:00" }]
      }
    }));
  };

  const removeShift = (dayKey, shiftIndex) => {
    // Ensure there's at least one shift left
    if (schedule[dayKey].shifts.length > 1) {
      setSchedule(prev => ({
        ...prev,
        [dayKey]: {
          ...prev[dayKey],
          shifts: prev[dayKey].shifts.filter((_, i) => i !== shiftIndex)
        }
      }));
    } else {
      // Optionally, disable the day if the last shift is removed
      setSchedule(prev => ({
        ...prev,
        [dayKey]: {
          ...prev[dayKey],
          enabled: false, // Automatically disable if last shift is removed
          shifts: [{ start: "09:00", end: "17:00" }] // Keep a default shift but day is disabled
        }
      }));
    }
  };

  return (
    <div className="min-h-screen bg-[#0C0F1D] p-6 ">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate(createPageUrl("Settings"))}
          className="flex items-center gap-2 text-[#94A3B8] mb-6 hover:text-white transition-colors py-2 px-1 -ml-1 min-h-[44px]"
        >
          <ArrowRight className="w-5 h-5" />
          <span>חזרה</span>
        </button>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">ניהול צוות</h1>
          <Button
            onClick={() => {
              // Check if user already has staff and doesn't have premium
              if (staff.length > 0 && !canAddMultipleStaff) {
                setShowUpgradeModal(true);
                return;
              }
              resetForm();
              setShowForm(!showForm);
            }}
            className="h-12 px-6 rounded-xl relative"
            style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
          >
            <Plus className="w-5 h-5 ml-2" />
            הוסף עובד
            {staff.length > 0 && !canAddMultipleStaff && (
              <Lock className="w-3.5 h-3.5 absolute top-1 left-1 text-white" />
            )}
          </Button>
        </div>

        {showForm && (
          <div className="bg-[#1A1F35] rounded-2xl p-6 mb-6 border border-gray-800">
            <h2 className="text-xl font-bold mb-4">
              {editingStaff ? 'ערוך עובד' : 'עובד חדש'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-white">שם העובד *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-[#0C0F1D] border-gray-700 text-white h-12 rounded-xl"
                  placeholder="שם העובד"
                  required
                />
              </div>

              <div className="pt-4">
                {/* Toggle for business hours */}
                <div 
                  onClick={() => setUseBusinessHours(!useBusinessHours)}
                  className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all ${
                    useBusinessHours
                      ? 'bg-[#FF6B35]/20 border-2 border-[#FF6B35]'
                      : 'bg-[#0C0F1D] border-2 border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-[#FF6B35]" />
                    <span className="text-white font-medium">עובד בשעות העסק</span>
                  </div>
                  <div className={`w-12 h-6 rounded-full transition-all ${useBusinessHours ? 'bg-[#FF6B35]' : 'bg-gray-600'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full mt-0.5 transition-all ${useBusinessHours ? 'mr-0.5' : 'mr-6'}`} />
                  </div>
                </div>

                {!useBusinessHours && (
                  <div className="mt-4 space-y-2">
                    <p className="text-[#94A3B8] text-sm mb-3">הגדר שעות עבודה מותאמות אישית:</p>
                    {DAY_KEYS.map((dayKey, index) => (
                      <div key={dayKey} className="p-3 bg-[#0C0F1D] rounded-xl">
                        <div className="flex items-center gap-3 mb-2">
                          <input
                            type="checkbox"
                            checked={schedule[dayKey]?.enabled}
                            onChange={() => handleDayToggle(dayKey)}
                            className="w-5 h-5 rounded accent-[#FF6B35]"
                          />
                          <span className="text-white font-medium flex-1 text-sm">{DAYS[index]}</span>
                        </div>
                        
                        {schedule[dayKey]?.enabled && (
                          <div className="space-y-2 mr-8">
                            {schedule[dayKey].shifts.map((shift, shiftIndex) => (
                              <div key={shiftIndex} className="flex items-center gap-2">
                                <Input
                                  type="time"
                                  value={shift.start}
                                  onChange={(e) => handleShiftChange(dayKey, shiftIndex, 'start', e.target.value)}
                                  className="bg-[#1A1F35] border-gray-700 text-white h-9 rounded-lg text-sm flex-1"
                                />
                                <span className="text-[#94A3B8] text-sm">-</span>
                                <Input
                                  type="time"
                                  value={shift.end}
                                  onChange={(e) => handleShiftChange(dayKey, shiftIndex, 'end', e.target.value)}
                                  className="bg-[#1A1F35] border-gray-700 text-white h-9 rounded-lg text-sm flex-1"
                                />
                                {schedule[dayKey].shifts.length > 1 && (
                                  <Button
                                    type="button"
                                    onClick={() => removeShift(dayKey, shiftIndex)}
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-9 px-2"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            ))}
                            <Button
                              type="button"
                              onClick={() => addShift(dayKey)}
                              variant="ghost"
                              size="sm"
                              className="text-[#FF6B35] hover:text-[#FF6B35]/80 hover:bg-[#FF6B35]/10 h-8 text-xs w-full"
                            >
                              <Plus className="w-3 h-3 ml-1" />
                              הוסף משמרת
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 h-12 rounded-xl text-white"
                  style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    editingStaff ? 'עדכן' : 'הוסף'
                  )}
                </Button>
                <Button
                  type="button"
                  onClick={resetForm}
                  variant="outline"
                  className="flex-1 h-12 rounded-xl border-gray-700 bg-[#1A1F35] text-white hover:bg-[#0C0F1D] hover:text-white"
                >
                  ביטול
                </Button>
              </div>
            </form>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#FF6B35] mx-auto" />
          </div>
        ) : staff.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-[#94A3B8] mx-auto mb-4" />
            <p className="text-[#94A3B8]">עדיין לא הוספת עובדים</p>
          </div>
        ) : (
          <div className="space-y-3">
            {staff
              .filter(staffMember => !editingStaff || staffMember.id !== editingStaff.id)
              .map((staffMember) => (
              <div key={staffMember.id} className="bg-[#1A1F35] rounded-2xl p-5 border border-gray-800">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white mb-1">{staffMember.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
                      <Clock className="w-4 h-4" />
                      <span>{staffMember.uses_business_hours !== false ? 'עובד בשעות העסק' : 'שעות מותאמות אישית'}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleEdit(staffMember)}
                      variant="ghost"
                      size="sm"
                      className="text-blue-400 hover:text-blue-300"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => handleDelete(staffMember.id)}
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300"
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature="multipleStaff"
        highlightPlan="premium"
      />
    </div>
  );
}