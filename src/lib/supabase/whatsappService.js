import { trackMessage, canSendMessage } from './messageTracking';

const WHATSAPP_API_URL = 'https://linedup-official-production.up.railway.app';

/**
 * WhatsApp Service
 * Centralized service for sending WhatsApp messages with tracking
 */

/**
 * Send a WhatsApp message and track it
 * @param {string} endpoint - API endpoint (e.g., '/api/send-confirmation')
 * @param {object} data - Message data
 * @param {string} businessId - Business ID for tracking
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendMessage(endpoint, data, businessId) {
  try {
    // Check if business can send more messages
    if (businessId) {
      const { canSend, remaining } = await canSendMessage(businessId);
      if (!canSend) {
        console.warn('Message limit reached for business:', businessId);
        return { 
          success: false, 
          error: 'הגעת למגבלת ההודעות החודשית. שדרג את המנוי לשליחת הודעות נוספות.',
          limitReached: true
        };
      }
    }

    // Send the message
    const response = await fetch(`${WHATSAPP_API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (response.ok) {
      // Track the message
      if (businessId) {
        await trackMessage(businessId);
        console.log('📊 Message tracked for business:', businessId);
      }
      return { success: true, data: result };
    } else {
      console.error('WhatsApp API error:', result);
      return { success: false, error: result.error || 'Failed to send message' };
    }
  } catch (error) {
    console.error('WhatsApp service error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send booking confirmation message
 */
export async function sendConfirmation({ phone, clientName, businessName, date, time, serviceName, businessId }) {
  return sendMessage('/api/send-confirmation', {
    phone,
    clientName,
    businessName,
    date,
    time,
    serviceName,
    whatsappEnabled: true
  }, businessId);
}

/**
 * Send booking update/cancellation message
 */
export async function sendUpdate({ phone, clientName, businessName, message, businessId }) {
  return sendMessage('/api/send-update', {
    phone,
    clientName,
    businessName,
    message,
    whatsappEnabled: true
  }, businessId);
}

/**
 * Send waiting list notification
 */
export async function sendWaitingListNotification({ phone, clientName, businessName, date, serviceName, businessId }) {
  return sendMessage('/api/send-waiting-list', {
    phone,
    clientName,
    businessName,
    date,
    serviceName,
    whatsappEnabled: true
  }, businessId);
}

/**
 * Send broadcast message to multiple clients
 */
export async function sendBroadcast({ phones, businessName, message, businessId }) {
  // For broadcast, we track each message sent
  const results = [];
  
  for (const phone of phones) {
    const result = await sendMessage('/api/send-broadcast', {
      phone,
      businessName,
      message
    }, businessId);
    
    results.push({ phone, ...result });
    
    // If limit reached, stop sending
    if (result.limitReached) {
      break;
    }
  }
  
  return {
    success: results.every(r => r.success),
    sent: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results
  };
}

/**
 * Send reminder message
 */
export async function sendReminder({ phone, clientName, businessName, date, time, serviceName, businessId }) {
  return sendMessage('/api/send-reminder', {
    phone,
    clientName,
    businessName,
    date,
    time,
    serviceName
  }, businessId);
}

export default {
  sendConfirmation,
  sendUpdate,
  sendWaitingListNotification,
  sendBroadcast,
  sendReminder
};