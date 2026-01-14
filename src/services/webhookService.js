/**
 * Webhook Service
 *
 * Handles payment webhooks from Grow via Make.com
 *
 * Make.com Flow:
 * 1. Grow sends payment notification to Make.com webhook
 * 2. Make.com extracts payment data and customer phone
 * 3. Make.com calls this webhook endpoint (on Railway backend or Supabase Edge Function)
 * 4. Subscription is activated
 *
 * Expected payload from Make.com:
 * {
 *   event: 'payment.success' | 'payment.failed' | 'subscription.cancelled',
 *   phone: '972501234567', // Customer phone (used to find business)
 *   plan_type: 'starter' | 'pro' | 'premium',
 *   billing_cycle: 'monthly' | 'annual',
 *   amount: 49,
 *   currency: 'ILS',
 *   external_payment_id: 'grow_payment_123',
 *   external_customer_id: 'grow_customer_456',
 *   external_subscription_id: 'grow_sub_789'
 * }
 */

import { supabase } from '@/lib/supabase/client';
import { PLAN_IDS } from '@/config/plans';

/**
 * Process payment webhook from Make.com
 */
export async function processPaymentWebhook(payload) {
  const {
    event,
    phone,
    plan_type,
    billing_cycle,
    amount,
    currency,
    external_payment_id,
    external_customer_id,
    external_subscription_id
  } = payload;

  // Validate required fields
  if (!event || !phone) {
    throw new Error('Missing required fields: event, phone');
  }

  // Find business by owner phone
  const business = await findBusinessByOwnerPhone(phone);
  if (!business) {
    throw new Error(`Business not found for phone: ${phone}`);
  }

  // Handle different event types
  switch (event) {
    case 'payment.success':
      return await handlePaymentSuccess(business.id, {
        plan_type: plan_type || PLAN_IDS.STARTER,
        billing_cycle: billing_cycle || 'monthly',
        amount,
        currency,
        external_payment_id,
        external_customer_id,
        external_subscription_id
      });

    case 'payment.failed':
      return await handlePaymentFailed(business.id, payload);

    case 'subscription.cancelled':
      return await handleSubscriptionCancelled(business.id, payload);

    case 'subscription.renewed':
      return await handleSubscriptionRenewed(business.id, payload);

    default:
      console.warn('Unknown webhook event:', event);
      return { success: true, message: 'Event ignored' };
  }
}

/**
 * Find business by owner's phone number
 */
async function findBusinessByOwnerPhone(phone) {
  // Normalize phone
  let normalizedPhone = phone.replace(/\D/g, '');
  if (normalizedPhone.startsWith('0')) {
    normalizedPhone = '972' + normalizedPhone.substring(1);
  }
  if (!normalizedPhone.startsWith('972')) {
    normalizedPhone = '972' + normalizedPhone;
  }

  // Find profile with this phone
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, business_id')
    .eq('phone', normalizedPhone)
    .single();

  if (profileError || !profile?.business_id) {
    // Try alternative format
    const { data: profileAlt } = await supabase
      .from('profiles')
      .select('id, business_id')
      .eq('phone', phone)
      .single();

    if (!profileAlt?.business_id) {
      return null;
    }
    return { id: profileAlt.business_id };
  }

  return { id: profile.business_id };
}

/**
 * Handle successful payment - activate subscription
 */
async function handlePaymentSuccess(businessId, data) {
  const {
    plan_type,
    billing_cycle,
    amount,
    currency,
    external_payment_id,
    external_customer_id,
    external_subscription_id
  } = data;

  // Normalize billing cycle - database uses 'yearly', API might send 'annual'
  const normalizedCycle = billing_cycle === 'annual' ? 'yearly' : (billing_cycle || 'monthly');

  // Calculate period end date
  const now = new Date();
  const periodEnd = normalizedCycle === 'yearly'
    ? new Date(now.setFullYear(now.getFullYear() + 1))
    : new Date(now.setMonth(now.getMonth() + 1));

  // Upsert subscription
  const { data: subscription, error: subError } = await supabase
    .from('subscriptions')
    .upsert({
      business_id: businessId,
      plan_type,
      billing_cycle: normalizedCycle,
      status: 'active',
      current_period_start: new Date().toISOString(),
      current_period_end: periodEnd.toISOString(),
      external_subscription_id,
      external_customer_id,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'business_id'
    })
    .select()
    .single();

  if (subError) {
    console.error('Error activating subscription:', subError);
    throw subError;
  }

  // Record payment
  if (external_payment_id) {
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        business_id: businessId,
        subscription_id: subscription.id,
        amount: amount || 0,
        currency: currency || 'ILS',
        status: 'completed',
        external_payment_id,
        paid_at: new Date().toISOString()
      });

    if (paymentError) {
      console.error('Error recording payment:', paymentError);
    }
  }

  console.log('Subscription activated:', { businessId, plan_type, billing_cycle });

  return {
    success: true,
    subscription_id: subscription.id,
    plan_type,
    billing_cycle
  };
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(businessId, payload) {
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString()
    })
    .eq('business_id', businessId);

  if (error) {
    console.error('Error updating subscription status:', error);
  }

  // Record failed payment
  if (payload.external_payment_id) {
    await supabase
      .from('payments')
      .insert({
        business_id: businessId,
        amount: payload.amount || 0,
        currency: payload.currency || 'ILS',
        status: 'failed',
        external_payment_id: payload.external_payment_id
      });
  }

  return { success: true, message: 'Payment failure recorded' };
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionCancelled(businessId, payload) {
  // Set grace period (keep features for 7 days after cancellation)
  const gracePeriodEnd = new Date();
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      grace_period_ends_at: gracePeriodEnd.toISOString(),
      cancel_reason: payload.reason || 'User cancelled',
      updated_at: new Date().toISOString()
    })
    .eq('business_id', businessId);

  if (error) {
    console.error('Error cancelling subscription:', error);
    throw error;
  }

  return { success: true, message: 'Subscription cancelled' };
}

/**
 * Handle subscription renewal
 */
async function handleSubscriptionRenewed(businessId, payload) {
  const now = new Date();
  const billingCycle = payload.billing_cycle;
  const periodEnd = (billingCycle === 'yearly' || billingCycle === 'annual')
    ? new Date(now.setFullYear(now.getFullYear() + 1))
    : new Date(now.setMonth(now.getMonth() + 1));

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      current_period_start: new Date().toISOString(),
      current_period_end: periodEnd.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('business_id', businessId);

  if (error) {
    console.error('Error renewing subscription:', error);
    throw error;
  }

  return { success: true, message: 'Subscription renewed' };
}

/**
 * Verify webhook signature (if Grow provides one)
 */
export function verifyWebhookSignature(payload, signature, secret) {
  // Implement signature verification if Grow/Make.com provides a secret
  // This is optional but recommended for security
  return true;
}

export default {
  processPaymentWebhook,
  verifyWebhookSignature
};
