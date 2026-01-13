/**
 * LinedUp Subscription Plans Configuration
 * 
 * This file contains all plan definitions including:
 * - Pricing (monthly & annual)
 * - Limits (staff, services, messages, bookings, clients)
 * - Features (what's included in each plan)
 * - Grow payment links
 */

// Grow Payment Links
export const GROW_LINKS = {
  monthly: 'https://pay.grow.link/3ba886feae7cd44666ee681dfaadd2ce-Mjk2NDU2Mw',
  annual: 'https://pay.grow.link/d5cba3b1c23b75cd189355f3bf1ce0ec-Mjk2NDYzOQ',
};

// Plan IDs
export const PLAN_IDS = {
  FREE: 'free',
  STARTER: 'starter',
  PRO: 'pro',
  PREMIUM: 'premium',
};

// Plan Display Order
export const PLAN_ORDER = [PLAN_IDS.FREE, PLAN_IDS.STARTER, PLAN_IDS.PRO, PLAN_IDS.PREMIUM];

// Full Plan Definitions
export const PLANS = {
  [PLAN_IDS.FREE]: {
    id: PLAN_IDS.FREE,
    name: 'FREE',
    nameHe: 'חינם',
    description: 'מושלם להתחלה ולהכרת המערכת',
    icon: '🆓',
    popular: false,
    
    // Pricing
    pricing: {
      monthly: 0,
      annual: 0,
      currency: 'ILS',
    },
    
    // Limits
    limits: {
      staff: 1,
      services: 2,
      messagesPerMonth: 0,
      bookingsPerMonth: 50,
      clients: 25,
    },
    
    // Features
    features: {
      bookingManagement: true,
      calendarSync: true,
      serviceManagement: true,
      autoReminders: false,
      whatsappConfirmations: false,
      statistics: false,
      newClientApproval: false,
      bookingVisibility: false,
      waitingList: false,
      recurringBookings: false,
      cancellationPolicy: false,
      externalCalendarShare: false,
      dataExport: false,
      broadcastMessages: false,
      prioritySupport: false,
      multipleStaff: false,
    },
  },
  
  [PLAN_IDS.STARTER]: {
    id: PLAN_IDS.STARTER,
    name: 'STARTER',
    nameHe: 'סטארטר',
    description: 'לעסקים קטנים שרוצים לצמוח',
    icon: '🚀',
    popular: false,
    
    // Pricing
    pricing: {
      monthly: 49,
      annual: 490, // 2 months free (10 months price)
      currency: 'ILS',
    },
    
    // Limits
    limits: {
      staff: 1,
      services: 5,
      messagesPerMonth: 200,
      bookingsPerMonth: Infinity,
      clients: Infinity,
    },
    
    // Features
    features: {
      bookingManagement: true,
      calendarSync: true,
      serviceManagement: true,
      autoReminders: true,
      whatsappConfirmations: false,
      statistics: true,
      newClientApproval: true,
      bookingVisibility: true,
      waitingList: false,
      recurringBookings: false,
      cancellationPolicy: false,
      externalCalendarShare: false,
      dataExport: false,
      broadcastMessages: false,
      prioritySupport: false,
      multipleStaff: false,
    },
  },
  
  [PLAN_IDS.PRO]: {
    id: PLAN_IDS.PRO,
    name: 'PRO',
    nameHe: 'פרו',
    description: 'לעסקים מקצועיים שרוצים הכל',
    icon: '⭐',
    popular: true,
    
    // Pricing
    pricing: {
      monthly: 79,
      annual: 790, // 2 months free
      currency: 'ILS',
    },
    
    // Limits
    limits: {
      staff: 1,
      services: 10,
      messagesPerMonth: 750,
      bookingsPerMonth: Infinity,
      clients: Infinity,
    },
    
    // Features
    features: {
      bookingManagement: true,
      calendarSync: true,
      serviceManagement: true,
      autoReminders: true,
      whatsappConfirmations: true,
      statistics: true,
      newClientApproval: true,
      bookingVisibility: true,
      waitingList: true,
      recurringBookings: true,
      cancellationPolicy: true,
      externalCalendarShare: true,
      dataExport: true,
      broadcastMessages: false,
      prioritySupport: false,
      multipleStaff: false,
    },
  },
  
  [PLAN_IDS.PREMIUM]: {
    id: PLAN_IDS.PREMIUM,
    name: 'PREMIUM',
    nameHe: 'פרימיום',
    description: 'לעסקים עם צוות עובדים',
    icon: '👑',
    popular: false,
    
    // Pricing
    pricing: {
      monthly: 129,
      annual: 1290, // 2 months free
      currency: 'ILS',
    },
    
    // Limits
    limits: {
      staff: Infinity,
      services: Infinity,
      messagesPerMonth: Infinity,
      bookingsPerMonth: Infinity,
      clients: Infinity,
    },
    
    // Features
    features: {
      bookingManagement: true,
      calendarSync: true,
      serviceManagement: true,
      autoReminders: true,
      whatsappConfirmations: true,
      statistics: true,
      newClientApproval: true,
      bookingVisibility: true,
      waitingList: true,
      recurringBookings: true,
      cancellationPolicy: true,
      externalCalendarShare: true,
      dataExport: true,
      broadcastMessages: true,
      prioritySupport: true,
      multipleStaff: true,
    },
  },
};

// Feature Display Names (Hebrew)
export const FEATURE_NAMES = {
  bookingManagement: 'מערכת ניהול תורים',
  calendarSync: 'סנכרון ללוח שנה',
  serviceManagement: 'ניהול שירותים',
  autoReminders: 'תזכורות אוטומטיות (WhatsApp)',
  whatsappConfirmations: 'אישורי תור/שינוי/ביטול (WhatsApp)',
  statistics: 'סטטיסטיקות',
  newClientApproval: 'מערכת אישורים ללקוחות חדשים',
  bookingVisibility: 'הגדרת חשיפת תורים ללקוחות',
  waitingList: 'רשימת המתנה',
  recurringBookings: 'תורים חוזרים',
  cancellationPolicy: 'הגדרת מדיניות ביטולים',
  externalCalendarShare: 'שיתוף לוח זמנים חיצוני',
  dataExport: 'ייצוא נתונים',
  broadcastMessages: 'שליחה המונית',
  prioritySupport: 'תמיכה בעדיפות',
  multipleStaff: 'ריבוי אנשי צוות',
};

// Limit Display Names (Hebrew)
export const LIMIT_NAMES = {
  staff: 'אנשי צוות',
  services: 'שירותים',
  messagesPerMonth: 'הודעות WhatsApp בחודש',
  bookingsPerMonth: 'תורים בחודש',
  clients: 'לקוחות',
};

// Helper Functions

/**
 * Get plan by ID
 */
export function getPlan(planId) {
  return PLANS[planId] || PLANS[PLAN_IDS.FREE];
}

/**
 * Get plan price (monthly or annual)
 */
export function getPlanPrice(planId, billingCycle = 'monthly') {
  const plan = getPlan(planId);
  return plan.pricing[billingCycle];
}

/**
 * Get monthly equivalent price for annual billing
 */
export function getMonthlyEquivalent(planId) {
  const plan = getPlan(planId);
  return Math.round(plan.pricing.annual / 12);
}

/**
 * Get annual savings amount
 */
export function getAnnualSavings(planId) {
  const plan = getPlan(planId);
  const yearlyAtMonthlyRate = plan.pricing.monthly * 12;
  return yearlyAtMonthlyRate - plan.pricing.annual;
}

/**
 * Check if a plan has a specific feature
 */
export function hasFeature(planId, featureKey) {
  const plan = getPlan(planId);
  return plan.features[featureKey] || false;
}

/**
 * Get plan limit value
 */
export function getLimit(planId, limitKey) {
  const plan = getPlan(planId);
  return plan.limits[limitKey];
}

/**
 * Format limit value for display
 */
export function formatLimit(value) {
  if (value === Infinity) {
    return 'ללא הגבלה';
  }
  return value.toString();
}

/**
 * Check if plan B is an upgrade from plan A
 */
export function isUpgrade(fromPlanId, toPlanId) {
  const fromIndex = PLAN_ORDER.indexOf(fromPlanId);
  const toIndex = PLAN_ORDER.indexOf(toPlanId);
  return toIndex > fromIndex;
}

/**
 * Get next upgrade plan
 */
export function getNextPlan(currentPlanId) {
  const currentIndex = PLAN_ORDER.indexOf(currentPlanId);
  if (currentIndex < PLAN_ORDER.length - 1) {
    return PLANS[PLAN_ORDER[currentIndex + 1]];
  }
  return null;
}

/**
 * Get Grow payment link based on billing cycle
 */
export function getPaymentLink(billingCycle = 'monthly') {
  return GROW_LINKS[billingCycle];
}

/**
 * Get all paid plans (excluding free)
 */
export function getPaidPlans() {
  return PLAN_ORDER.filter(id => id !== PLAN_IDS.FREE).map(id => PLANS[id]);
}

export default PLANS;