/**
 * Centralized WhatsApp Service
 * All WhatsApp message sending goes through here
 *
 * This ensures:
 * - Consistent API URL usage
 * - Centralized error handling
 * - Future message tracking integration
 * - Single place to update templates
 * - Plan-based access control
 */

import { canSendMessage, incrementMessageCount } from './subscriptionService';

// Use environment variable or fallback to production URL
const WHATSAPP_API_URL = import.meta.env.VITE_WHATSAPP_API_URL || 'https://linedup-official-production.up.railway.app';

// API Key for secure communication with Railway server
const API_KEY = import.meta.env.VITE_WHATSAPP_API_KEY || '';

/**
 * Check if business can send WhatsApp messages based on plan
 * @param {string} businessId - Business ID
 * @returns {Promise<{allowed: boolean, reason?: string}>}
 */
async function checkMessageAllowed(businessId) {
  if (!businessId) {
    return { allowed: true }; // Allow if no businessId (OTP, etc.)
  }

  const result = await canSendMessage(businessId);
  return result;
}

/**
 * Base function for making WhatsApp API calls
 * @param {string} endpoint - API endpoint (e.g., '/api/send-confirmation')
 * @param {object} data - Request body
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendRequest(endpoint, data) {
  try {
    const headers = { 'Content-Type': 'application/json' };

    // Add API key if configured
    if (API_KEY) {
      headers['X-API-Key'] = API_KEY;
    }

    const response = await fetch(`${WHATSAPP_API_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const result = await response.json().catch(() => ({}));
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Send OTP code for phone verification
 * @param {string} phone - Phone number
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendOTP(phone) {
  return sendRequest('/api/otp/send', { phone });
}

/**
 * Verify OTP code
 * @param {string} phone - Phone number
 * @param {string} code - OTP code entered by user
 * @returns {Promise<{success: boolean, verified?: boolean, error?: string}>}
 */
export async function verifyOTP(phone, code) {
  return sendRequest('/api/otp/verify', { phone, code });
}

/**
 * Send booking confirmation message
 * @param {object} params
 * @param {string} params.phone - Client phone number
 * @param {string} params.clientName - Client name
 * @param {string} params.businessName - Business name
 * @param {string} params.date - Booking date
 * @param {string} params.time - Booking time
 * @param {string} [params.serviceName] - Service name (optional)
 * @param {string} [params.businessId] - Business ID for plan check
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendConfirmation({ phone, clientName, businessName, date, time, serviceName, businessId }) {
  if (!phone) {
    return { success: false, error: 'No phone number' };
  }

  // Check if business can send messages based on plan
  if (businessId) {
    const planCheck = await checkMessageAllowed(businessId);
    if (!planCheck.allowed) {
      return { success: false, error: planCheck.reason, planBlocked: true };
    }
  }

  const result = await sendRequest('/api/send-confirmation', {
    phone,
    clientName,
    businessName,
    date,
    time,
    serviceName,
    whatsappEnabled: true
  });

  // Increment message count on successful send
  if (result.success && businessId) {
    await incrementMessageCount(businessId);
  }

  return result;
}

/**
 * Send booking cancellation message
 * @param {object} params
 * @param {string} params.phone - Client phone number
 * @param {string} params.clientName - Client name
 * @param {string} params.serviceName - Service name
 * @param {string} params.date - Booking date
 * @param {string} [params.businessId] - Business ID for plan check
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendCancellation({ phone, clientName, serviceName, date, businessId }) {
  if (!phone) {
    return { success: false, error: 'No phone number' };
  }

  // Check if business can send messages based on plan
  if (businessId) {
    const planCheck = await checkMessageAllowed(businessId);
    if (!planCheck.allowed) {
      return { success: false, error: planCheck.reason, planBlocked: true };
    }
  }

  const result = await sendRequest('/api/send-cancellation', {
    phone,
    clientName: clientName || 'לקוח',
    serviceName: serviceName || 'תור',
    date
  });

  // Increment message count on successful send
  if (result.success && businessId) {
    await incrementMessageCount(businessId);
  }

  return result;
}

/**
 * Send booking update message (reschedule notification)
 * @param {object} params
 * @param {string} params.phone - Client phone number
 * @param {string} params.clientName - Client name
 * @param {string} params.businessName - Business name
 * @param {string} [params.oldDate] - Old booking date
 * @param {string} [params.oldTime] - Old booking time
 * @param {string} [params.newDate] - New booking date
 * @param {string} [params.newTime] - New booking time
 * @param {string} [params.businessId] - Business ID for plan check
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendUpdate({ phone, clientName, businessName, oldDate, oldTime, newDate, newTime, businessId }) {
  if (!phone) {
    return { success: false, error: 'No phone number' };
  }

  // Check if business can send messages based on plan
  if (businessId) {
    const planCheck = await checkMessageAllowed(businessId);
    if (!planCheck.allowed) {
      return { success: false, error: planCheck.reason, planBlocked: true };
    }
  }

  const result = await sendRequest('/api/send-update', {
    phone,
    clientName,
    businessName,
    oldDate,
    oldTime,
    newDate,
    newTime,
    whatsappEnabled: true
  });

  // Increment message count on successful send
  if (result.success && businessId) {
    await incrementMessageCount(businessId);
  }

  return result;
}

/**
 * Send waiting list notification (slot became available)
 * @param {object} params
 * @param {string} params.phone - Client phone number
 * @param {string} params.clientName - Client name
 * @param {string} params.date - Date with available slot
 * @param {string} [params.serviceName] - Service name (optional)
 * @param {string} [params.businessId] - Business ID for plan check
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendWaitingListNotification({ phone, clientName, date, serviceName, businessId }) {
  if (!phone) {
    return { success: false, error: 'No phone number' };
  }

  // Check if business can send messages based on plan
  if (businessId) {
    const planCheck = await checkMessageAllowed(businessId);
    if (!planCheck.allowed) {
      return { success: false, error: planCheck.reason, planBlocked: true };
    }
  }

  const result = await sendRequest('/api/send-waiting-list', {
    phone,
    clientName,
    date,
    serviceName
  });

  // Increment message count on successful send
  if (result.success && businessId) {
    await incrementMessageCount(businessId);
  }

  return result;
}

/**
 * Send reminder message
 * @param {object} params
 * @param {string} params.phone - Client phone number
 * @param {string} params.clientName - Client name
 * @param {string} params.businessName - Business name
 * @param {string} params.date - Booking date
 * @param {string} params.time - Booking time
 * @param {string} [params.serviceName] - Service name (optional)
 * @param {string} [params.businessId] - Business ID for plan check
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendReminder({ phone, clientName, businessName, date, time, serviceName, businessId }) {
  if (!phone) {
    return { success: false, error: 'No phone number' };
  }

  // Check if business can send messages based on plan
  if (businessId) {
    const planCheck = await checkMessageAllowed(businessId);
    if (!planCheck.allowed) {
      return { success: false, error: planCheck.reason, planBlocked: true };
    }
  }

  const result = await sendRequest('/api/send-reminder', {
    phone,
    clientName,
    businessName,
    date,
    time,
    serviceName,
    whatsappEnabled: true
  });

  // Increment message count on successful send
  if (result.success && businessId) {
    await incrementMessageCount(businessId);
  }

  return result;
}

/**
 * Send broadcast message to multiple recipients
 * @param {object} params
 * @param {string[]} params.phones - Array of phone numbers
 * @param {string} params.message - Message content
 * @param {string} params.businessName - Business name
 * @returns {Promise<{success: boolean, sent: number, failed: number, error?: string}>}
 */
export async function sendBroadcast({ phones, message, businessName }) {
  if (!phones || phones.length === 0) {
    return { success: false, sent: 0, failed: 0, error: 'No phone numbers' };
  }
  
  return sendRequest('/api/send-broadcast', {
    phones,
    message,
    businessName
  });
}

export default {
  sendOTP,
  verifyOTP,
  sendConfirmation,
  sendCancellation,
  sendUpdate,
  sendWaitingListNotification,
  sendReminder,
  sendBroadcast,
  WHATSAPP_API_URL
};