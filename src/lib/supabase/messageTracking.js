import { supabase } from './client';

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
  if (!businessId) return { count: 0, limit: 300, month: getCurrentMonth() };

  const currentMonth = getCurrentMonth();

  try {
    const { data, error } = await supabase
      .from('message_usage')
      .select('message_count')
      .eq('business_id', businessId)
      .eq('month', currentMonth)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is fine
      console.error('Error getting message usage:', error);
    }

    // Default limit - will be based on subscription plan later
    const limit = 300; // Free tier limit

    return {
      count: data?.message_count || 0,
      limit: limit,
      month: currentMonth,
      percentage: Math.round(((data?.message_count || 0) / limit) * 100)
    };
  } catch (err) {
    console.error('Error getting message usage:', err);
    return { count: 0, limit: 300, month: currentMonth, percentage: 0 };
  }
}

/**
 * Check if business can send more messages
 */
export async function canSendMessage(businessId) {
  const usage = await getMessageUsage(businessId);
  return {
    canSend: usage.count < usage.limit,
    usage: usage,
    remaining: usage.limit - usage.count
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
