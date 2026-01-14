import React, { useState } from 'react';
import { useSubscription, useFeatureCheck } from '@/hooks/useSubscription';
import { Crown, Lock, Zap, Star, Sparkles } from 'lucide-react';
import UpgradeModal from './UpgradeModal';

/**
 * FeatureGate Component
 *
 * Wraps content that requires a specific subscription feature.
 * Shows an upgrade prompt if the user doesn't have access.
 *
 * Usage:
 * <FeatureGate feature="statistics">
 *   <StatisticsComponent />
 * </FeatureGate>
 *
 * // Or with custom fallback:
 * <FeatureGate feature="waitingList" fallback={<CustomUpgradePrompt />}>
 *   <WaitingListComponent />
 * </FeatureGate>
 */
export function FeatureGate({
  feature,
  children,
  fallback = null,
  showLock = true,
  inline = false
}) {
  const { hasAccess, requiredPlan, upgradeLink } = useFeatureCheck(feature);

  if (hasAccess) {
    return children;
  }

  // Custom fallback provided
  if (fallback) {
    return fallback;
  }

  // Default upgrade prompt
  if (inline) {
    return (
      <InlineUpgradePrompt
        feature={feature}
        requiredPlan={requiredPlan}
        upgradeLink={upgradeLink}
      />
    );
  }

  return (
    <LockedFeatureCard
      feature={feature}
      requiredPlan={requiredPlan}
      upgradeLink={upgradeLink}
      showLock={showLock}
    />
  );
}

/**
 * Inline upgrade prompt (for buttons, small areas)
 */
function InlineUpgradePrompt({ feature, requiredPlan, upgradeLink }) {
  return (
    <a
      href={upgradeLink}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#FF6B35]/20 to-[#FF1744]/20 border border-[#FF6B35]/30 rounded-lg text-xs text-[#FF6B35] hover:border-[#FF6B35]/50 transition-colors"
    >
      <Lock className="w-3 h-3" />
      <span>שדרג ל-{requiredPlan?.nameHe || 'תוכנית בתשלום'}</span>
    </a>
  );
}

/**
 * Full locked feature card
 */
function LockedFeatureCard({ feature, requiredPlan, upgradeLink, showLock }) {
  const PlanIcon = getPlanIcon(requiredPlan?.id);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-800 bg-[#1A1F35]/50 p-6 text-center">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#FF6B35]/5 to-transparent pointer-events-none" />

      <div className="relative z-10">
        {showLock && (
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#FF6B35]/10 flex items-center justify-center">
            <Lock className="w-7 h-7 text-[#FF6B35]" />
          </div>
        )}

        <h3 className="text-lg font-bold text-white mb-2">פיצ'ר נעול</h3>

        <p className="text-sm text-[#94A3B8] mb-4">
          פיצ'ר זה זמין בתוכנית {requiredPlan?.nameHe || 'בתשלום'} ומעלה
        </p>

        <a
          href={upgradeLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#FF6B35] to-[#FF1744] rounded-xl text-white font-bold text-sm hover:shadow-lg hover:shadow-[#FF6B35]/25 transition-all"
        >
          <PlanIcon className="w-4 h-4" />
          <span>שדרג עכשיו</span>
        </a>
      </div>
    </div>
  );
}

/**
 * Hook-based feature check for conditional rendering
 */
export function useFeatureGate(feature) {
  const { hasAccess, requiredPlan, upgradeLink, currentPlan } = useFeatureCheck(feature);

  return {
    hasAccess,
    requiredPlan,
    upgradeLink,
    currentPlan,
    UpgradePrompt: () => (
      <InlineUpgradePrompt
        feature={feature}
        requiredPlan={requiredPlan}
        upgradeLink={upgradeLink}
      />
    )
  };
}

/**
 * Get icon for plan
 */
function getPlanIcon(planId) {
  switch (planId) {
    case 'starter':
      return Zap;
    case 'pro':
      return Star;
    case 'premium':
      return Crown;
    default:
      return Sparkles;
  }
}

/**
 * Feature names in Hebrew
 */
export const FEATURE_NAMES_HE = {
  autoReminders: 'תזכורות אוטומטיות',
  whatsappConfirmations: 'אישורי WhatsApp',
  statistics: 'סטטיסטיקות',
  newClientApproval: 'אישור לקוחות חדשים',
  bookingVisibility: 'הגדרת חשיפת תורים',
  waitingList: 'רשימת המתנה',
  recurringBookings: 'תורים חוזרים',
  cancellationPolicy: 'מדיניות ביטולים',
  externalCalendarShare: 'שיתוף לוח זמנים',
  dataExport: 'ייצוא נתונים',
  broadcastMessages: 'שליחה המונית',
  prioritySupport: 'תמיכה בעדיפות',
  multipleStaff: 'ריבוי אנשי צוות',
};

/**
 * LockedFeatureButton Component
 *
 * Renders a button that shows upgrade modal when clicked if feature is locked.
 * If user has access, renders children normally.
 *
 * Usage:
 * <LockedFeatureButton
 *   feature="statistics"
 *   className="btn-primary"
 *   lockedClassName="opacity-75"
 *   onClick={() => navigate('/statistics')}
 * >
 *   <BarChart className="w-4 h-4" />
 *   סטטיסטיקות
 * </LockedFeatureButton>
 */
export function LockedFeatureButton({
  feature,
  children,
  onClick,
  className = '',
  lockedClassName = '',
  showLockIcon = true,
  disabled = false,
  ...props
}) {
  const { hasAccess, requiredPlan } = useFeatureCheck(feature);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const handleClick = (e) => {
    if (!hasAccess) {
      e.preventDefault();
      e.stopPropagation();
      setShowUpgradeModal(true);
    } else if (onClick) {
      onClick(e);
    }
  };

  // Determine highlight plan based on required plan
  const getHighlightPlan = () => {
    if (requiredPlan?.id === 'starter') return 'starter';
    if (requiredPlan?.id === 'pro') return 'pro';
    if (requiredPlan?.id === 'premium') return 'premium';
    return 'pro';
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className={`${className} ${!hasAccess ? lockedClassName : ''} relative`}
        {...props}
      >
        {children}
        {!hasAccess && showLockIcon && (
          <Lock className="w-3.5 h-3.5 absolute top-1 left-1 text-[#FF6B35]" />
        )}
      </button>

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature={feature}
        highlightPlan={getHighlightPlan()}
      />
    </>
  );
}

/**
 * LockedFeatureOverlay Component
 *
 * Wraps content with a clickable overlay that shows upgrade modal when locked.
 * The content is visible but not interactive when locked.
 */
export function LockedFeatureOverlay({
  feature,
  children,
  className = '',
}) {
  const { hasAccess, requiredPlan } = useFeatureCheck(feature);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const getHighlightPlan = () => {
    if (requiredPlan?.id === 'starter') return 'starter';
    if (requiredPlan?.id === 'pro') return 'pro';
    if (requiredPlan?.id === 'premium') return 'premium';
    return 'pro';
  };

  if (hasAccess) {
    return children;
  }

  return (
    <>
      <div className={`relative ${className}`}>
        <div className="opacity-50 pointer-events-none">
          {children}
        </div>
        <div
          onClick={() => setShowUpgradeModal(true)}
          className="absolute inset-0 cursor-pointer flex items-center justify-center bg-black/20 rounded-xl"
        >
          <div className="bg-[#1A1F35] border border-[#FF6B35]/30 rounded-xl px-4 py-2 flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#FF6B35]" />
            <span className="text-sm text-white font-medium">
              {requiredPlan?.nameHe || 'שדרג'}
            </span>
          </div>
        </div>
      </div>

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature={feature}
        highlightPlan={getHighlightPlan()}
      />
    </>
  );
}

export default FeatureGate;
