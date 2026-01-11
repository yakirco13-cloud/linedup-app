/**
 * Services Index
 * Central export point for all services
 * 
 * Usage:
 *   import { dateService, whatsappService, waitingListService } from '@/services';
 * 
 * Or import specific functions:
 *   import { toISO, parseDate } from '@/services/dateService';
 *   import { sendConfirmation } from '@/services/whatsappService';
 */

// Date utilities
export * from './dateService';
export { default as dateService } from './dateService';

// WhatsApp messaging
export * from './whatsappService';
export { default as whatsappService } from './whatsappService';

// Waiting list logic
export * from './waitingListService';
export { default as waitingListService } from './waitingListService';

// Availability calculations
export * from './availabilityService';
export { default as availabilityService } from './availabilityService';

// Query keys registry
export * from './queryKeys';
export { default as queryKeys } from './queryKeys';
