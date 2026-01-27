import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useUser } from "@/components/UserContext";
import { usePageHeader } from "@/components/PageHeaderContext";
import { useSubscription } from "@/hooks/useSubscription";
import { PLANS, PLAN_IDS, FEATURE_NAMES, LIMIT_NAMES, formatLimit, getPaymentLink } from "@/config/plans";
import { Button } from "@/components/ui/button";
import { Check, X, ArrowRight, Crown, Zap, Star, Sparkles, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";
import { isUserDemoAccount } from "@/utils/demoAccounts";

// Plan display config with icons and colors
const PLAN_DISPLAY = {
  free: {
    icon: Sparkles,
    color: 'text-gray-400',
    nameHe: 'חינם',
    description: 'מושלם להתחלה ולהכרת המערכת',
  },
  starter: {
    icon: Zap,
    color: 'text-blue-400',
    nameHe: 'סטארטר',
    description: 'לעסקים קטנים שרוצים לצמוח',
  },
  pro: {
    icon: Star,
    color: 'text-[#FF6B35]',
    nameHe: 'מקצועי',
    description: 'הבחירה של רוב העסקים',
  },
  premium: {
    icon: Crown,
    color: 'text-yellow-400',
    nameHe: 'פרימיום',
    description: 'לעסקים עם צוות עובדים',
  },
};

// Build features list for each plan
const getPlanFeatures = (planId) => {
  const plan = PLANS[planId];
  const features = [];

  // Bookings
  features.push({
    name: plan.limits.bookingsPerMonth === Infinity ? 'תורים ללא הגבלה' : `עד ${plan.limits.bookingsPerMonth} תורים בחודש`,
    included: true,
  });

  // Messages
  if (plan.limits.messagesPerMonth === 0) {
    features.push({ name: 'הודעות WhatsApp', included: false });
  } else if (plan.limits.messagesPerMonth === Infinity) {
    features.push({ name: 'הודעות WhatsApp ללא הגבלה', included: true });
  } else {
    features.push({ name: `${plan.limits.messagesPerMonth} הודעות WhatsApp בחודש`, included: true });
  }

  // Reminders
  features.push({
    name: 'תזכורות אוטומטיות',
    included: plan.features.autoReminders,
  });

  // Statistics
  features.push({
    name: 'סטטיסטיקות ודוחות',
    included: plan.features.statistics,
  });

  // Staff
  if (plan.limits.staff === Infinity) {
    features.push({ name: 'צוות ללא הגבלה', included: true });
  } else {
    features.push({ name: `עד ${plan.limits.staff} איש צוות`, included: true });
  }

  // Waiting list (PRO+)
  if (planId === 'pro' || planId === 'premium') {
    features.push({ name: 'רשימת המתנה', included: plan.features.waitingList });
  }

  // Broadcast (PREMIUM only)
  if (planId === 'premium') {
    features.push({ name: 'שליחה המונית', included: plan.features.broadcastMessages });
  }

  return features;
};

const FAQS = [
  {
    q: "האם אפשר לבטל בכל עת?",
    a: "כן, ניתן לבטל את המנוי בכל עת ללא התחייבות. החיוב יופסק מהחודש הבא."
  },
  {
    q: "האם המחירים כוללים מע״מ?",
    a: "המחירים המוצגים אינם כוללים מע״מ. חשבונית מס תישלח אוטומטית למייל לאחר התשלום."
  },
  {
    q: "מה קורה אם אני עובר את מכסת ההודעות?",
    a: "תקבל התראה כשתתקרב למכסה. לאחר מכן תוכל לשדרג או להמתין לחודש הבא."
  },
  {
    q: "האם יש תקופת ניסיון?",
    a: "כן, לכל תוכנית בתשלום יש 14 ימי ניסיון חינם."
  },
];

export default function Pricing() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { plan: currentPlan } = useSubscription();

  usePageHeader({
    title: "שדרג את העסק שלך",
    showBackButton: true,
    backPath: createPageUrl("Settings")
  });

  const [isAnnual, setIsAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [showComparison, setShowComparison] = useState(false);

  // Redirect demo accounts away from pricing page
  useEffect(() => {
    if (isUserDemoAccount(user)) {
      navigate(-1);
    }
  }, [user, navigate]);

  // Don't render for demo accounts
  if (isUserDemoAccount(user)) {
    return null;
  }

  const handleSelectPlan = (planId) => {
    if (planId === 'free' || currentPlan?.id === planId) return;
    const paymentLink = getPaymentLink(isAnnual ? 'annual' : 'monthly');
    window.open(paymentLink, '_blank');
  };

  const planOrder = ['free', 'starter', 'pro', 'premium'];

  return (
    <>
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#FF6B35]/10 rounded-full blur-[120px]" />
      </div>

        {/* Subtitle */}
        <p className="text-[#94A3B8] text-sm md:text-lg max-w-2xl mx-auto text-center mb-4">
          בחר את התוכנית המתאימה לך וקבל גישה לכל הכלים המתקדמים
        </p>

        {/* Sticky Toggle Switch */}
        <div className="sticky top-12 z-30 py-3 -mx-4 px-4 bg-[#0C0F1D]/95 backdrop-blur-sm">
          <div className="flex justify-center">
            <div className="bg-[#1A1F35] p-1.5 rounded-2xl border border-gray-800 flex items-center gap-2 relative shadow-lg">
              <button
                onClick={() => setIsAnnual(false)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  !isAnnual ? 'bg-[#0C0F1D] text-white shadow-lg ring-1 ring-white/10' : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                חודשי
              </button>
              <button
                onClick={() => setIsAnnual(true)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                  isAnnual ? 'bg-[#0C0F1D] text-white shadow-lg ring-1 ring-white/10' : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                שנתי
                <span className="bg-gradient-to-r from-[#FF6B35] to-[#FF1744] text-white text-[10px] px-2 py-0.5 rounded-full">
                  -17%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          {planOrder.map((planId) => {
            const plan = PLANS[planId];
            const display = PLAN_DISPLAY[planId];
            const price = isAnnual ? Math.round(plan.pricing.annual / 12) : plan.pricing.monthly;
            const isCurrent = currentPlan?.id === planId;
            const Icon = display.icon;
            const features = getPlanFeatures(planId);

            return (
              <div 
                key={planId}
                className={`relative flex flex-col p-5 md:p-6 rounded-3xl transition-all duration-300 ${
                  plan.popular 
                    ? 'bg-[#1A1F35] border-2 border-[#FF6B35] shadow-[0_0_30px_-10px_rgba(255,107,53,0.3)] md:scale-105 z-10' 
                    : 'bg-[#1A1F35]/50 border border-gray-800 hover:border-gray-700 hover:bg-[#1A1F35]'
                }`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#FF6B35] to-[#FF1744] text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" />
                    הכי פופולרי
                  </div>
                )}

                {/* Card Header */}
                <div className="mb-4">
                  <div className={`w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center mb-3 ${display.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-0.5">{display.nameHe}</h3>
                  <p className="text-xs text-[#94A3B8]">{display.description}</p>
                </div>

                {/* Price */}
                <div className="mb-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-white">₪{price}</span>
                    <span className="text-[#94A3B8] text-sm">/חודש</span>
                  </div>
                  {isAnnual && plan.pricing.annual > 0 && (
                    <p className="text-green-500 text-xs mt-1 font-medium">
                      ₪{plan.pricing.annual} לשנה (חיסכון ₪{plan.pricing.monthly * 12 - plan.pricing.annual})
                    </p>
                  )}
                  {plan.pricing.monthly === 0 && (
                    <p className="text-[#94A3B8] text-xs mt-1">חינם לתמיד</p>
                  )}
                </div>

                {/* Action Button */}
                <Button
                  onClick={() => handleSelectPlan(planId)}
                  disabled={isCurrent}
                  className={`w-full h-11 rounded-xl mb-5 font-bold transition-all text-sm ${
                    isCurrent
                      ? 'bg-white/10 text-white cursor-default'
                      : plan.popular
                      ? 'bg-gradient-to-r from-[#FF6B35] to-[#FF1744] hover:shadow-lg hover:shadow-[#FF6B35]/25 hover:scale-[1.02]'
                      : planId === 'free'
                      ? 'bg-white/10 text-white hover:bg-white/20'
                      : 'bg-white text-[#0C0F1D] hover:bg-white/90'
                  }`}
                >
                  {isCurrent ? 'התוכנית שלך' : planId === 'free' ? 'התחל בחינם' : 'שדרג עכשיו'}
                </Button>

                {/* Features */}
                <div className="space-y-3 flex-1">
                  <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">מה כלול:</p>
                  <ul className="space-y-2">
                    {features.map((feature, i) => (
                      <li key={i} className={`flex items-start gap-2 text-xs ${feature.included ? 'text-slate-300' : 'text-slate-600'}`}>
                        {feature.included ? (
                          <Check className={`w-4 h-4 flex-shrink-0 mt-0.5 ${plan.popular ? 'text-[#FF6B35]' : 'text-green-500'}`} />
                        ) : (
                          <X className="w-4 h-4 flex-shrink-0 mt-0.5 opacity-50" />
                        )}
                        <span className={feature.included ? '' : 'line-through decoration-slate-600'}>
                          {feature.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {/* Full Comparison - Expandable */}
        <div className="mb-8">
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#1A1F35] border border-gray-800 rounded-2xl hover:bg-[#1A1F35]/80 transition-colors"
          >
            <span className="text-sm font-semibold text-white">השוואה מלאה בין התוכניות</span>
            {showComparison ? (
              <ChevronUp className="w-5 h-5 text-[#FF6B35]" />
            ) : (
              <ChevronDown className="w-5 h-5 text-[#94A3B8]" />
            )}
          </button>

          {showComparison && (
            <div className="mt-4 bg-[#1A1F35] border border-gray-800 rounded-2xl overflow-hidden animate-in slide-in-from-top-2">
              {/* Table Header */}
              <div className="grid grid-cols-5 border-b border-gray-800">
                <div className="p-3 text-xs font-bold text-[#94A3B8]">תכונה</div>
                {planOrder.map((planId) => (
                  <div 
                    key={planId} 
                    className={`p-3 text-center text-xs font-bold ${
                      PLANS[planId].popular ? 'text-[#FF6B35] bg-[#FF6B35]/10' : 'text-white'
                    }`}
                  >
                    {PLAN_DISPLAY[planId].nameHe}
                  </div>
                ))}
              </div>

              {/* Limits Section */}
              <div className="border-b border-gray-800">
                <div className="bg-[#0C0F1D]/50 px-3 py-2 text-xs font-bold text-[#FF6B35]">
                  מגבלות
                </div>
                {Object.entries(LIMIT_NAMES).map(([key, label]) => (
                  <div key={key} className="grid grid-cols-5 border-b border-gray-800/50">
                    <div className="p-3 text-xs text-[#94A3B8]">{label}</div>
                    {planOrder.map((planId) => {
                      const value = formatLimit(PLANS[planId].limits[key]);
                      const isUnlimited = value === 'ללא הגבלה';
                      return (
                        <div 
                          key={planId} 
                          className={`p-3 text-center text-xs font-medium ${
                            isUnlimited ? 'text-[#FF6B35]' : 'text-white'
                          } ${PLANS[planId].popular ? 'bg-[#FF6B35]/5' : ''}`}
                        >
                          {isUnlimited ? '∞' : value}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Features Section */}
              <div>
                <div className="bg-[#0C0F1D]/50 px-3 py-2 text-xs font-bold text-[#FF6B35]">
                  תכונות
                </div>
                {Object.entries(FEATURE_NAMES).map(([key, label]) => (
                  <div key={key} className="grid grid-cols-5 border-b border-gray-800/50 last:border-b-0">
                    <div className="p-3 text-xs text-[#94A3B8]">{label}</div>
                    {planOrder.map((planId) => {
                      const hasFeature = PLANS[planId].features[key];
                      return (
                        <div 
                          key={planId} 
                          className={`p-3 flex justify-center ${PLANS[planId].popular ? 'bg-[#FF6B35]/5' : ''}`}
                        >
                          {hasFeature ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <X className="w-4 h-4 text-gray-600" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* FAQ Section */}
        <div className="max-w-2xl mx-auto mb-12">
          <h2 className="text-xl font-bold text-center text-white mb-6">שאלות נפוצות</h2>
          <div className="grid gap-3">
            {FAQS.map((faq, i) => (
              <div 
                key={i}
                className="bg-[#1A1F35] border border-gray-800 rounded-2xl overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-right hover:bg-white/5 transition-colors"
                >
                  <span className="font-semibold text-white text-sm">{faq.q}</span>
                  {openFaq === i ? (
                    <ChevronUp className="w-5 h-5 text-[#FF6B35] flex-shrink-0 mr-2" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-[#94A3B8] flex-shrink-0 mr-2" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4 pt-0 text-[#94A3B8] text-sm leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Trust Footer */}
        <div className="text-center pb-8">
          <div className="inline-flex items-center gap-2 bg-[#1A1F35] border border-gray-800 px-4 py-2 rounded-full mb-3">
            <ShieldCheck className="w-4 h-4 text-green-500" />
            <span className="text-xs text-[#94A3B8]">תשלום מאובטח ומוצפן</span>
          </div>
          <p className="text-[#94A3B8] text-xs">
            צריך עזרה בבחירת התוכנית? 
            <a 
              href="https://wa.me/972XXXXXXXXX" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[#FF6B35] hover:text-[#FF8555] font-medium mr-1"
            >
              דבר איתנו
            </a>
          </p>
          <p className="text-[#64748B] text-[10px] mt-2">* כל המחירים לא כוללים מע"מ</p>
        </div>
    </>
  );
}