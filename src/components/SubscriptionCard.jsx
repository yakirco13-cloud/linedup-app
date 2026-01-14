import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '@/hooks/useSubscription';
import { Crown, Zap, Star, Sparkles, ArrowUpRight, Calendar, MessageSquare, Users, Briefcase, ChevronLeft } from 'lucide-react';
import { formatLimit, getPaymentLink } from '@/config/plans';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

/**
 * SubscriptionCard Component
 *
 * Displays current subscription status, plan info, and usage.
 * Used in Settings page.
 */
export default function SubscriptionCard() {
  const navigate = useNavigate();
  const {
    subscription,
    plan,
    usage,
    statusInfo,
    isLoading,
    isFreePlan,
    isPaidPlan,
    isTrialing,
    messagesUsed,
    messagesLimit,
    messageUsagePercent
  } = useSubscription();

  if (isLoading) {
    return (
      <div className="bg-[#1A1F35] rounded-2xl p-6 animate-pulse">
        <div className="h-6 bg-white/10 rounded w-1/3 mb-4" />
        <div className="h-4 bg-white/10 rounded w-2/3" />
      </div>
    );
  }

  const PlanIcon = getPlanIcon(plan?.id);
  const statusColor = getStatusColor(statusInfo?.status);

  return (
    <div className="bg-[#1A1F35] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${getPlanBg(plan?.id)}`}>
              <PlanIcon className={`w-5 h-5 ${getPlanColor(plan?.id)}`} />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">{plan?.nameHe || 'חינם'}</h3>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor}`}>
                  {statusInfo?.label || 'פעיל'}
                </span>
                {isTrialing && subscription?.trial_ends_at && (
                  <span className="text-xs text-[#94A3B8]">
                    עד {format(new Date(subscription.trial_ends_at), 'd בMMMM', { locale: he })}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Upgrade/Manage Button */}
          {isFreePlan ? (
            <button
              onClick={() => navigate('/pricing')}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#FF6B35] to-[#FF1744] rounded-xl text-white text-sm font-bold hover:shadow-lg hover:shadow-[#FF6B35]/25 transition-all"
            >
              <span>שדרג</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => navigate('/pricing')}
              className="flex items-center gap-1.5 px-4 py-2 bg-white/5 rounded-xl text-white text-sm hover:bg-white/10 transition-colors"
            >
              <span>ניהול מנוי</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Usage Stats */}
      <div className="p-5">
        {/* Messages Usage */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
              <MessageSquare className="w-4 h-4" />
              <span>הודעות WhatsApp</span>
            </div>
            <span className="text-sm text-white">
              {messagesLimit === Infinity ? (
                'ללא הגבלה'
              ) : messagesLimit === 0 ? (
                <span className="text-[#FF6B35]">לא כלול בתוכנית</span>
              ) : (
                `${messagesUsed} / ${messagesLimit}`
              )}
            </span>
          </div>
          {messagesLimit > 0 && messagesLimit !== Infinity && (
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  messageUsagePercent > 90 ? 'bg-red-500' :
                  messageUsagePercent > 70 ? 'bg-yellow-500' :
                  'bg-[#FF6B35]'
                }`}
                style={{ width: `${Math.min(messageUsagePercent, 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Limits Grid */}
        <div className="grid grid-cols-2 gap-3">
          <LimitItem
            icon={Users}
            label="אנשי צוות"
            value={formatLimit(plan?.limits?.staff || 1)}
          />
          <LimitItem
            icon={Briefcase}
            label="שירותים"
            value={formatLimit(plan?.limits?.services || 2)}
          />
          <LimitItem
            icon={Calendar}
            label="תורים/חודש"
            value={formatLimit(plan?.limits?.bookingsPerMonth || 50)}
          />
        </div>

        {/* Renewal Info */}
        {isPaidPlan && subscription?.current_period_end && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <p className="text-xs text-[#94A3B8] text-center">
              {subscription.status === 'cancelled' ? 'תוקף המנוי עד: ' : 'חידוש אוטומטי ב-'}
              {format(new Date(subscription.current_period_end), 'd בMMMM yyyy', { locale: he })}
            </p>
          </div>
        )}

        {/* Free Plan CTA */}
        {isFreePlan && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <p className="text-xs text-[#94A3B8] text-center mb-3">
              שדרג לתוכנית בתשלום וקבל גישה לכל הפיצ'רים
            </p>
            <button
              onClick={() => navigate('/pricing')}
              className="w-full py-2.5 bg-gradient-to-r from-[#FF6B35]/20 to-[#FF1744]/20 border border-[#FF6B35]/30 rounded-xl text-[#FF6B35] text-sm font-medium hover:border-[#FF6B35]/50 transition-colors"
            >
              צפה בתוכניות
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Limit item display
 */
function LimitItem({ icon: Icon, label, value }) {
  return (
    <div className="bg-white/5 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-[#94A3B8]" />
        <span className="text-xs text-[#94A3B8]">{label}</span>
      </div>
      <p className="text-sm font-medium text-white">{value}</p>
    </div>
  );
}

/**
 * Get plan icon
 */
function getPlanIcon(planId) {
  switch (planId) {
    case 'starter': return Zap;
    case 'pro': return Star;
    case 'premium': return Crown;
    default: return Sparkles;
  }
}

/**
 * Get plan background color
 */
function getPlanBg(planId) {
  switch (planId) {
    case 'starter': return 'bg-blue-500/20';
    case 'pro': return 'bg-[#FF6B35]/20';
    case 'premium': return 'bg-yellow-500/20';
    default: return 'bg-white/10';
  }
}

/**
 * Get plan text color
 */
function getPlanColor(planId) {
  switch (planId) {
    case 'starter': return 'text-blue-400';
    case 'pro': return 'text-[#FF6B35]';
    case 'premium': return 'text-yellow-400';
    default: return 'text-gray-400';
  }
}

/**
 * Get status color
 */
function getStatusColor(status) {
  switch (status) {
    case 'active': return 'bg-green-500/20 text-green-400';
    case 'trial': return 'bg-blue-500/20 text-blue-400';
    case 'cancelled': return 'bg-red-500/20 text-red-400';
    case 'expired': return 'bg-orange-500/20 text-orange-400';
    case 'past_due': return 'bg-yellow-500/20 text-yellow-400';
    case 'grace_period': return 'bg-orange-500/20 text-orange-400';
    default: return 'bg-white/10 text-[#94A3B8]';
  }
}
