import React, { useState, useEffect } from "react";
import { X, Plus, Trash2, Calendar, Clock, Coffee, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { he } from "date-fns/locale";

const HEBREW_DAYS = {
  0: 'ראשון',
  1: 'שני',
  2: 'שלישי',
  3: 'רביעי',
  4: 'חמישי',
  5: 'שישי',
  6: 'שבת'
};

// Generate time options
const generateTimeOptions = () => {
  const options = [];
  for (let h = 6; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      options.push(time);
    }
  }
  return options;
};

const TIME_OPTIONS = generateTimeOptions();

export default function ScheduleOverrideModal({
  isOpen,
  onClose,
  date,
  staff,
  existingOverride,
  onSave,
  onDelete,
  isLoading
}) {
  const [selectedStaffId, setSelectedStaffId] = useState(null);
  const [isDayOff, setIsDayOff] = useState(false);
  const [shifts, setShifts] = useState([{ start: "09:00", end: "17:00" }]);
  const [note, setNote] = useState("");
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (isOpen && date) {
      if (existingOverride) {
        setSelectedStaffId(existingOverride.staff_id);
        setIsDayOff(existingOverride.is_day_off || false);
        setShifts(existingOverride.shifts?.length > 0 ? existingOverride.shifts : [{ start: "09:00", end: "17:00" }]);
        setNote(existingOverride.note || "");
        setStep(2);
      } else {
        setSelectedStaffId(null);
        setIsDayOff(false);
        setShifts([{ start: "09:00", end: "17:00" }]);
        setNote("");
        setStep(staff.length > 1 ? 1 : 2);
        if (staff.length === 1) {
          setSelectedStaffId(staff[0].id);
        }
      }
    }
  }, [isOpen, date, existingOverride, staff]);

  if (!isOpen || !date) return null;

  const dayOfWeek = date.getDay();
  const hebrewDay = HEBREW_DAYS[dayOfWeek];

  const handleAddShift = () => {
    const lastShift = shifts[shifts.length - 1];
    const newStart = lastShift ? lastShift.end : "09:00";
    setShifts([...shifts, { start: newStart, end: "20:00" }]);
  };

  const handleRemoveShift = (index) => {
    if (shifts.length > 1) {
      setShifts(shifts.filter((_, i) => i !== index));
    }
  };

  const handleShiftChange = (index, field, value) => {
    const newShifts = [...shifts];
    newShifts[index] = { ...newShifts[index], [field]: value };
    setShifts(newShifts);
  };

  const handleSave = () => {
    onSave({
      staff_id: selectedStaffId,
      date: format(date, 'yyyy-MM-dd'),
      is_day_off: isDayOff,
      shifts: isDayOff ? [] : shifts,
      note: note.trim() || null
    });
  };

  const getStaffName = () => {
    if (selectedStaffId === null) return "כל העובדים";
    const staffMember = staff.find(s => s.id === selectedStaffId);
    return staffMember?.name || "עובד";
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center sm:items-center justify-center"
      onClick={onClose}
    >
      <div 
        className="bg-[#1A1F35] w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-bold">שינוי שעות ליום</h2>
          <div className="w-9" />
        </div>

        {/* Date display */}
        <div className="p-4 bg-gradient-to-l from-[#FF6B35]/10 to-transparent">
          <div className="flex items-center gap-3 justify-end">
            <div className="text-right">
              <p className="font-bold text-lg">יום {hebrewDay}</p>
              <p className="text-[#94A3B8] text-sm">
                {format(date, 'd בMMMM yyyy', { locale: he })}
              </p>
            </div>
            <div className="w-12 h-12 bg-[#FF6B35] rounded-xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="p-4 overflow-y-auto max-h-[50vh]">
          {/* Step 1: Select Staff (if multiple) */}
          {step === 1 && staff.length > 1 && (
            <div className="space-y-3">
              <p className="text-sm text-[#94A3B8] mb-4 text-right">לאיזה עובד לשנות את השעות?</p>
              
              <button
                onClick={() => {
                  setSelectedStaffId(null);
                  setStep(2);
                }}
                className="w-full p-4 bg-[#0C0F1D] rounded-xl border border-gray-700 hover:border-[#FF6B35] transition-colors"
              >
                <div className="flex items-center gap-3 justify-end">
                  <span className="font-medium">כל העובדים</span>
                  <div className="w-10 h-10 bg-[#FF6B35]/20 rounded-full flex items-center justify-center">
                    <span className="text-[#FF6B35] font-bold text-sm">כל</span>
                  </div>
                </div>
              </button>

              {staff.map((staffMember) => (
                <button
                  key={staffMember.id}
                  onClick={() => {
                    setSelectedStaffId(staffMember.id);
                    setStep(2);
                  }}
                  className="w-full p-4 bg-[#0C0F1D] rounded-xl border border-gray-700 hover:border-[#FF6B35] transition-colors"
                >
                  <div className="flex items-center gap-3 justify-end">
                    <span className="font-medium">{staffMember.name}</span>
                    <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                      <span className="text-purple-400 font-bold">
                        {staffMember.name?.charAt(0) || "?"}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Set Hours */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Show selected staff */}
              {staff.length > 1 && (
                <div className="flex items-center justify-between p-3 bg-[#0C0F1D] rounded-xl">
                  <button
                    onClick={() => setStep(1)}
                    className="text-sm text-[#FF6B35] hover:underline"
                  >
                    שנה ←
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{getStaffName()}</span>
                    <span className="text-sm text-[#94A3B8]">עובד:</span>
                  </div>
                </div>
              )}

              {/* Day Off Toggle */}
              <div className="flex items-center justify-between p-4 bg-[#0C0F1D] rounded-xl">
                <button
                  onClick={() => setIsDayOff(!isDayOff)}
                  className={`relative w-14 h-8 rounded-full transition-colors ${
                    isDayOff ? 'bg-[#FF6B35]' : 'bg-gray-600'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-md ${
                      isDayOff ? 'right-1' : 'right-7'
                    }`}
                  />
                </button>
                <div className="flex items-center gap-3">
                  <span className="font-medium">יום חופש</span>
                  <Coffee className="w-5 h-5 text-[#94A3B8]" />
                </div>
              </div>

              {/* Shifts (only if not day off) */}
              {!isDayOff && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 justify-end text-sm text-[#94A3B8]">
                    <span>שעות עבודה</span>
                    <Clock className="w-4 h-4" />
                  </div>

                  {shifts.map((shift, index) => (
                    <div
                      key={index}
                      className="p-4 bg-[#0C0F1D] rounded-xl space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        {shifts.length > 1 && (
                          <button
                            onClick={() => handleRemoveShift(index)}
                            className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <span className="text-sm text-[#94A3B8]">
                          משמרת {index + 1}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <select
                          value={shift.start}
                          onChange={(e) => handleShiftChange(index, 'start', e.target.value)}
                          className="flex-1 bg-[#1A1F35] border border-gray-600 rounded-xl p-3 text-center focus:border-[#FF6B35] focus:outline-none transition-colors"
                          dir="ltr"
                        >
                          {TIME_OPTIONS.map((time) => (
                            <option key={`start-${time}`} value={time}>{time}</option>
                          ))}
                        </select>
                        
                        <span className="text-[#94A3B8] px-2">—</span>
                        
                        <select
                          value={shift.end}
                          onChange={(e) => handleShiftChange(index, 'end', e.target.value)}
                          className="flex-1 bg-[#1A1F35] border border-gray-600 rounded-xl p-3 text-center focus:border-[#FF6B35] focus:outline-none transition-colors"
                          dir="ltr"
                        >
                          {TIME_OPTIONS.map((time) => (
                            <option key={`end-${time}`} value={time}>{time}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={handleAddShift}
                    className="w-full p-3 border-2 border-dashed border-gray-600 rounded-xl text-[#94A3B8] hover:border-[#FF6B35] hover:text-[#FF6B35] transition-colors flex items-center justify-center gap-2"
                  >
                    <span>הוסף משמרת (הפסקה)</span>
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Note */}
              <div className="space-y-2">
                <label className="text-sm text-[#94A3B8] block text-right">הערה (אופציונלי)</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="למשל: חתונה של אחותי"
                  className="w-full bg-[#0C0F1D] border border-gray-600 rounded-xl p-3 text-right placeholder:text-gray-500 focus:border-[#FF6B35] focus:outline-none transition-colors"
                  dir="rtl"
                />
              </div>

              {/* Info box */}
              <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <p className="text-sm text-blue-300 flex-1 text-right">
                  {isDayOff
                    ? "לקוחות לא יוכלו לקבוע תורים ליום זה"
                    : "השעות האלה יחליפו את שעות העבודה הרגילות רק ליום זה"
                  }
                </p>
                <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0" />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 2 && (
          <div className="p-4 pb-32 border-t border-gray-700/50 space-y-2 bg-[#0C0F1D]">
            <Button
              onClick={handleSave}
              disabled={isLoading}
              className="w-full bg-gradient-to-l from-[#FF6B35] to-[#FF1744] hover:opacity-90 text-white py-6 rounded-xl font-bold text-base"
            >
              {isLoading ? "שומר..." : "שמור שינויים"}
            </Button>
            
            {existingOverride && (
              <Button
                onClick={() => onDelete(existingOverride.id)}
                disabled={isLoading}
                variant="outline"
                className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10 py-6 rounded-xl font-medium"
              >
                מחק שינוי (חזור לשעות רגילות)
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
