
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useUser } from "@/components/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Phone, Mail, Clock, Loader2, Plus, Trash2, CheckCircle, ChevronLeft, User, Scissors, DollarSign } from "lucide-react";

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DURATION_OPTIONS = Array.from({ length: 18 }, (_, i) => (i + 1) * 5);

export default function BusinessSetup() {
  const navigate = useNavigate();
  const { user, updateUser } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  
  const [formData, setFormData] = useState({
    name: "",
    phone: user?.phone || "",
    email: user?.email || "",
    photo_url: "", // Added
    description: "" // Added
  });

  const [uploadingPhoto, setUploadingPhoto] = useState(false); // Added

  const [workingHours, setWorkingHours] = useState({
    sunday: { enabled: true, shifts: [{ start: "09:00", end: "17:00" }] },
    monday: { enabled: true, shifts: [{ start: "09:00", end: "17:00" }] },
    tuesday: { enabled: true, shifts: [{ start: "09:00", end: "17:00" }] },
    wednesday: { enabled: true, shifts: [{ start: "09:00", end: "17:00" }] },
    thursday: { enabled: true, shifts: [{ start: "09:00", end: "17:00" }] },
    friday: { enabled: false, shifts: [{ start: "09:00", end: "14:00" }] },
    saturday: { enabled: false, shifts: [{ start: "09:00", end: "17:00" }] },
  });

  const [selectedDays, setSelectedDays] = useState([]);

  const [policies, setPolicies] = useState({
    requireApproval: true,
    cancellationHours: "24"
  });

  // Services state
  const [services, setServices] = useState([
    { name: "", duration: "30", price: "", description: "" }
  ]);

  // Staff state
  const [staffMembers, setStaffMembers] = useState([
    {
      name: "",
      email: "",
      phone: "",
      schedule: {
        sunday: { enabled: true, start: "09:00", end: "17:00" },
        monday: { enabled: true, start: "09:00", end: "17:00" },
        tuesday: { enabled: true, start: "09:00", end: "17:00" },
        wednesday: { enabled: true, start: "09:00", end: "17:00" },
        thursday: { enabled: true, start: "09:00", end: "17:00" },
        friday: { enabled: false, start: "09:00", end: "14:00" },
        saturday: { enabled: false, start: "09:00", end: "17:00" },
      }
    }
  ]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError("");
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData(prev => ({ ...prev, photo_url: file_url }));
      setError(""); // Clear any previous error
    } catch (error) {
      console.error('Error uploading photo:', error);
      setError('שגיאה בהעלאת התמונה');
    }
    setUploadingPhoto(false);
  };

  const handleDayToggle = (dayKey) => {
    setWorkingHours(prev => ({
      ...prev,
      [dayKey]: { ...prev[dayKey], enabled: !prev[dayKey].enabled }
    }));
  };

  const toggleDaySelection = (dayKey) => {
    setSelectedDays(prev => 
      prev.includes(dayKey) 
        ? prev.filter(d => d !== dayKey)
        : [...prev, dayKey]
    );
  };

  const applyToSelectedDays = (sourceDay) => {
    if (selectedDays.length === 0) {
      alert('נא לבחור לפחות יום אחד להעתקה');
      return;
    }

    const sourceSchedule = workingHours[sourceDay];
    setWorkingHours(prev => {
      const updated = { ...prev };
      selectedDays.forEach(day => {
        updated[day] = {
          enabled: sourceSchedule.enabled,
          shifts: sourceSchedule.shifts.map(shift => ({ ...shift }))
        };
      });
      return updated;
    });
    
    setSelectedDays([]);
    alert('השעות הועתקו בהצלחה!');
  };

  const quickSetHours = (start, end) => {
    const newSchedule = {};
    DAY_KEYS.forEach(day => {
      if (day === 'friday') {
        newSchedule[day] = { enabled: false, shifts: [{ start, end }] };
      } else if (day === 'saturday') {
        newSchedule[day] = { enabled: false, shifts: [{ start, end }] };
      } else {
        newSchedule[day] = { enabled: true, shifts: [{ start, end }] };
      }
    });
    setWorkingHours(newSchedule);
  };

  const handleShiftChange = (dayKey, shiftIndex, field, value) => {
    setWorkingHours(prev => {
      const newShifts = [...prev[dayKey].shifts];
      newShifts[shiftIndex] = { ...newShifts[shiftIndex], [field]: value };
      return {
        ...prev,
        [dayKey]: { ...prev[dayKey], shifts: newShifts }
      };
    });
  };

  const addShift = (dayKey) => {
    setWorkingHours(prev => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        shifts: [...prev[dayKey].shifts, { start: "09:00", end: "17:00" }]
      }
    }));
  };

  const removeShift = (dayKey, shiftIndex) => {
    setWorkingHours(prev => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        shifts: prev[dayKey].shifts.filter((_, i) => i !== shiftIndex)
      }
    }));
  };

  // Service handlers
  const addService = () => {
    setServices([...services, { name: "", duration: "30", price: "", description: "" }]);
  };

  const removeService = (index) => {
    if (services.length > 1) {
      setServices(services.filter((_, i) => i !== index));
    }
  };

  const updateService = (index, field, value) => {
    const newServices = [...services];
    newServices[index] = { ...newServices[index], [field]: value };
    setServices(newServices);
  };

  // Staff handlers
  const addStaff = () => {
    setStaffMembers([...staffMembers, {
      name: "",
      email: "",
      phone: "",
      schedule: {
        sunday: { enabled: true, start: "09:00", end: "17:00" },
        monday: { enabled: true, start: "09:00", end: "17:00" },
        tuesday: { enabled: true, start: "09:00", end: "17:00" },
        wednesday: { enabled: true, start: "09:00", end: "17:00" },
        thursday: { enabled: true, start: "09:00", end: "17:00" },
        friday: { enabled: false, start: "09:00", end: "14:00" },
        saturday: { enabled: false, start: "09:00", end: "17:00" },
      }
    }]);
  };

  const removeStaff = (index) => {
    if (staffMembers.length > 1) {
      setStaffMembers(staffMembers.filter((_, i) => i !== index));
    }
  };

  const updateStaff = (index, field, value) => {
    const newStaff = [...staffMembers];
    newStaff[index] = { ...newStaff[index], [field]: value };
    setStaffMembers(newStaff);
  };

  const updateStaffSchedule = (staffIndex, dayKey, field, value) => {
    const newStaff = [...staffMembers];
    newStaff[staffIndex].schedule[dayKey] = {
      ...newStaff[staffIndex].schedule[dayKey],
      [field]: value
    };
    setStaffMembers(newStaff);
  };

  const handleStep1Submit = (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.phone) {
      setError("נא למלא את כל השדות החובה");
      return;
    }

    setError("");
    setStep(2);
  };

  const handleStep2Submit = (e) => {
    e.preventDefault();
    setStep(3);
  };

  const handleStep3Submit = (e) => {
    e.preventDefault();
    
    const validServices = services.filter(s => s.name && s.duration);
    if (validServices.length === 0) {
      setError("נא להוסיף לפחות שירות אחד");
      return;
    }
    
    setError("");
    setStep(4);
  };

  const handleStep4Submit = (e) => {
    e.preventDefault();
    
    const validStaff = staffMembers.filter(s => s.name);
    if (validStaff.length === 0) {
      setError("נא להוסיף לפחות עובד אחד");
      return;
    }
    
    setError("");
    setStep(5);
  };

  const handleFinalSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      // Generate unique business code
      const businessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      // Create business
      const business = await base44.entities.Business.create({
        name: formData.name,
        owner_id: user.id,
        phone: formData.phone,
        email: formData.email,
        business_code: businessCode,
        working_hours: workingHours,
        require_approval_for_new_clients: policies.requireApproval,
        cancellation_hours_limit: parseInt(policies.cancellationHours),
        photo_url: formData.photo_url, // Added
        description: formData.description // Added
      });

      // Create services
      const validServices = services.filter(s => s.name && s.duration);
      await Promise.all(
        validServices.map(service =>
          base44.entities.Service.create({
            business_id: business.id,
            name: service.name,
            duration: parseInt(service.duration),
            price: parseFloat(service.price) || 0,
            description: service.description
          })
        )
      );

      // Create staff
      const validStaff = staffMembers.filter(s => s.name);
      await Promise.all(
        validStaff.map(staff =>
          base44.entities.Staff.create({
            business_id: business.id,
            name: staff.name,
            email: staff.email,
            phone: staff.phone,
            schedule: staff.schedule
          })
        )
      );

      // Update user with business_id
      await updateUser({ business_id: business.id });

      setStep(6);
    } catch (err) {
      console.error("Error creating business:", err);
      setError("שגיאה ביצירת העסק. נסה שוב.");
      setLoading(false);
    }
  };

  // Success Screen
  if (step === 6) {
    return (
      <div className="min-h-screen bg-[#0C0F1D] flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-green-500/20 to-green-600/20 flex items-center justify-center mx-auto mb-6 animate-bounce">
            <CheckCircle className="w-20 h-20 text-green-500" />
          </div>
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-[#FF6B35] to-[#FF1744] bg-clip-text text-transparent">
            מזל טוב! 🎉
          </h1>
          <h2 className="text-2xl font-bold mb-3">העסק הוקם בהצלחה!</h2>
          <p className="text-[#94A3B8] text-lg leading-relaxed mb-8">
            {formData.name} מוכן לקבל את התורים הראשונים שלו
          </p>
          
          <div className="bg-[#1A1F35] rounded-2xl p-6 mb-8 border border-gray-800">
            <p className="text-[#94A3B8] text-sm mb-3">מה הגדרת בהצלחה:</p>
            <div className="space-y-3 text-right">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <p className="text-white text-sm">פרטי העסק ושעות פעילות</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <p className="text-white text-sm">{services.filter(s => s.name).length} שירותים</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <p className="text-white text-sm">{staffMembers.filter(s => s.name).length} עובדים</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <p className="text-white text-sm">מדיניות אישורים וביטולים</p>
              </div>
            </div>
          </div>

          <Button
            onClick={() => navigate(createPageUrl("BusinessDashboard"))}
            className="w-full h-14 rounded-xl text-white font-semibold text-lg hover:scale-105 active:scale-95 transition-transform"
            style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
          >
            כניסה לדאשבורד
            <ChevronLeft className="w-5 h-5 mr-2" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0C0F1D] p-6 pb-24">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#FF6B35] to-[#FF1744] flex items-center justify-center">
            <Calendar className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2">הקמת עסק</h1>
          <p className="text-[#94A3B8]">שלב {step} מתוך 5</p>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`h-2 flex-1 rounded-full transition-all ${
                s <= step ? 'bg-gradient-to-r from-[#FF6B35] to-[#FF1744]' : 'bg-[#1A1F35]'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Business Details */}
        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="space-y-6">
            <div className="bg-[#1A1F35] rounded-2xl p-6 space-y-4 border border-gray-800">
              <h2 className="text-xl font-bold mb-4">פרטי העסק</h2>
              
              <div className="space-y-2">
                <Label htmlFor="name" className="text-white">שם העסק *</Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="bg-[#0C0F1D] border-gray-700 text-white h-12 rounded-xl"
                  placeholder="לדוגמה: סלון יופי רחל"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-white">טלפון העסק *</Label>
                <div className="relative">
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    className="bg-[#0C0F1D] border-gray-700 text-white pr-11 h-12 rounded-xl"
                    placeholder="050-1234567"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-white">אימייל העסק</Label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="bg-[#0C0F1D] border-gray-700 text-white pr-11 h-12 rounded-xl"
                    placeholder="business@example.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-white">תמונת העסק (אופציונלי)</Label>
                <div className="flex flex-col gap-3">
                  {formData.photo_url && (
                    <div className="relative w-full h-40 rounded-xl overflow-hidden">
                      <img 
                        src={formData.photo_url} 
                        alt="Business" 
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, photo_url: "" }))}
                        className="absolute top-2 left-2 bg-red-500 hover:bg-red-600 text-white rounded-lg p-2 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <label className="cursor-pointer">
                    <div className="bg-[#0C0F1D] border-2 border-dashed border-gray-700 hover:border-[#FF6B35] rounded-xl p-4 text-center transition-colors">
                      {uploadingPhoto ? (
                        <Loader2 className="w-6 h-6 animate-spin text-[#FF6B35] mx-auto" />
                      ) : (
                        <>
                          <Plus className="w-6 h-6 text-[#94A3B8] mx-auto mb-2" />
                          <p className="text-[#94A3B8] text-sm">לחץ להעלאת תמונה</p>
                        </>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      disabled={uploadingPhoto}
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-white">תיאור העסק (אופציונלי)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  className="bg-[#0C0F1D] border-gray-700 text-white rounded-xl min-h-[100px]"
                  placeholder="ספר ללקוחות על העסק שלך..."
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500 rounded-xl p-3 text-red-500 text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-14 rounded-xl text-white font-semibold text-lg"
              style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
            >
              המשך
              <ChevronLeft className="w-5 h-5 mr-2" />
            </Button>
          </form>
        )}

        {/* Step 2: Working Hours with Shifts */}
        {step === 2 && (
          <form onSubmit={handleStep2Submit} className="space-y-6">
            <div className="bg-[#1A1F35] rounded-2xl p-6 border border-gray-800">
              <div className="flex items-center gap-2 mb-6">
                <Clock className="w-6 h-6 text-[#FF6B35]" />
                <h2 className="text-xl font-bold">שעות פעילות</h2>
              </div>
              
              {/* Quick Set Buttons */}
              <div className="mb-6 bg-[#0C0F1D] rounded-xl p-4">
                <p className="text-sm text-[#94A3B8] mb-3">קיצורי דרך:</p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => quickSetHours("09:00", "17:00")}
                    className="bg-[#1A1F35] hover:bg-[#FF6B35]/20 border border-gray-700 hover:border-[#FF6B35] rounded-lg py-2 text-sm text-white transition-all"
                  >
                    9:00 - 17:00
                  </button>
                  <button
                    type="button"
                    onClick={() => quickSetHours("10:00", "19:00")}
                    className="bg-[#1A1F35] hover:bg-[#FF6B35]/20 border border-gray-700 hover:border-[#FF6B35] rounded-lg py-2 text-sm text-white transition-all"
                  >
                    10:00 - 19:00
                  </button>
                  <button
                    type="button"
                    onClick={() => quickSetHours("08:00", "20:00")}
                    className="bg-[#1A1F35] hover:bg-[#FF6B35]/20 border border-gray-700 hover:border-[#FF6B35] rounded-lg py-2 text-sm text-white transition-all"
                  >
                    8:00 - 20:00
                  </button>
                </div>
              </div>

              {selectedDays.length > 0 && (
                <div className="mb-4 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                  <p className="text-blue-400 text-sm mb-2">
                    נבחרו {selectedDays.length} ימים - לחץ על "העתק" ליד יום כדי להעתיק את השעות לימים הנבחרים
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedDays([])}
                    className="text-xs text-blue-300 hover:text-blue-200 underline"
                  >
                    בטל בחירה
                  </button>
                </div>
              )}
              
              <div className="space-y-4">
                {DAY_KEYS.map((dayKey, index) => (
                  <div key={dayKey} className={`bg-[#0C0F1D] rounded-xl p-4 border-2 transition-all ${
                    selectedDays.includes(dayKey) ? 'border-blue-500' : 'border-transparent'
                  }`}>
                    <div className="flex items-center gap-3 mb-3">
                      <button
                        type="button"
                        onClick={() => toggleDaySelection(dayKey)}
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                          selectedDays.includes(dayKey)
                            ? 'bg-blue-500 border-blue-500'
                            : 'border-gray-600 hover:border-blue-500'
                        }`}
                      >
                        {selectedDays.includes(dayKey) && (
                          <CheckCircle className="w-4 h-4 text-white" />
                        )}
                      </button>
                      
                      <input
                        type="checkbox"
                        checked={workingHours[dayKey].enabled}
                        onChange={() => handleDayToggle(dayKey)}
                        className="w-5 h-5 rounded accent-[#FF6B35]"
                      />
                      <span className="text-white font-medium flex-1">{DAYS[index]}</span>
                      
                      {workingHours[dayKey].enabled && workingHours[dayKey].shifts.length > 0 && (
                        <button
                          type="button"
                          onClick={() => applyToSelectedDays(dayKey)}
                          disabled={selectedDays.length === 0}
                          className="text-xs px-3 py-1 rounded-lg bg-[#FF6B35] hover:bg-[#FF8555] disabled:opacity-30 disabled:cursor-not-allowed text-white font-medium transition-all"
                        >
                          העתק
                        </button>
                      )}
                    </div>
                    
                    {workingHours[dayKey].enabled && (
                      <div className="space-y-2 mr-8">
                        {workingHours[dayKey].shifts.map((shift, shiftIndex) => (
                          <div key={shiftIndex} className="flex items-center gap-2">
                            <div className="flex items-center gap-2 flex-1 bg-[#1A1F35] rounded-lg p-2">
                              <Input
                                type="time"
                                value={shift.start}
                                onChange={(e) => handleShiftChange(dayKey, shiftIndex, 'start', e.target.value)}
                                className="bg-[#0C0F1D] border-gray-700 text-white h-10 rounded-lg text-sm flex-1"
                              />
                              <span className="text-[#94A3B8] text-sm px-1">עד</span>
                              <Input
                                type="time"
                                value={shift.end}
                                onChange={(e) => handleShiftChange(dayKey, shiftIndex, 'end', e.target.value)}
                                className="bg-[#0C0F1D] border-gray-700 text-white h-10 rounded-lg text-sm flex-1"
                              />
                            </div>
                            
                            {workingHours[dayKey].shifts.length > 1 && (
                              <Button
                                type="button"
                                onClick={() => removeShift(dayKey, shiftIndex)}
                                variant="ghost"
                                size="sm"
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-10 px-3 rounded-lg"
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
                          className="text-[#FF6B35] hover:text-[#FF6B35]/80 hover:bg-[#FF6B35]/10 h-9 text-xs w-full"
                        >
                          <Plus className="w-3 h-3 ml-1" />
                          הוסף משמרת
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={() => setStep(1)}
                variant="outline"
                className="flex-1 h-14 rounded-xl border-gray-700 bg-transparent text-white hover:bg-[#0C0F1D] hover:text-white"
              >
                חזור
              </Button>
              <Button
                type="submit"
                className="flex-1 h-14 rounded-xl text-white font-semibold text-lg"
                style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
              >
                המשך
                <ChevronLeft className="w-5 h-5 mr-2" />
              </Button>
            </div>
          </form>
        )}

        {/* Step 3: Services */}
        {step === 3 && (
          <form onSubmit={handleStep3Submit} className="space-y-6">
            <div className="bg-[#1A1F35] rounded-2xl p-6 border border-gray-800">
              <div className="flex items-center gap-2 mb-6">
                <Scissors className="w-6 h-6 text-[#FF6B35]" />
                <h2 className="text-xl font-bold">השירותים שלך</h2>
              </div>
              <p className="text-[#94A3B8] text-sm mb-4">
                הוסף את השירותים שאתה מציע
              </p>

              <div className="space-y-4">
                {services.map((service, index) => (
                  <div key={index} className="bg-[#0C0F1D] rounded-xl p-4 relative">
                    {services.length > 1 && (
                      <Button
                        type="button"
                        onClick={() => removeService(index)}
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 left-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 p-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                    
                    <div className="space-y-3">
                      <Input
                        placeholder="שם השירות *"
                        value={service.name}
                        onChange={(e) => updateService(index, 'name', e.target.value)}
                        className="bg-[#1A1F35] border-gray-700 text-white h-10 rounded-lg"
                      />
                      
                      <div className="grid grid-cols-2 gap-3">
                        <Select
                          value={service.duration}
                          onValueChange={(value) => updateService(index, 'duration', value)}
                        >
                          <SelectTrigger className="bg-[#1A1F35] border-gray-700 text-white h-10 rounded-lg">
                            <SelectValue placeholder="משך" />
                          </SelectTrigger>
                          <SelectContent>
                            {DURATION_OPTIONS.map((duration) => (
                              <SelectItem key={duration} value={duration.toString()}>
                                {duration} דקות
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Input
                          type="number"
                          placeholder="מחיר (₪)"
                          value={service.price}
                          onChange={(e) => updateService(index, 'price', e.target.value)}
                          className="bg-[#1A1F35] border-gray-700 text-white h-10 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                onClick={addService}
                variant="ghost"
                className="w-full mt-4 text-[#FF6B35] hover:text-[#FF6B35]/80 hover:bg-[#FF6B35]/10 h-10"
              >
                <Plus className="w-4 h-4 ml-2" />
                הוסף שירות נוסף
              </Button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500 rounded-xl p-3 text-red-500 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={() => setStep(2)}
                variant="outline"
                className="flex-1 h-14 rounded-xl border-gray-700 bg-transparent text-white hover:bg-[#0C0F1D] hover:text-white"
              >
                חזור
              </Button>
              <Button
                type="submit"
                className="flex-1 h-14 rounded-xl text-white font-semibold text-lg"
                style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
              >
                המשך
                <ChevronLeft className="w-5 h-5 mr-2" />
              </Button>
            </div>
          </form>
        )}

        {/* Step 4: Staff */}
        {step === 4 && (
          <form onSubmit={handleStep4Submit} className="space-y-6">
            <div className="bg-[#1A1F35] rounded-2xl p-6 border border-gray-800">
              <div className="flex items-center gap-2 mb-6">
                <User className="w-6 h-6 text-[#FF6B35]" />
                <h2 className="text-xl font-bold">הצוות שלך</h2>
              </div>
              <p className="text-[#94A3B8] text-sm mb-4">
                הוסף את העובדים שלך
              </p>

              <div className="space-y-4">
                {staffMembers.map((staff, index) => (
                  <div key={index} className="bg-[#0C0F1D] rounded-xl p-4 relative">
                    {staffMembers.length > 1 && (
                      <Button
                        type="button"
                        onClick={() => removeStaff(index)}
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 left-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 p-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                    
                    <div className="space-y-3">
                      <Input
                        placeholder="שם העובד *"
                        value={staff.name}
                        onChange={(e) => updateStaff(index, 'name', e.target.value)}
                        className="bg-[#1A1F35] border-gray-700 text-white h-10 rounded-lg"
                      />
                      
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          type="email"
                          placeholder="אימייל"
                          value={staff.email}
                          onChange={(e) => updateStaff(index, 'email', e.target.value)}
                          className="bg-[#1A1F35] border-gray-700 text-white h-10 rounded-lg"
                        />
                        <Input
                          type="tel"
                          placeholder="טלפון"
                          value={staff.phone}
                          onChange={(e) => updateStaff(index, 'phone', e.target.value)}
                          className="bg-[#1A1F35] border-gray-700 text-white h-10 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                onClick={addStaff}
                variant="ghost"
                className="w-full mt-4 text-[#FF6B35] hover:text-[#FF6B35]/80 hover:bg-[#FF6B35]/10 h-10"
              >
                <Plus className="w-4 h-4 ml-2" />
                הוסף עובד נוסף
              </Button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500 rounded-xl p-3 text-red-500 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={() => setStep(3)}
                variant="outline"
                className="flex-1 h-14 rounded-xl border-gray-700 bg-transparent text-white hover:bg-[#0C0F1D] hover:text-white"
              >
                חזור
              </Button>
              <Button
                type="submit"
                className="flex-1 h-14 rounded-xl text-white font-semibold text-lg"
                style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
              >
                המשך
                <ChevronLeft className="w-5 h-5 mr-2" />
              </Button>
            </div>
          </form>
        )}

        {/* Step 5: Policies */}
        {step === 5 && (
          <form onSubmit={handleFinalSubmit} className="space-y-6">
            <div className="bg-[#1A1F35] rounded-2xl p-6 border border-gray-800">
              <h2 className="text-xl font-bold mb-4">מדיניות ואישורים</h2>
              <p className="text-[#94A3B8] text-sm mb-6">
                הגדר את מדיניות אישור התורים וביטולים
              </p>

              {/* Approval Policy */}
              <div className="mb-6">
                <h3 className="font-bold mb-3">אישור לקוחות חדשים</h3>
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setPolicies({...policies, requireApproval: true})}
                    className={`w-full p-4 rounded-xl border-2 transition-all text-right ${
                      policies.requireApproval
                        ? 'border-[#FF6B35] bg-[#FF6B35]/10'
                        : 'border-gray-700 bg-[#0C0F1D]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        policies.requireApproval ? 'border-[#FF6B35]' : 'border-gray-600'
                      }`}>
                        {policies.requireApproval && <div className="w-3 h-3 rounded-full bg-[#FF6B35]" />}
                      </div>
                      <div>
                        <p className="font-bold text-white">כן, דרוש אישור</p>
                        <p className="text-sm text-[#94A3B8]">
                          לקוחות חדשים יצטרכו אישור לפני שהתור יאושר
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPolicies({...policies, requireApproval: false})}
                    className={`w-full p-4 rounded-xl border-2 transition-all text-right ${
                      !policies.requireApproval
                        ? 'border-[#FF6B35] bg-[#FF6B35]/10'
                        : 'border-gray-700 bg-[#0C0F1D]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        !policies.requireApproval ? 'border-[#FF6B35]' : 'border-gray-600'
                      }`}>
                        {!policies.requireApproval && <div className="w-3 h-3 rounded-full bg-[#FF6B35]" />}
                      </div>
                      <div>
                        <p className="font-bold text-white">לא, אישור אוטומטי</p>
                        <p className="text-sm text-[#94A3B8]">
                          כל התורים יאושרו אוטומטית ללא צורך באישור ידני
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Cancellation Policy */}
              <div>
                <h3 className="font-bold mb-3">מדיניות ביטולים</h3>
                <div className="space-y-2">
                  <Label className="text-white">זמן מינימלי לפני התור (שעות)</Label>
                  <Select
                    value={policies.cancellationHours}
                    onValueChange={(value) => setPolicies({...policies, cancellationHours: value})}
                  >
                    <SelectTrigger className="bg-[#0C0F1D] border-gray-700 text-white h-12 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">שעה אחת</SelectItem>
                      <SelectItem value="2">שעתיים</SelectItem>
                      <SelectItem value="3">3 שעות</SelectItem>
                      <SelectItem value="6">6 שעות</SelectItem>
                      <SelectItem value="12">12 שעות</SelectItem>
                      <SelectItem value="24">24 שעות (יום)</SelectItem>
                      <SelectItem value="48">48 שעות (יומיים)</SelectItem>
                      <SelectItem value="72">72 שעות (3 ימים)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[#94A3B8] text-sm">
                    לקוחות יוכלו לבטל או לערוך תור עד {policies.cancellationHours} שעות לפני מועד התור
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500 rounded-xl p-3 text-red-500 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={() => setStep(4)}
                variant="outline"
                className="flex-1 h-14 rounded-xl border-gray-700 bg-transparent text-white hover:bg-[#0C0F1D] hover:text-white"
                disabled={loading}
              >
                חזור
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 h-14 rounded-xl text-white font-semibold text-lg"
                style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
              >
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    צור עסק
                    <CheckCircle className="w-5 h-5 mr-2" />
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
