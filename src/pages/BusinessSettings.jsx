import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useUser } from "@/components/UserContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Briefcase, Phone, Mail, Clock, Loader2, CheckCircle, Plus, Trash2, Bell, Share2, Copy, RefreshCw, ChevronDown, ChevronUp, Calendar, ExternalLink, Smartphone, Lock, Instagram, Facebook } from "lucide-react";
import { LockedFeatureOverlay } from "@/components/FeatureGate";
import { getCurrentPlan } from "@/services/subscriptionService";
import { usePageHeader } from "@/components/PageHeaderContext";

// Railway URL for calendar sync
const RAILWAY_URL = 'https://linedup-official-production.up.railway.app';

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export default function BusinessSettings() {
  const navigate = useNavigate();
  const { user } = useUser();
  const queryClient = useQueryClient();

  // Set header with back button
  usePageHeader({
    title: "הגדרות עסק",
    showBackButton: true,
    backPath: createPageUrl("Settings")
  });

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    photo_url: "",
    description: "",
    instagram: "",
    facebook: "",
    // Reminder settings - default to false (FREE plan doesn't have access)
    reminder_enabled: false,
    reminder_hours_before: 12
  });

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  
  // Share calendar state
  const [shareToken, setShareToken] = useState(null);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  
  // Calendar sync state
  const [calendarLinkCopied, setCalendarLinkCopied] = useState(false);
  const [showCalendarInstructions, setShowCalendarInstructions] = useState(false);

  const [workingHours, setWorkingHours] = useState({
    sunday: { enabled: true, shifts: [{ start: "09:00", end: "17:00" }] },
    monday: { enabled: true, shifts: [{ start: "09:00", end: "17:00" }] },
    tuesday: { enabled: true, shifts: [{ start: "09:00", end: "17:00" }] },
    wednesday: { enabled: true, shifts: [{ start: "09:00", end: "17:00" }] },
    thursday: { enabled: true, shifts: [{ start: "09:00", end: "17:00" }] },
    friday: { enabled: false, shifts: [{ start: "09:00", end: "14:00" }] },
    saturday: { enabled: false, shifts: [{ start: "09:00", end: "17:00" }] }
  });

  const [workingHoursExpanded, setWorkingHoursExpanded] = useState(false);

  const { data: business, isLoading } = useQuery({
    queryKey: ['business', user?.business_id],
    queryFn: async () => {
      const businesses = await base44.entities.Business.filter({ id: user.business_id });
      return businesses[0];
    },
    enabled: !!user?.business_id
  });

  // Get current subscription plan to enforce feature access
  const { data: currentPlan } = useQuery({
    queryKey: ['current-plan', user?.business_id],
    queryFn: () => getCurrentPlan(user.business_id),
    enabled: !!user?.business_id,
  });

  // Check feature access based on plan
  const hasAutoReminders = currentPlan?.features?.autoReminders || false;
  const hasExternalCalendarShare = currentPlan?.features?.externalCalendarShare || false;

  useEffect(() => {
    if (business) {
      // Enforce plan-based feature access: reminder only works if plan allows it
      const canUseReminders = hasAutoReminders && business.reminder_enabled === true;

      setFormData({
        name: business.name,
        phone: business.phone,
        email: business.email || "",
        photo_url: business.photo_url || "",
        description: business.description || "",
        instagram: business.instagram || "",
        facebook: business.facebook || "",
        reminder_enabled: canUseReminders,
        reminder_hours_before: business.reminder_hours_before || 12
      });

      // Load share token
      if (business.share_token) {
        setShareToken(business.share_token);
      }

      if (business.working_hours) {
        const converted = {};
        DAY_KEYS.forEach((dayKey) => {
          const dayData = business.working_hours[dayKey];
          if (dayData && dayData.shifts && Array.isArray(dayData.shifts)) {
            converted[dayKey] = {
              enabled: dayData.enabled,
              shifts: dayData.shifts.map((shift) => ({ ...shift }))
            };
          } else if (dayData && dayData.start && dayData.end) {
            converted[dayKey] = {
              enabled: dayData.enabled,
              shifts: [{ start: dayData.start, end: dayData.end }]
            };
          } else {
            converted[dayKey] = {
              enabled: false,
              shifts: [{ start: "09:00", end: "17:00" }]
            };
          }
        });
        setWorkingHours(converted);
      }
    }
  }, [business, hasAutoReminders]);

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const result = await base44.entities.Business.update(business.id, data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business'] });
    }
  });

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData((prev) => ({ ...prev, photo_url: file_url }));
    } catch (error) {
      alert('שגיאה בהעלאת התמונה');
    }
    setUploadingPhoto(false);
  };

  // Generate unique share token
  const generateShareToken = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let token = '';
    for (let i = 0; i < 12; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  };

  // Create or regenerate share link
  const handleGenerateShareLink = async () => {
    setGeneratingToken(true);
    try {
      const newToken = generateShareToken();
      await base44.entities.Business.update(business.id, { share_token: newToken });
      setShareToken(newToken);
      queryClient.invalidateQueries({ queryKey: ['business'] });
    } catch (error) {
      alert('שגיאה ביצירת קישור שיתוף');
    }
    setGeneratingToken(false);
  };

  // Copy share link to clipboard
  const handleCopyShareLink = async () => {
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/SharedCalendar?token=${shareToken}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  // Remove share link
  const handleRemoveShareLink = async () => {
    if (window.confirm('האם אתה בטוח שברצונך לבטל את קישור השיתוף? מי שיש לו את הקישור לא יוכל יותר לצפות בלוח הזמנים.')) {
      try {
        await base44.entities.Business.update(business.id, { share_token: null });
        setShareToken(null);
        queryClient.invalidateQueries({ queryKey: ['business'] });
      } catch (error) {
        alert('שגיאה בביטול קישור השיתוף');
      }
    }
  };

  const handleDayToggle = (dayKey) => {
    setWorkingHours((prev) => ({
      ...prev,
      [dayKey]: { ...prev[dayKey], enabled: !prev[dayKey].enabled }
    }));
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
    setWorkingHours((prev) => {
      const newShifts = [...prev[dayKey].shifts];
      newShifts[shiftIndex] = { ...newShifts[shiftIndex], [field]: value };
      return {
        ...prev,
        [dayKey]: { ...prev[dayKey], shifts: newShifts }
      };
    });
  };

  const addShift = (dayKey) => {
    setWorkingHours((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        shifts: [...prev[dayKey].shifts, { start: "09:00", end: "17:00" }]
      }
    }));
  };

  const removeShift = (dayKey, shiftIndex) => {
    setWorkingHours((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        shifts: prev[dayKey].shifts.filter((_, i) => i !== shiftIndex)
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.phone) {
      alert("נא למלא את כל השדות החובה");
      return;
    }

    // Build update payload with all fields including social URLs
    const updatePayload = {
      name: formData.name,
      phone: formData.phone,
      email: formData.email,
      photo_url: formData.photo_url,
      description: formData.description,
      working_hours: workingHours,
      reminder_enabled: formData.reminder_enabled,
      reminder_hours_before: formData.reminder_hours_before,
      instagram: formData.instagram || null,
      facebook: formData.facebook || null
    };

    try {
      await updateMutation.mutateAsync(updatePayload);
      alert('השינויים נשמרו בהצלחה!');
    } catch (error) {
      console.error('Submit error:', error);
      alert('שגיאה בשמירת השינויים: ' + error.message);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0C0F1D] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF6B35]" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-[#0C0F1D] flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-[#94A3B8] mb-4">לא נמצא עסק</p>
          <Button onClick={() => navigate(createPageUrl("BusinessSetup"))}>
            צור עסק
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        /* Fix Switch white dot positioning - override Tailwind's translate-x-4 */
        button[role="switch"] span[data-state] {
          transition: transform 0.2s ease !important;
        }
        button[role="switch"] span[data-state="unchecked"] {
          transform: translateX(-15px) !important;
        }
        button[role="switch"] span[data-state="checked"] {
          transform: translateX(0px) !important;
        }
      `}</style>

      <form onSubmit={handleSubmit} className="space-y-6 pb-40">
          {/* Business Info */}
          <div className="bg-[#1A1F35] rounded-2xl p-6 border border-gray-800 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Briefcase className="w-5 h-5 text-[#FF6B35]" />
              <h2 className="text-xl font-bold">פרטי עסק</h2>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="text-white">שם העסק *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
                className="bg-[#0C0F1D] border-gray-700 text-white rounded-xl h-12"
                placeholder="למשל: מספרת יוסי" />
              
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-white">
                <Phone className="w-4 h-4 inline ml-1" />
                טלפון *
              </Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                required className="bg-[#0C0F1D] text-white px-3 py-1 text-base rounded-xl flex w-full border shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm border-gray-700 h-12"

                placeholder="050-1234567" />
              
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">
                <Mail className="w-4 h-4 inline ml-1" />
                אימייל
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="bg-[#0C0F1D] border-gray-700 text-white rounded-xl h-12"
                placeholder="info@business.com" />

            </div>

            <div className="space-y-2">
              <Label htmlFor="instagram_url" className="text-white">
                <Instagram className="w-4 h-4 inline ml-1" />
                קישור לאינסטגרם
              </Label>
              <Input
                id="instagram_url"
                type="url"
                value={formData.instagram}
                onChange={(e) => handleChange('instagram', e.target.value)}
                className="bg-[#0C0F1D] border-gray-700 text-white rounded-xl h-12"
                placeholder="https://instagram.com/yourbusiness"
                dir="ltr" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="facebook" className="text-white">
                <Facebook className="w-4 h-4 inline ml-1" />
                קישור לפייסבוק
              </Label>
              <Input
                id="facebook"
                type="url"
                value={formData.facebook}
                onChange={(e) => handleChange('facebook', e.target.value)}
                className="bg-[#0C0F1D] border-gray-700 text-white rounded-xl h-12"
                placeholder="https://facebook.com/yourbusiness"
                dir="ltr" />
            </div>

            <div className="space-y-2">
              <Label className="text-white">תמונת העסק</Label>
              <div className="flex flex-col gap-3">
                {formData.photo_url &&
                <div className="relative w-full h-40 rounded-xl overflow-hidden">
                    <img
                    src={formData.photo_url}
                    alt="Business"
                    className="w-full h-full object-cover" />
                  
                    <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, photo_url: "" }))}
                    className="absolute top-2 left-2 bg-red-500 hover:bg-red-600 text-white rounded-lg p-2 transition-colors">
                    
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                }
                <label className="cursor-pointer">
                  <div className="bg-[#0C0F1D] border-2 border-dashed border-gray-700 hover:border-[#FF6B35] rounded-xl p-4 text-center transition-colors">
                    {uploadingPhoto ?
                    <Loader2 className="w-6 h-6 animate-spin text-[#FF6B35] mx-auto" /> :

                    <>
                        <Plus className="w-6 h-6 text-[#94A3B8] mx-auto mb-2" />
                        <p className="text-[#94A3B8] text-sm">
                          {formData.photo_url ? 'שנה תמונה' : 'הוסף תמונה'}
                        </p>
                      </>
                    }
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    disabled={uploadingPhoto} />
                  
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-white">תיאור העסק</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                className="bg-[#0C0F1D] border-gray-700 text-white rounded-xl min-h-[100px]"
                placeholder="ספר ללקוחות על העסק שלך..." />
              
            </div>

            <div className="pt-4 border-t border-gray-800">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-white font-bold">קוד העסק:</span>
                <span className="text-[#FF6B35] font-mono text-lg">{business?.business_code}</span>
              </div>
              <p className="text-[#94A3B8] text-sm">
                לקוחות משתמשים בקוד זה כדי להצטרף לעסק שלך
              </p>
            </div>
          </div>

          {/* Reminder Settings */}
          <LockedFeatureOverlay feature="autoReminders">
          <div className="bg-gradient-to-br from-blue-600/20 to-blue-500/10 rounded-2xl p-6 border-2 border-blue-500/30">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5 text-blue-400" />
              <h2 className="text-xl font-bold text-blue-400">תזכורות אוטומטיות</h2>
            </div>

            <div className="bg-[#0C0F1D]/50 rounded-xl p-4 mb-4">
              <p className="text-[#94A3B8] text-sm mb-3">
                המערכת תשלח תזכורות אוטומטיות ללקוחות באימייל לפני התור שלהם.
                אין צורך ללחוץ על כפתור - הכל יקרה אוטומטית! 🎉
              </p>
              <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-blue-300 font-medium">
                    מערכת תזכורות חכמה מופעלת
                  </span>
                </div>
                <div className="flex items-center switch-wrapper">
                  <Switch
                    checked={formData.reminder_enabled}
                    onCheckedChange={(checked) => handleChange('reminder_enabled', checked)}
                    className="data-[state=checked]:bg-blue-500" />
                  
                </div>
              </div>
            </div>

            {formData.reminder_enabled && (
              <div className="space-y-3">
                <Label className="text-white">מתי לשלוח תזכורות?</Label>
                <div className="bg-[#0C0F1D]/50 rounded-xl p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { hours: 3, label: '3 שעות לפני', icon: '⏰' },
                      { hours: 6, label: '6 שעות לפני', icon: '🕐' },
                      { hours: 12, label: '12 שעות לפני', icon: '⏱️' },
                      { hours: 24, label: 'יום לפני', icon: '📅' },
                      { hours: 48, label: 'יומיים לפני', icon: '🗓️' },
                      { hours: 72, label: '3 ימים לפני', icon: '📆' }
                    ].map((option) => (
                      <button
                        key={option.hours}
                        type="button"
                        onClick={() => handleChange('reminder_hours_before', option.hours)}
                        className={`p-4 rounded-xl font-medium transition-all transform hover:scale-105 active:scale-95 ${
                          formData.reminder_hours_before === option.hours
                            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg border-2 border-blue-400'
                            : 'bg-[#1A1F35] text-[#94A3B8] hover:bg-[#252A3F] border-2 border-transparent hover:border-blue-500/30'
                        }`}
                      >
                        <div className="text-2xl mb-1">{option.icon}</div>
                        <div className="text-sm font-semibold">{option.label}</div>
                      </button>
                    ))}
                  </div>
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                    <p className="text-blue-300 text-xs leading-relaxed">
                      💡 {
                        formData.reminder_hours_before >= 48
                          ? `תור שנקבע ליום שלישי ב-15:00 - התזכורת תישלח ביום ${
                              formData.reminder_hours_before === 72 ? 'שבת' : 'ראשון'
                            } ב-15:00`
                          : formData.reminder_hours_before >= 24
                          ? 'תור שנקבע למחר ב-15:00 - התזכורת תישלח היום ב-15:00'
                          : formData.reminder_hours_before >= 12
                          ? 'תור שנקבע להיום ב-20:00 - התזכורת תישלח ב-08:00'
                          : 'תור שנקבע להיום ב-15:00 - התזכורת תישלח ב-' + 
                            String(Math.max(0, 15 - formData.reminder_hours_before)).padStart(2, '0') + ':00'
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          </LockedFeatureOverlay>

          {/* Share Calendar Section - PRO+ feature */}
          <LockedFeatureOverlay feature="externalCalendarShare">
          <div className="bg-[#1A1F35] rounded-2xl p-6 border border-gray-800">
            <div className="flex items-center gap-2 mb-4">
              <Share2 className="w-5 h-5 text-[#FF6B35]" />
              <h2 className="text-xl font-bold">שיתוף לוח זמנים</h2>
            </div>

            <p className="text-[#94A3B8] text-sm mb-4">
              שתף את לוח הזמנים שלך עם אנשים אחרים (למשל: בן/בת זוג, מנהל) לצפייה בלבד
            </p>

            {shareToken ? (
              <div className="space-y-4">
                <div className="bg-[#0C0F1D] rounded-xl p-4 overflow-hidden">
                  <Label className="text-[#94A3B8] text-xs mb-2 block">קישור לשיתוף:</Label>
                  <div className="flex items-center gap-2 min-w-0">
                    <code className="flex-1 min-w-0 text-[#FF6B35] text-sm break-all bg-[#1A1F35] p-2 rounded-lg overflow-x-auto">
                      {window.location.origin}/SharedCalendar?token={shareToken}
                    </code>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <Button
                    type="button"
                    onClick={handleCopyShareLink}
                    className={`flex-1 h-11 rounded-xl font-medium transition-all ${
                      linkCopied 
                        ? 'bg-green-500 hover:bg-green-600' 
                        : 'bg-[#FF6B35] hover:bg-[#FF8555]'
                    }`}
                  >
                    {linkCopied ? (
                      <>
                        <CheckCircle className="w-4 h-4 ml-2" />
                        הועתק!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 ml-2" />
                        העתק קישור
                      </>
                    )}
                  </Button>
                  
                  <Button
                    type="button"
                    onClick={handleGenerateShareLink}
                    disabled={generatingToken}
                    variant="outline"
                    className="h-11 rounded-xl border-gray-700 bg-transparent text-white hover:bg-[#0C0F1D]"
                  >
                    {generatingToken ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                  </Button>
                  
                  <Button
                    type="button"
                    onClick={handleRemoveShareLink}
                    variant="outline"
                    className="h-11 rounded-xl border-red-500/50 bg-transparent text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                  <p className="text-yellow-300 text-xs">
                    ⚠️ כל מי שיש לו את הקישור יכול לצפות בלוח הזמנים שלך. לחץ על 🔄 כדי ליצור קישור חדש ולבטל את הישן.
                  </p>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                onClick={handleGenerateShareLink}
                disabled={generatingToken}
                className="w-full h-12 rounded-xl bg-[#FF6B35] hover:bg-[#FF8555] font-medium"
              >
                {generatingToken ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Share2 className="w-4 h-4 ml-2" />
                    צור קישור שיתוף
                  </>
                )}
              </Button>
            )}
          </div>
          </LockedFeatureOverlay>

          {/* Google Calendar Sync Section */}
          <div className="bg-[#1A1F35] rounded-2xl p-6 border border-gray-800">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-[#FF6B35]" />
              <h2 className="text-xl font-bold">סנכרון ליומן Google</h2>
            </div>
            
            <p className="text-[#94A3B8] text-sm mb-4">
              הצג את כל התורים שלך ביומן Google, Apple או Outlook שלך
            </p>

            {business?.id && (
              <div className="space-y-4">
                {/* Calendar URL */}
                <div className="bg-[#0C0F1D] rounded-xl p-4 overflow-hidden">
                  <Label className="text-[#94A3B8] text-xs mb-2 block">קישור היומן שלך:</Label>
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="text"
                      value={`${RAILWAY_URL}/cal/${business.id}.ics`}
                      readOnly
                      className="flex-1 min-w-0 bg-[#1A1F35] text-[#FF6B35] text-xs p-2 rounded-lg outline-none truncate"
                      dir="ltr"
                    />
                    <Button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(`${RAILWAY_URL}/cal/${business.id}.ics`);
                          setCalendarLinkCopied(true);
                          setTimeout(() => setCalendarLinkCopied(false), 2000);
                        } catch (err) {
                          console.error('Failed to copy:', err);
                        }
                      }}
                      className={`h-9 px-3 rounded-lg text-xs font-medium transition-all ${
                        calendarLinkCopied 
                          ? 'bg-green-500 hover:bg-green-600' 
                          : 'bg-[#FF6B35] hover:bg-[#FF8555]'
                      }`}
                    >
                      {calendarLinkCopied ? (
                        <>
                          <CheckCircle className="w-3 h-3 ml-1" />
                          הועתק!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 ml-1" />
                          העתק
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Instructions Toggle */}
                <button
                  type="button"
                  onClick={() => setShowCalendarInstructions(!showCalendarInstructions)}
                  className="w-full text-center text-sm text-[#FF6B35] hover:text-[#FF8555] transition-colors"
                >
                  {showCalendarInstructions ? 'הסתר הוראות ▲' : 'איך מוסיפים ליומן? ▼'}
                </button>

                {/* Instructions */}
                {showCalendarInstructions && (
                  <div className="space-y-4 animate-in slide-in-from-top-2">
                    
                    {/* Google Calendar Instructions */}
                    <div className="bg-[#0C0F1D] rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <img 
                          src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" 
                          alt="Google Calendar" 
                          className="w-5 h-5"
                        />
                        <span className="font-semibold text-white text-sm">Google Calendar</span>
                      </div>
                      
                      <ol className="space-y-2 text-xs text-[#94A3B8]" dir="rtl">
                        <li className="flex gap-2">
                          <span className="bg-[#FF6B35] text-white w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]">1</span>
                          <span>פתח את Google Calendar במחשב</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="bg-[#FF6B35] text-white w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]">2</span>
                          <span>בצד שמאל, ליד "יומנים אחרים", לחץ על +</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="bg-[#FF6B35] text-white w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]">3</span>
                          <span>בחר "מכתובת URL"</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="bg-[#FF6B35] text-white w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]">4</span>
                          <span>הדבק את הקישור שהעתקת</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="bg-[#FF6B35] text-white w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]">5</span>
                          <span>לחץ "הוסף יומן"</span>
                        </li>
                      </ol>
                      
                      <a
                        href="https://calendar.google.com/calendar/r/settings/addbyurl"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 flex items-center justify-center gap-2 bg-white/10 text-white text-xs px-4 py-2 rounded-lg hover:bg-white/20 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        פתח Google Calendar
                      </a>
                    </div>
                    
                    {/* iPhone Instructions */}
                    <div className="bg-[#0C0F1D] rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Smartphone className="w-5 h-5 text-white" />
                        <span className="font-semibold text-white text-sm">iPhone / iPad</span>
                      </div>
                      
                      <ol className="space-y-2 text-xs text-[#94A3B8]" dir="rtl">
                        <li className="flex gap-2">
                          <span className="bg-[#FF6B35] text-white w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]">1</span>
                          <span>פתח את אפליקציית "הגדרות"</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="bg-[#FF6B35] text-white w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]">2</span>
                          <span>גלול ל"יומן" → "חשבונות"</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="bg-[#FF6B35] text-white w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]">3</span>
                          <span>לחץ "הוסף חשבון" → "אחר"</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="bg-[#FF6B35] text-white w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]">4</span>
                          <span>בחר "הוסף מנוי ליומן"</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="bg-[#FF6B35] text-white w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]">5</span>
                          <span>הדבק את הקישור ולחץ "הירשם"</span>
                        </li>
                      </ol>
                    </div>
                    
                    {/* Note */}
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                      <p className="text-blue-300 text-xs">
                        💡 היומן מתעדכן אוטומטית כל כמה שעות. תורים חדשים יופיעו בקרוב.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Working Hours */}
          <div className="bg-[#1A1F35] rounded-2xl p-6 border border-gray-800">
            <button
              type="button"
              onClick={() => setWorkingHoursExpanded(!workingHoursExpanded)}
              className="flex items-center justify-between w-full"
            >
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#FF6B35]" />
                <h2 className="text-xl font-bold">שעות פעילות</h2>
              </div>
              {workingHoursExpanded ? (
                <ChevronUp className="w-5 h-5 text-[#94A3B8]" />
              ) : (
                <ChevronDown className="w-5 h-5 text-[#94A3B8]" />
              )}
            </button>

            {workingHoursExpanded && (
            <>
              {/* Quick Set Buttons */}
              <div className="mt-4 bg-[#0C0F1D] rounded-xl p-3 sm:p-4">
                <p className="text-sm text-[#94A3B8] mb-3">קיצורי דרך:</p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => quickSetHours("09:00", "17:00")}
                    className="bg-[#1A1F35] hover:bg-[#FF6B35]/20 border border-gray-700 hover:border-[#FF6B35] rounded-lg py-2 text-xs sm:text-sm text-white transition-all"
                  >
                    9:00 - 17:00
                  </button>
                  <button
                    type="button"
                    onClick={() => quickSetHours("10:00", "19:00")}
                    className="bg-[#1A1F35] hover:bg-[#FF6B35]/20 border border-gray-700 hover:border-[#FF6B35] rounded-lg py-2 text-xs sm:text-sm text-white transition-all"
                  >
                    10:00 - 19:00
                  </button>
                  <button
                    type="button"
                    onClick={() => quickSetHours("08:00", "20:00")}
                    className="bg-[#1A1F35] hover:bg-[#FF6B35]/20 border border-gray-700 hover:border-[#FF6B35] rounded-lg py-2 text-xs sm:text-sm text-white transition-all"
                  >
                    8:00 - 20:00
                  </button>
                </div>
              </div>

              <div className="space-y-3 mt-4">
                {DAY_KEYS.map((dayKey, index) => (
                  <div key={dayKey} className="bg-[#0C0F1D] rounded-xl p-3 sm:p-4 overflow-hidden">
                    {/* Day header */}
                    <div className="flex items-center gap-2 sm:gap-3">
                      <input
                        type="checkbox"
                        checked={workingHours[dayKey].enabled}
                        onChange={() => handleDayToggle(dayKey)}
                        className="w-5 h-5 rounded accent-[#FF6B35] flex-shrink-0"
                      />
                      <span className="text-white font-medium flex-1 min-w-0">{DAYS[index]}</span>
                    </div>

                    {/* Shifts */}
                    {workingHours[dayKey].enabled && (
                      <div className="mt-3 space-y-2 pr-7 overflow-hidden">
                        {workingHours[dayKey].shifts.map((shift, shiftIndex) => (
                          <div key={shiftIndex} className="flex items-center gap-2 min-w-0">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0 bg-[#1A1F35] rounded-lg p-1.5 sm:p-2">
                              <Input
                                type="time"
                                value={shift.start}
                                onChange={(e) => handleShiftChange(dayKey, shiftIndex, 'start', e.target.value)}
                                className="bg-[#0C0F1D] border-gray-700 text-white h-9 rounded-lg text-sm w-[85px] sm:w-auto sm:flex-1 px-2 min-w-0"
                              />
                              <span className="text-[#94A3B8] text-xs sm:text-sm flex-shrink-0">-</span>
                              <Input
                                type="time"
                                value={shift.end}
                                onChange={(e) => handleShiftChange(dayKey, shiftIndex, 'end', e.target.value)}
                                className="bg-[#0C0F1D] border-gray-700 text-white h-9 rounded-lg text-sm w-[85px] sm:w-auto sm:flex-1 px-2 min-w-0"
                              />
                            </div>

                            {workingHours[dayKey].shifts.length > 1 && (
                              <Button
                                type="button"
                                onClick={() => removeShift(dayKey, shiftIndex)}
                                variant="ghost"
                                size="sm"
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-9 w-9 p-0 rounded-lg flex-shrink-0"
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
                          משמרת נוספת
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
            )}
          </div>

        </form>

        {/* Sticky Save Button */}
        <div className="fixed bottom-20 left-0 right-0 bg-[#0C0F1D]/95 backdrop-blur-sm border-t border-gray-800 p-4 z-20">
          <div className="max-w-4xl mx-auto flex gap-3">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={updateMutation.isPending}
              className="flex-1 h-14 rounded-xl text-white font-semibold text-lg"
              style={{
                background: 'linear-gradient(135deg, #FF6B35, #FF1744)'
              }}
            >
              {updateMutation.isPending ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                "שמור שינויים"
              )}
            </Button>
            <Button
              type="button"
              onClick={() => navigate(createPageUrl("Settings"))}
              variant="outline"
              className="h-14 px-6 rounded-xl border-gray-700 bg-transparent text-white hover:bg-[#0C0F1D] hover:text-white"
            >
              ביטול
            </Button>
          </div>
        </div>
    </>
  );
}