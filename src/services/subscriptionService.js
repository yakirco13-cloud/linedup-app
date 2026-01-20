/**
 * Subscription Service
 * 
 * Handles all subscription-related logic:
 * - Checking plan limits
 * - Checking feature access
 * - Usage tracking
 * - Subscription status
 */

import { supabase } from '@/lib/supabase/client';
import { PLANS, PLAN_IDS, getPlan, hasFeature, getLimit, formatLimit } from '@/config/plans';
import { format } from 'date-fns';

/**
 * Get current subscription for a business
 */
export async function getSubscription(businessId) {
  if (!businessId) return null;

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching subscription:', error);
    return null;
  }

  return data;
}

/**
 * Get current plan for a business (with fallback to FREE)
 */
export async function getCurrentPlan(businessId) {
  const subscription = await getSubscription(businessId);

  if (!subscription) {
    return getPlan(PLAN_IDS.FREE);
  }

  // Check if subscription is active
  const isActive = checkSubscriptionStatus(subscription);

  if (!isActive) {
    return getPlan(PLAN_IDS.FREE);
  }

  const plan = getPlan(subscription.plan_type);
  return plan || getPlan(PLAN_IDS.FREE);
}

/**
 * Check if subscription is active
 */
export function checkSubscriptionStatus(subscription) {
  if (!subscription) return false;

  const now = new Date();
  const status = subscription.status;

  // Active subscription
  if (status === 'active') {
    // Check if within current period
    if (subscription.current_period_end) {
      return new Date(subscription.current_period_end) > now;
    }
    return true;
  }

  // Trial subscription
  if (status === 'trial') {
    if (subscription.trial_ends_at) {
      return new Date(subscription.trial_ends_at) > now;
    }
    return true;
  }

  // Grace period status
  if (status === 'grace_period') {
    if (subscription.grace_period_ends_at) {
      return new Date(subscription.grace_period_ends_at) > now;
    }
    return true;
  }

  // Legacy: expired with grace period
  if (status === 'expired' && subscription.grace_period_ends_at) {
    return new Date(subscription.grace_period_ends_at) > now;
  }

  return false;
}

/**
 * Get usage for current month
 */
export async function getMonthlyUsage(businessId) {
  if (!businessId) return null;

  const currentMonth = format(new Date(), 'yyyy-MM');

  const { data, error } = await supabase
    .from('message_usage')
    .select('*')
    .eq('business_id', businessId)
    .eq('month', currentMonth)
    .maybeSingle();

  if (error) {
    console.error('Error fetching usage:', error);
  }

  return data || {
    message_count: 0,
    bookings_count: 0,
    clients_count: 0,
  };
}

/**
 * Increment message count
 */
export async function incrementMessageCount(businessId) {
  if (!businessId) return false;
  
  const currentMonth = format(new Date(), 'yyyy-MM');
  
  // Try to update existing record
  const { data: existing } = await supabase
    .from('message_usage')
    .select('id, message_count')
    .eq('business_id', businessId)
    .eq('month', currentMonth)
    .single();
  
  if (existing) {
    const { error } = await supabase
      .from('message_usage')
      .update({ 
        message_count: existing.message_count + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);
    
    return !error;
  } else {
    // Create new record
    const { error } = await supabase
      .from('message_usage')
      .insert({
        business_id: businessId,
        month: currentMonth,
        message_count: 1,
      });
    
    return !error;
  }
}

/**
 * Check if business can send more messages
 */
export async function canSendMessage(businessId) {
  const plan = await getCurrentPlan(businessId);
  const limit = plan.limits.messagesPerMonth;
  
  // Unlimited messages
  if (limit === Infinity) {
    return { allowed: true, remaining: Infinity };
  }
  
  // No messages allowed (FREE plan)
  if (limit === 0) {
    return { allowed: false, remaining: 0, reason: 'התוכנית שלך לא כוללת הודעות WhatsApp' };
  }
  
  const usage = await getMonthlyUsage(businessId);
  const used = usage?.message_count || 0;
  const remaining = Math.max(0, limit - used);
  
  return {
    allowed: remaining > 0,
    remaining,
    used,
    limit,
    reason: remaining === 0 ? 'הגעת למגבלת ההודעות החודשית' : null,
  };
}

/**
 * Check if business can add more staff
 */
export async function canAddStaff(businessId) {
  const plan = await getCurrentPlan(businessId);
  const limit = plan.limits.staff;
  
  if (limit === Infinity) {
    return { allowed: true, remaining: Infinity };
  }
  
  // Count current staff
  const { count, error } = await supabase
    .from('staff')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', businessId);
  
  if (error) {
    console.error('Error counting staff:', error);
    return { allowed: false, reason: 'שגיאה בבדיקת מגבלות' };
  }
  
  const remaining = Math.max(0, limit - (count || 0));
  
  return {
    allowed: remaining > 0,
    remaining,
    used: count || 0,
    limit,
    reason: remaining === 0 ? 'הגעת למגבלת אנשי הצוות. שדרג לתוכנית PREMIUM' : null,
  };
}

/**
 * Check if business can add more services
 */
export async function canAddService(businessId) {
  const plan = await getCurrentPlan(businessId);
  const limit = plan.limits.services;
  
  if (limit === Infinity) {
    return { allowed: true, remaining: Infinity };
  }
  
  // Count current services
  const { count, error } = await supabase
    .from('services')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', businessId);
  
  if (error) {
    console.error('Error counting services:', error);
    return { allowed: false, reason: 'שגיאה בבדיקת מגבלות' };
  }
  
  const remaining = Math.max(0, limit - (count || 0));
  
  return {
    allowed: remaining > 0,
    remaining,
    used: count || 0,
    limit,
    reason: remaining === 0 ? 'הגעת למגבלת השירותים. שדרג לתוכנית גבוהה יותר' : null,
  };
}

/**
 * Check if business can create more bookings this month
 */
export async function canCreateBooking(businessId) {
  const plan = await getCurrentPlan(businessId);
  const limit = plan.limits.bookingsPerMonth;
  
  if (limit === Infinity) {
    return { allowed: true, remaining: Infinity };
  }
  
  // Count bookings this month
  const startOfMonth = format(new Date(), 'yyyy-MM-01');
  
  const { count, error } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .gte('created_at', startOfMonth);
  
  if (error) {
    console.error('Error counting bookings:', error);
    return { allowed: false, reason: 'שגיאה בבדיקת מגבלות' };
  }
  
  const remaining = Math.max(0, limit - (count || 0));
  
  return {
    allowed: remaining > 0,
    remaining,
    used: count || 0,
    limit,
    reason: remaining === 0 ? 'הגעת למגבלת התורים החודשית. שדרג לתוכנית בתשלום' : null,
  };
}

/**
 * Check if business can add more clients
 */
export async function canAddClient(businessId) {
  const plan = await getCurrentPlan(businessId);
  const limit = plan.limits.clients;
  
  if (limit === Infinity) {
    return { allowed: true, remaining: Infinity };
  }
  
  // Count unique clients (by phone) from bookings
  const { data, error } = await supabase
    .from('bookings')
    .select('client_phone')
    .eq('business_id', businessId);
  
  if (error) {
    console.error('Error counting clients:', error);
    return { allowed: false, reason: 'שגיאה בבדיקת מגבלות' };
  }
  
  const uniqueClients = new Set(data?.map(b => b.client_phone).filter(Boolean));
  const count = uniqueClients.size;
  const remaining = Math.max(0, limit - count);
  
  return {
    allowed: remaining > 0,
    remaining,
    used: count,
    limit,
    reason: remaining === 0 ? 'הגעת למגבלת הלקוחות. שדרג לתוכנית בתשלום' : null,
  };
}

/**
 * Check if business has access to a feature
 */
export async function checkFeatureAccess(businessId, featureKey) {
  const plan = await getCurrentPlan(businessId);
  const hasAccess = plan.features[featureKey] || false;
  
  return {
    allowed: hasAccess,
    planRequired: !hasAccess ? getRequiredPlanForFeature(featureKey) : null,
    reason: !hasAccess ? `פיצ'ר זה זמין בתוכניות גבוהות יותר` : null,
  };
}

/**
 * Get the minimum required plan for a feature
 */
export function getRequiredPlanForFeature(featureKey) {
  for (const planId of [PLAN_IDS.FREE, PLAN_IDS.STARTER, PLAN_IDS.PRO, PLAN_IDS.PREMIUM]) {
    if (PLANS[planId].features[featureKey]) {
      return PLANS[planId];
    }
  }
  return null;
}

/**
 * Get subscription status display info
 */
export function getSubscriptionStatusInfo(subscription) {
  if (!subscription) {
    return {
      status: 'none',
      label: 'ללא מנוי',
      color: 'gray',
      isActive: false,
    };
  }
  
  const isActive = checkSubscriptionStatus(subscription);
  
  const statusMap = {
    trial: { label: 'תקופת ניסיון', color: 'blue' },
    active: { label: 'פעיל', color: 'green' },
    cancelled: { label: 'בוטל', color: 'red' },
    expired: { label: 'פג תוקף', color: 'orange' },
    past_due: { label: 'ממתין לתשלום', color: 'yellow' },
    grace_period: { label: 'תקופת חסד', color: 'orange' },
  };
  
  const info = statusMap[subscription.status] || { label: subscription.status, color: 'gray' };
  
  return {
    status: subscription.status,
    ...info,
    isActive,
  };
}

/**
 * Create or update subscription (for manual activation)
 */
export async function activateSubscription(businessId, planType, billingCycle, externalPaymentId = null) {
  const now = new Date();
  // Database uses 'yearly', but UI might pass 'annual' - normalize it
  const normalizedCycle = billingCycle === 'annual' ? 'yearly' : billingCycle;

  // Create a new Date object for periodEnd to avoid mutating 'now'
  const periodEnd = new Date(now);
  if (normalizedCycle === 'yearly') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }
  
  // Check for existing subscription
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('business_id', businessId)
    .single();
  
  const subscriptionData = {
    business_id: businessId,
    plan_type: planType,
    billing_cycle: normalizedCycle,
    status: 'active',
    current_period_start: new Date().toISOString(),
    current_period_end: periodEnd.toISOString(),
    external_subscription_id: externalPaymentId,
    updated_at: new Date().toISOString(),
  };
  
  if (existing) {
    // Update existing
    const { error } = await supabase
      .from('subscriptions')
      .update(subscriptionData)
      .eq('id', existing.id);
    
    if (error) throw error;
  } else {
    // Create new
    const { error } = await supabase
      .from('subscriptions')
      .insert({
        ...subscriptionData,
        trial_starts_at: null,
        trial_ends_at: null,
      });
    
    if (error) throw error;
  }
  
  return true;
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(businessId, reason = null) {
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancel_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('business_id', businessId);
  
  if (error) throw error;
  return true;
}

export default {
  getSubscription,
  getCurrentPlan,
  checkSubscriptionStatus,
  getMonthlyUsage,
  incrementMessageCount,
  canSendMessage,
  canAddStaff,
  canAddService,
  canCreateBooking,
  canAddClient,
  checkFeatureAccess,
  getRequiredPlanForFeature,
  getSubscriptionStatusInfo,
  activateSubscription,
  cancelSubscription,
};