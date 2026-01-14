import React from 'react';
import { X, Crown, Zap, Star, Check, ArrowUpRight } from 'lucide-react';
import { PLANS, FEATURE_NAMES, getPaymentLink } from '@/config/plans';
import { Button } from '@/components/ui/button';

/**
 * UpgradeModal Component
 *
 * Shows a modal prompting the user to upgrade their subscription.
 * Can highlight a specific feature that triggered the modal.
 *
 * Usage:
 * <UpgradeModal
 *   isOpen={showModal}
 *   onClose={() => setShowModal(false)}
 *   feature="statistics"
 *   currentPlanId="free"
 * />
 */
export default function UpgradeModal({
  isOpen,
  onClose,
  feature = null,
  currentPlanId = 'free',
  highlightPlan = 'pro'
}) {
  if (!isOpen) return null;

  const featureName = feature ? FEATURE_NAMES[feature] : null;
  const plan = PLANS[highlightPlan];
  const monthlyLink = getPaymentLink('monthly');
  const annualLink = getPaymentLink('annual');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-[#0C0F1D] border border-gray-800 rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header gradient */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#FF6B35]/20 to-transparent pointer-events-none" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors z-10"
        >
          <X className="w-4 h-4 text-white" />
        </button>

        <div className="relative p-6 pt-8">
          {/* Icon */}
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#FF6B35] to-[#FF1744] flex items-center justify-center shadow-lg shadow-[#FF6B35]/30">
            <Crown className="w-8 h-8 text-white" />
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-white text-center mb-2">
            שדרג את החשבון שלך
          </h2>

          {/* Feature highlight */}
          {featureName && (
            <p className="text-sm text-[#94A3B8] text-center mb-6">
              כדי להשתמש ב<span className="text-[#FF6B35] font-medium">{featureName}</span> יש לשדרג לתוכנית בתשלום
            </p>
          )}

          {/* Plan Card */}
          <div className="bg-[#1A1F35] border border-[#FF6B35]/30 rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#FF6B35]/20 flex items-center justify-center">
                <Star className="w-5 h-5 text-[#FF6B35]" />
              </div>
              <div>
                <h3 className="font-bold text-white">{plan.nameHe}</h3>
                <p className="text-xs text-[#94A3B8]">{plan.description}</p>
              </div>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-bold text-white">₪{plan.pricing.monthly}</span>
              <span className="text-[#94A3B8]">/חודש</span>
            </div>

            {/* Key features */}
            <ul className="space-y-2 mb-4">
              {getKeyFeatures(highlightPlan).map((feat, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                  <Check className="w-4 h-4 text-[#FF6B35] flex-shrink-0" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA Buttons */}
          <div className="space-y-3">
            <a
              href={monthlyLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 h-12 bg-gradient-to-r from-[#FF6B35] to-[#FF1744] rounded-xl text-white font-bold hover:shadow-lg hover:shadow-[#FF6B35]/25 transition-all"
            >
              <span>שדרג עכשיו</span>
              <ArrowUpRight className="w-4 h-4" />
            </a>

            <a
              href={annualLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 h-11 bg-white/5 border border-white/10 rounded-xl text-white text-sm hover:bg-white/10 transition-colors"
            >
              <span>מנוי שנתי (17% הנחה)</span>
            </a>

            <button
              onClick={onClose}
              className="w-full h-10 text-[#94A3B8] text-sm hover:text-white transition-colors"
            >
              אולי מאוחר יותר
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Get key features to display for a plan
 */
function getKeyFeatures(planId) {
  const features = {
    starter: [
      'תורים ללא הגבלה',
      '200 הודעות WhatsApp בחודש',
      'תזכורות אוטומטיות',
      'סטטיסטיקות ודוחות',
    ],
    pro: [
      'תורים ללא הגבלה',
      '750 הודעות WhatsApp בחודש',
      'רשימת המתנה',
      'תורים חוזרים',
      'ייצוא נתונים',
    ],
    premium: [
      'הכל ללא הגבלה',
      'ריבוי אנשי צוות',
      'שליחה המונית',
      'תמיכה בעדיפות',
    ],
  };

  return features[planId] || features.pro;
}

/**
 * Hook to manage upgrade modal state
 */
export function useUpgradeModal() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [feature, setFeature] = React.useState(null);

  const openModal = React.useCallback((feat = null) => {
    setFeature(feat);
    setIsOpen(true);
  }, []);

  const closeModal = React.useCallback(() => {
    setIsOpen(false);
    setFeature(null);
  }, []);

  return {
    isOpen,
    feature,
    openModal,
    closeModal,
  };
}
