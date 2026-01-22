/**
 * Demo Account Configuration
 *
 * These accounts are used for Apple App Store review.
 * When logged in as these accounts, subscription/pricing UI is hidden.
 */

// Demo account phone numbers (normalized format: 972XXXXXXXXX)
export const DEMO_ACCOUNTS = {
  // Business owner demo account
  owner: '972500000001',
  // Client demo account
  client: '972500000002',
};

// All demo phone numbers as an array
export const DEMO_PHONE_NUMBERS = Object.values(DEMO_ACCOUNTS);

/**
 * Check if a phone number belongs to a demo account
 * @param {string} phone - Phone number (can be in any format)
 * @returns {boolean}
 */
export function isDemoAccount(phone) {
  if (!phone) return false;

  // Normalize the phone number
  let normalized = phone.replace(/\D/g, '');
  if (normalized.startsWith('0')) {
    normalized = '972' + normalized.substring(1);
  }
  if (!normalized.startsWith('972')) {
    normalized = '972' + normalized;
  }

  return DEMO_PHONE_NUMBERS.includes(normalized);
}

/**
 * Check if the current user is a demo account
 * @param {object} user - User object from useUser()
 * @returns {boolean}
 */
export function isUserDemoAccount(user) {
  return isDemoAccount(user?.phone);
}
