import { supabase } from './client';
import { getCurrentPlan } from '@/services/subscriptionService';
import { PLAN_IDS, getPlan } from '@/config/plans';

/**
 * Message Tracking Service
 * Tracks WhatsApp messages sent per business per month
 */

// Get current month in YYYY-MM format
const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Increment message count for a business
 * Call this every time a WhatsApp message is sent
 */
export async function trackMessage(businessId) {
  if (!businessId) {
    console.warn('trackMessage called without businessId');
    return null;
  }

  const currentMonth = getCurrentMonth();

  try {
    // Try to use the database function first (more efficient)
    const { data, error } = await supabase.rpc('increment_message_count', {
      p_business_id: businessId
    });

    if (error) {
      // Fallback: manual upsert if function doesn't exist
      console.warn('RPC failed, using fallback:', error.message);
      return await trackMessageFallback(businessId, currentMonth);
    }

    return data;
  } catch (err) {
    console.error('Error tracking message:', err);
    return await trackMessageFallback(businessId, currentMonth);
  }
}

/**
 * Fallback method using direct insert/update
 */
async function trackMessageFallback(businessId, currentMonth) {
  // First try to get existing record
  const { data: existing } = await supabase
    .from('message_usage')
    .select('id, message_count')
    .eq('business_id', businessId)
    .eq('month', currentMonth)
    .single();

  if (existing) {
    // Update existing record
    const { data, error } = await supabase
      .from('message_usage')
      .update({ 
        message_count: existing.message_count + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select('message_count')
      .single();

    if (error) throw error;
    return data.message_count;
  } else {
    // Insert new record
    const { data, error } = await supabase
      .from('message_usage')
      .insert({
        business_id: businessId,
        month: currentMonth,
        message_count: 1
      })
      .select('message_count')
      .single();

    if (error) throw error;
    return data.message_count;
  }
}

/**
 * Get current month's message usage for a business
 */
export async function getMessageUsage(businessId) {
  const currentMonth = getCurrentMonth();
  const defaultPlan = getPlan(PLAN_IDS.FREE);

  if (!businessId) {
    return {
      count: 0,
      limit: defaultPlan.limits.messagesPerMonth,
      month: currentMonth,
      percentage: 0
    };
  }

  try {
    // Get message count
    const { data, error } = await supabase
      .from('message_usage')
      .select('message_count')
      .eq('business_id', businessId)
      .eq('month', currentMonth)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error getting message usage:', error);
    }

    // Get subscription plan limit
    let limit;
    try {
      const plan = await getCurrentPlan(businessId);
      limit = plan.limits.messagesPerMonth;
    } catch (e) {
      console.warn('Could not fetch plan, using FREE limit:', e);
      limit = defaultPlan.limits.messagesPerMonth;
    }

    const count = data?.message_count || 0;

    // Handle unlimited case
    if (limit === Infinity) {
      return {
        count,
        limit: Infinity,
        month: currentMonth,
        percentage: 0,
        unlimited: true
      };
    }

    // Handle zero limit (FREE plan)
    if (limit === 0) {
      return {
        count,
        limit: 0,
        month: currentMonth,
        percentage: count > 0 ? 100 : 0,
        disabled: true
      };
    }

    return {
      count,
      limit,
      month: currentMonth,
      percentage: Math.round((count / limit) * 100)
    };
  } catch (err) {
    console.error('Error getting message usage:', err);
    return {
      count: 0,
      limit: defaultPlan.limits.messagesPerMonth,
      month: currentMonth,
      percentage: 0
    };
  }
}

/**
 * Check if business can send more messages
 */
export async function canSendMessage(businessId) {
  const usage = await getMessageUsage(businessId);

  // Unlimited messages
  if (usage.unlimited) {
    return {
      canSend: true,
      usage,
      remaining: Infinity
    };
  }

  // Messages disabled (FREE plan)
  if (usage.disabled || usage.limit === 0) {
    return {
      canSend: false,
      usage,
      remaining: 0,
      reason: 'התוכנית שלך לא כוללת הודעות WhatsApp. שדרג לתוכנית בתשלום.'
    };
  }

  const remaining = Math.max(0, usage.limit - usage.count);

  return {
    canSend: remaining > 0,
    usage,
    remaining,
    reason: remaining === 0 ? 'הגעת למגבלת ההודעות החודשית. שדרג את המנוי לשליחת הודעות נוספות.' : null
  };
}

/**
 * Get message usage history (last 6 months)
 */
export async function getMessageHistory(businessId) {
  if (!businessId) return [];

  try {
    const { data, error } = await supabase
      .from('message_usage')
      .select('month, message_count')
      .eq('business_id', businessId)
      .order('month', { ascending: false })
      .limit(6);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error getting message history:', err);
    return [];
  }
}

export default {
  trackMessage,
  getMessageUsage,
  canSendMessage,
  getMessageHistory
};
