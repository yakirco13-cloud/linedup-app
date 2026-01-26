import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useUser } from "@/components/UserContext";
import { Button } from "@/components/ui/button";
import {
  X,
  ArrowRight,
  ArrowLeft,
  Briefcase,
  Users,
  Calendar,
  CheckCircle,
  Palette,
  UserPlus,
  CalendarCheck,
  RefreshCw,
  MessageSquare
} from "lucide-react";

/**
 * Onboarding Component
 * Provides step-by-step guided tour for new users
 * Different flows for business owners vs clients
 */
export default function Onboarding({ onComplete }) {
  const { user, updateUser } = useUser();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  // Business Owner Tutorial Steps
  const businessOwnerSteps = [
    {
      title: "ברוכים הבאים ל-LinedUp! 🎉",
      description: "מערכת ניהול תורים מתקדמת לעסק שלך - בואו נראה את כל היכולות!",
      icon: CheckCircle,
      content: null,
    },
    {
      title: "פרטי העסק + רשתות חברתיות",
      description: "הגדר את פרטי העסק ושתף קישורים לאינסטגרם ופייסבוק",
      icon: Briefcase,
      content: (
        <div className="space-y-3">
          <div className="bg-[#0C0F1D] rounded-xl p-4">
            <h4 className="font-bold text-white mb-3">פרטי עסק + קוד</h4>
            <div className="space-y-2">
              <div className="bg-[#1A1F35] rounded-lg p-2 border border-white/10">
                <span className="text-white text-sm">מספרת השכונה</span>
              </div>
              <div className="bg-gradient-to-r from-[#FF6B35] to-[#FF1744] rounded-lg p-2 text-center">
                <span className="text-lg font-bold text-white tracking-wider">123456</span>
              </div>
            </div>
            <h4 className="font-bold text-white mt-3 mb-2 text-sm">רשתות חברתיות</h4>
            <div className="space-y-1">
              <div className="bg-[#1A1F35] rounded-lg p-2 flex items-center gap-2">
                <div className="w-6 h-6 bg-pink-500 rounded flex items-center justify-center text-white text-xs">IG</div>
                <span className="text-white text-xs">@mysalon</span>
              </div>
              <div className="bg-[#1A1F35] rounded-lg p-2 flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white text-xs">FB</div>
                <span className="text-white text-xs">/mysalonpage</span>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "שירותים + צוות",
      description: "הגדר שירותים עם מחיר ומשך זמן + הוסף עובדים",
      icon: Palette,
      content: (
        <div className="space-y-2">
          <div className="bg-[#0C0F1D] rounded-xl p-3">
            <h4 className="font-bold text-white mb-2 text-sm">שירותים</h4>
            <div className="space-y-1">
              <div className="bg-[#1A1F35] rounded-lg p-2 flex justify-between items-center">
                <div>
                  <div className="font-bold text-white text-sm">תספורת גברים</div>
                  <div className="text-xs text-[#94A3B8]">45 דק'</div>
                </div>
                <div className="text-[#FF6B35] font-bold text-sm">₪80</div>
              </div>
              <div className="bg-[#1A1F35] rounded-lg p-2 flex justify-between items-center">
                <div>
                  <div className="font-bold text-white text-sm">צביעה</div>
                  <div className="text-xs text-[#94A3B8]">90 דק'</div>
                </div>
                <div className="text-[#FF6B35] font-bold text-sm">₪150</div>
              </div>
            </div>
          </div>
          <div className="bg-[#0C0F1D] rounded-xl p-3">
            <h4 className="font-bold text-white mb-2 text-sm">צוות</h4>
            <div className="space-y-1">
              <div className="bg-[#1A1F35] rounded-lg p-2 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FF1744] flex items-center justify-center">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-white text-sm">יוסי כהן</div>
                  <div className="text-xs text-[#94A3B8]">ספר ראשי</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "לוח שנה שבועי + גרירה",
      description: "תצוגת שבוע מלאה, גרור תורים לשעות אחרות בקלות",
      icon: Calendar,
      content: (
        <div className="bg-[#0C0F1D] rounded-xl p-3">
          <h4 className="font-bold text-white mb-2 text-sm">תצוגה שבועית</h4>
          <div className="grid grid-cols-3 gap-1 mb-2">
            <div className="text-center">
              <div className="text-xs text-[#94A3B8]">ראשון</div>
              <div className="text-white text-sm font-bold">12</div>
            </div>
            <div className="text-center bg-[#FF6B35]/20 rounded">
              <div className="text-xs text-[#FF6B35]">שני</div>
              <div className="text-white text-sm font-bold">13</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-[#94A3B8]">שלישי</div>
              <div className="text-white text-sm font-bold">14</div>
            </div>
          </div>
          <div className="space-y-1">
            <div className="bg-[#1A1F35] rounded p-2 border-l-2 border-[#FF6B35] cursor-move">
              <div className="text-[#FF6B35] text-xs font-bold">09:00</div>
              <div className="text-white text-xs">דוד - תספורת</div>
            </div>
            <div className="text-xs text-center text-[#94A3B8] py-1">↕️ גרור להזיז שעה</div>
          </div>
        </div>
      ),
    },
    {
      title: "מדיניות ביטולים + אישורים",
      description: "הגדר כללי ביטול, חלון הזמנה ואישור לקוחות חדשים",
      icon: CheckCircle,
      content: (
        <div className="space-y-2">
          <div className="bg-[#0C0F1D] rounded-xl p-3">
            <h4 className="font-bold text-white mb-2 text-sm">מדיניות</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#94A3B8]">ביטול עד</span>
                <span className="text-white font-bold">24 שעות</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#94A3B8]">הזמנה עד</span>
                <span className="text-white font-bold">7 ימים קדימה</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#94A3B8]">אישור לקוחות</span>
                <div className="w-10 h-5 bg-[#FF6B35] rounded-full relative">
                  <div className="absolute left-1 top-0.5 w-4 h-4 bg-white rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "תורים חוזרים + תזכורות",
      description: "קבע תורים קבועים שבועיים + תזכורות אוטומטיות ללקוחות",
      icon: RefreshCw,
      content: (
        <div className="space-y-2">
          <div className="bg-[#0C0F1D] rounded-xl p-3">
            <h4 className="font-bold text-white mb-2 text-sm">תור קבוע</h4>
            <div className="bg-[#1A1F35] rounded-lg p-2 border-2 border-purple-500/50">
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw className="w-4 h-4 text-purple-400" />
                <span className="text-white text-xs font-bold">כל יום ראשון 09:00</span>
              </div>
              <div className="text-xs text-[#94A3B8]">דוד כהן - תספורת</div>
            </div>
          </div>
          <div className="bg-[#0C0F1D] rounded-xl p-3">
            <h4 className="font-bold text-white mb-2 text-sm">תזכורות אוטומטיות</h4>
            <div className="space-y-1">
              <div className="bg-[#1A1F35] rounded p-2 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-green-400" />
                <span className="text-white text-xs">WhatsApp - 24 שעות לפני</span>
              </div>
              <div className="bg-[#1A1F35] rounded p-2 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-400" />
                <span className="text-white text-xs">SMS - 2 שעות לפני</span>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "שיתוף לוח + סנכרון Google",
      description: "שתף את הלוח עם הצוות וסנכרן עם Google Calendar",
      icon: Calendar,
      content: (
        <div className="space-y-2">
          <div className="bg-[#0C0F1D] rounded-xl p-3">
            <h4 className="font-bold text-white mb-2 text-sm">שיתוף לוח</h4>
            <div className="bg-[#1A1F35] rounded-lg p-2">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-[#FF6B35]" />
                <span className="text-white text-xs font-bold">שתף עם הצוות</span>
              </div>
              <div className="text-xs text-[#94A3B8]">כל העובדים רואים את הלוח המלא</div>
            </div>
          </div>
          <div className="bg-[#0C0F1D] rounded-xl p-3">
            <h4 className="font-bold text-white mb-2 text-sm">סנכרון Google Calendar</h4>
            <div className="bg-[#1A1F35] rounded-lg p-2 flex items-center gap-2">
              <div className="w-5 h-5 bg-white rounded flex items-center justify-center">
                <span className="text-xs font-bold text-blue-600">G</span>
              </div>
              <div>
                <div className="text-white text-xs font-bold">מסונכרן</div>
                <div className="text-xs text-green-400">✓ פעיל</div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "סטטיסטיקות + ייצוא",
      description: "צפה בדוחות מפורטים וייצא נתונים לאקסל",
      icon: Briefcase,
      content: (
        <div className="bg-[#0C0F1D] rounded-xl p-3">
          <h4 className="font-bold text-white mb-2 text-sm">סטטיסטיקות החודש</h4>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-[#1A1F35] rounded-lg p-2 text-center">
              <div className="text-2xl font-bold text-[#FF6B35]">127</div>
              <div className="text-xs text-[#94A3B8]">תורים</div>
            </div>
            <div className="bg-[#1A1F35] rounded-lg p-2 text-center">
              <div className="text-2xl font-bold text-green-400">₪10K</div>
              <div className="text-xs text-[#94A3B8]">הכנסות</div>
            </div>
          </div>
          <div className="bg-gradient-to-r from-[#FF6B35] to-[#FF1744] rounded-lg p-2 text-center">
            <span className="text-white text-xs font-bold">📊 ייצוא לאקסל</span>
          </div>
        </div>
      ),
    },
    {
      title: "הכל מוכן! 🚀",
      description: "כל התכונות שאתה צריך לנהל עסק מקצועי במקום אחד!",
      icon: CheckCircle,
      content: (
        <div className="text-center py-2">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FF1744] flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <div className="bg-[#0C0F1D] rounded-xl p-3 text-right space-y-1.5">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#FF6B35]" />
              <span className="text-xs text-white">לוח שנה שבועי + גרירת תורים</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#FF6B35]" />
              <span className="text-xs text-white">תורים חוזרים + תזכורות אוטומטיות</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#FF6B35]" />
              <span className="text-xs text-white">מדיניות ביטולים + אישור לקוחות</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#FF6B35]" />
              <span className="text-xs text-white">שיתוף לוח + סנכרון Google Calendar</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#FF6B35]" />
              <span className="text-xs text-white">סטטיסטיקות + ייצוא נתונים</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#FF6B35]" />
              <span className="text-xs text-white">קישורים לרשתות חברתיות</span>
            </div>
          </div>
        </div>
      ),
    },
  ];

  // Client Tutorial Steps
  const clientSteps = [
    {
      title: "ברוכים הבאים ל-LinedUp! 👋",
      description: "אנחנו כאן כדי לעזור לך לנהל את התורים שלך בקלות. בואו נראה איך זה עובד!",
      icon: CheckCircle,
      content: null,
    },
    {
      title: "הצטרפות לעסק",
      description: "כדי לקבוע תורים, תצטרך להצטרף לעסק. יש שתי דרכים:",
      icon: UserPlus,
      content: (
        <div className="space-y-3">
          <div className="bg-[#0C0F1D] rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[#FF6B35]/20 flex items-center justify-center">
                <span className="text-xl text-white">1</span>
              </div>
              <h4 className="font-bold text-white">קוד העסק</h4>
            </div>
            <p className="text-sm text-[#94A3B8] mb-3">הזן את קוד העסק בן 6 הספרות</p>
            <div className="bg-[#1A1F35] rounded-lg p-3 border border-white/10 text-center">
              <div className="text-2xl font-bold text-[#FF6B35] tracking-wider">123456</div>
            </div>
          </div>

          <div className="bg-[#0C0F1D] rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[#FF6B35]/20 flex items-center justify-center">
                <span className="text-xl text-white">2</span>
              </div>
              <h4 className="font-bold text-white">דרך לינק</h4>
            </div>
            <p className="text-sm text-[#94A3B8]">העסק שלח לך לינק? פשוט לחץ עליו והצטרף אוטומטית!</p>
          </div>
        </div>
      ),
    },
    {
      title: "קביעת תור",
      description: "קל וקצר - בחר שירות, תאריך, שעה ואתה מוכן!",
      icon: CalendarCheck,
      content: (
        <div className="space-y-3">
          <div className="bg-[#0C0F1D] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[#94A3B8]">בחר שירות</span>
              <Palette className="w-4 h-4 text-[#FF6B35]" />
            </div>
            <div className="bg-[#1A1F35] rounded-lg p-3 border-2 border-[#FF6B35]">
              <div className="font-bold text-white">תספורת גברים</div>
              <div className="text-sm text-[#94A3B8]">45 דקות • ₪80</div>
            </div>
          </div>

          <div className="bg-[#0C0F1D] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[#94A3B8]">בחר תאריך ושעה</span>
              <Calendar className="w-4 h-4 text-[#FF6B35]" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#1A1F35] rounded-lg p-2 text-center text-sm">
                <div className="text-[#94A3B8] text-xs mb-1">תאריך</div>
                <div className="font-bold text-white">15/02/2026</div>
              </div>
              <div className="bg-[#1A1F35] rounded-lg p-2 text-center text-sm">
                <div className="text-[#94A3B8] text-xs mb-1">שעה</div>
                <div className="font-bold text-[#FF6B35]">14:30</div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "ניהול התורים שלך",
      description: "כל התורים שלך במקום אחד - צפה, בטל או שנה בקלות",
      icon: Calendar,
      content: (
        <div className="space-y-2">
          {/* Example Booking Card */}
          <div className="bg-[#0C0F1D] rounded-xl p-4 border-2 border-green-500/30">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-bold text-white">תספורת גברים</div>
                <div className="text-sm text-[#94A3B8]">מספרת השכונה</div>
              </div>
              <div className="text-left">
                <div className="text-[#FF6B35] font-bold text-lg">14:30</div>
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">✓ מאושר</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
              <CalendarCheck className="w-4 h-4" />
              <span>15/02/2026</span>
            </div>
          </div>

          <div className="bg-[#0C0F1D]/50 rounded-xl p-3 text-center text-sm text-[#94A3B8]">
            <div className="flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#FF6B35]" />
              <span>תקבל תזכורת לפני התור!</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "הכל מוכן! 🎉",
      description: "עכשיו אתה יכול להתחיל לקבוע תורים ולנהל אותם בקלות. בהצלחה!",
      icon: CheckCircle,
      content: (
        <div className="text-center py-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FF1744] flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
          <p className="text-[#94A3B8] mb-4">
            כל הכלים שאתה צריך כדי לנהל את התורים שלך במקום אחד
          </p>
          <div className="bg-[#0C0F1D] rounded-xl p-4 text-right space-y-2">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-[#FF6B35]" />
              <span className="text-sm text-white">קביעת תורים מהירה</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-[#FF6B35]" />
              <span className="text-sm text-white">תזכורות אוטומטיות</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-[#FF6B35]" />
              <span className="text-sm text-white">ניהול פשוט ונוח</span>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const steps = user?.user_role === 'business_owner' ? businessOwnerSteps : clientSteps;
  const currentStepData = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    try {
      // Mark onboarding as completed (only if field exists)
      if (user && user.onboarding_completed !== undefined) {
        await updateUser({ onboarding_completed: true });
      }
      setIsVisible(false);
      if (onComplete) onComplete();
    } catch (error) {
      console.error('Error completing onboarding:', error);
      // Still close the onboarding even if update fails
      setIsVisible(false);
      if (onComplete) onComplete();
    }
  };

  const handleSkip = async () => {
    await handleComplete();
  };

  if (!isVisible) return null;

  const StepIcon = currentStepData.icon;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-[#1A1F35] rounded-2xl max-w-lg w-full p-8 border border-white/10 relative">
        {/* Close Button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4 text-white" />
        </button>

        {/* Progress Indicator */}
        <div className="flex gap-2 mb-6">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-1 flex-1 rounded-full transition-all ${
                index <= currentStep ? 'bg-[#FF6B35]' : 'bg-white/10'
              }`}
            />
          ))}
        </div>

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FF1744] flex items-center justify-center">
            <StepIcon className="w-10 h-10 text-white" />
          </div>
        </div>

        {/* Content */}
        <h2 className="text-2xl font-bold text-white text-center mb-4">
          {currentStepData.title}
        </h2>
        <p className="text-[#94A3B8] text-center mb-6 leading-relaxed">
          {currentStepData.description}
        </p>

        {/* Visual Content */}
        {currentStepData.content && (
          <div className="mb-6">
            {currentStepData.content}
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3">
          {currentStep > 0 && (
            <Button
              onClick={handleBack}
              variant="outline"
              className="flex-1 h-12 rounded-xl border-white/10 bg-transparent text-white hover:bg-white/5"
            >
              <ArrowRight className="w-4 h-4 ml-2" />
              הקודם
            </Button>
          )}
          <Button
            onClick={handleNext}
            className="flex-1 h-12 rounded-xl font-semibold"
            style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
          >
            {currentStep === steps.length - 1 ? 'סיום' : 'הבא'}
            {currentStep < steps.length - 1 && <ArrowLeft className="w-4 h-4 mr-2" />}
          </Button>
        </div>

        {/* Skip Button */}
        <button
          onClick={handleSkip}
          className="w-full mt-4 text-[#94A3B8] hover:text-white text-sm transition-colors"
        >
          דלג על ההדרכה
        </button>
      </div>
    </div>
  );
}
