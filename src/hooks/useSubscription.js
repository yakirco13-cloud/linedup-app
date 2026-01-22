/**
 * useSubscription Hook
 * 
 * React hook for accessing subscription data and checking permissions
 * in components throughout the app.
 * 
 * Usage:
 * const { plan, canUseFeature, checkLimit, usage, isLoading } = useSubscription();
 */

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/components/UserContext';
import { isUserDemoAccount } from '@/utils/demoAccounts';
import {
  getSubscription,
  getCurrentPlan,
  getMonthlyUsage,
  canSendMessage,
  canAddStaff,
  canAddService,
  canCreateBooking,
  canAddClient,
  checkFeatureAccess,
  getSubscriptionStatusInfo,
} from '@/services/subscriptionService';
import { PLANS, PLAN_IDS, getPaymentLink, getPlan } from '@/config/plans';

export function useSubscription() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const businessId = user?.business_id;

  // Fetch subscription data
  const {
    data: subscription,
    isLoading: subscriptionLoading,
    refetch: refetchSubscription,
  } = useQuery({
    queryKey: ['subscription', businessId],
    queryFn: () => getSubscription(businessId),
    enabled: !!businessId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch current plan
  const {
    data: plan,
    isLoading: planLoading,
  } = useQuery({
    queryKey: ['current-plan', businessId],
    queryFn: () => getCurrentPlan(businessId),
    enabled: !!businessId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch monthly usage
  const {
    data: usage,
    isLoading: usageLoading,
    refetch: refetchUsage,
  } = useQuery({
    queryKey: ['monthly-usage', businessId],
    queryFn: () => getMonthlyUsage(businessId),
    enabled: !!businessId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });

  // Get subscription status info
  const statusInfo = getSubscriptionStatusInfo(subscription);

  // Check if user can use a feature
  const canUseFeature = useCallback((featureKey) => {
    if (!plan) return false;
    return plan.features[featureKey] || false;
  }, [plan]);

  // Get limit for current plan
  const getLimit = useCallback((limitKey) => {
    if (!plan) return 0;
    return plan.limits[limitKey];
  }, [plan]);

  // Check various limits
  const checkMessageLimit = useCallback(async () => {
    if (!businessId) return { allowed: false };
    return canSendMessage(businessId);
  }, [businessId]);

  const checkStaffLimit = useCallback(async () => {
    if (!businessId) return { allowed: false };
    return canAddStaff(businessId);
  }, [businessId]);

  const checkServiceLimit = useCallback(async () => {
    if (!businessId) return { allowed: false };
    return canAddService(businessId);
  }, [businessId]);

  const checkBookingLimit = useCallback(async () => {
    if (!businessId) return { allowed: false };
    return canCreateBooking(businessId);
  }, [businessId]);

  const checkClientLimit = useCallback(async () => {
    if (!businessId) return { allowed: false };
    return canAddClient(businessId);
  }, [businessId]);

  // Check feature access with upgrade info
  const checkFeature = useCallback(async (featureKey) => {
    if (!businessId) return { allowed: false };
    return checkFeatureAccess(businessId, featureKey);
  }, [businessId]);

  // Get payment link
  const getUpgradeLink = useCallback((billingCycle = 'monthly') => {
    return getPaymentLink(billingCycle);
  }, []);

  // Computed values
  const isFreePlan = plan?.id === PLAN_IDS.FREE;
  const isPaidPlan = plan?.id && plan.id !== PLAN_IDS.FREE;
  const isTrialing = subscription?.status === 'trial';
  const isActive = statusInfo.isActive;

  // Usage percentages
  const messageUsagePercent = !plan?.limits?.messagesPerMonth || plan.limits.messagesPerMonth === Infinity 
    ? 0 
    : plan.limits.messagesPerMonth === 0 
      ? 100 
      : Math.round(((usage?.message_count || 0) / plan.limits.messagesPerMonth) * 100);

  // Refresh all subscription data
  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['subscription', businessId] });
    queryClient.invalidateQueries({ queryKey: ['current-plan', businessId] });
    queryClient.invalidateQueries({ queryKey: ['monthly-usage', businessId] });
  }, [queryClient, businessId]);

  return {
    // Data
    subscription,
    plan: plan || getPlan(PLAN_IDS.FREE),
    usage,
    statusInfo,
    
    // Loading states
    isLoading: subscriptionLoading || planLoading,
    isUsageLoading: usageLoading,
    
    // Plan info
    isFreePlan,
    isPaidPlan,
    isTrialing,
    isActive,
    planId: plan?.id || PLAN_IDS.FREE,
    planName: plan?.name || 'FREE',
    
    // Feature & limit checks
    canUseFeature,
    getLimit,
    checkMessageLimit,
    checkStaffLimit,
    checkServiceLimit,
    checkBookingLimit,
    checkClientLimit,
    checkFeature,
    
    // Usage stats
    messageUsagePercent,
    messagesUsed: usage?.message_count || 0,
    messagesLimit: plan?.limits.messagesPerMonth || 0,
    
    // Actions
    getUpgradeLink,
    refresh,
    refetchSubscription,
    refetchUsage,
  };
}

/**
 * Hook for checking a specific feature with upgrade prompt
 */
export function useFeatureCheck(featureKey) {
  const { user } = useUser();
  const { canUseFeature, plan, getUpgradeLink } = useSubscription();

  // Demo accounts have full access to all features
  const isDemoUser = isUserDemoAccount(user);
  const hasAccess = isDemoUser || canUseFeature(featureKey);

  return {
    hasAccess,
    requiredPlan: !hasAccess ? getRequiredPlanForFeature(featureKey) : null,
    upgradeLink: !hasAccess ? getUpgradeLink() : null,
    currentPlan: plan,
  };
}

/**
 * Helper to get required plan for a feature
 */
function getRequiredPlanForFeature(featureKey) {
  for (const planId of [PLAN_IDS.FREE, PLAN_IDS.STARTER, PLAN_IDS.PRO, PLAN_IDS.PREMIUM]) {
    if (PLANS[planId].features[featureKey]) {
      return PLANS[planId];
    }
  }
  return null;
}

export default useSubscription;