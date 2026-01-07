import { supabase } from './client';

/**
 * Generic entity factory - Creates CRUD operations for any table
 */
function createEntity(tableName) {
  return {
    async create(data) {
      const { data: record, error } = await supabase
        .from(tableName)
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return record;
    },

    async get(id) {
      const { data: record, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return record;
    },

    async update(id, data) {
      const { data: record, error } = await supabase
        .from(tableName)
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return record;
    },

    async delete(id) {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    },

    async filter(conditions = {}, orderBy = '-created_at', limit = 100) {
      let query = supabase.from(tableName).select('*');

      Object.entries(conditions).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });

      if (orderBy) {
        const isDescending = orderBy.startsWith('-');
        const column = isDescending ? orderBy.slice(1) : orderBy;
        query = query.order(column, { ascending: !isDescending });
      }

      if (limit) {
        query = query.limit(limit);
      }

      const { data: records, error } = await query;
      if (error) throw error;
      return records || [];
    },

    async list(orderBy = '-created_at', limit = 100) {
      return this.filter({}, orderBy, limit);
    },

    async count(conditions = {}) {
      let query = supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      Object.entries(conditions).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
  };
}

// Create entities for each table
export const Business = createEntity('businesses');
export const Staff = createEntity('staff');
export const Service = createEntity('services');
export const Booking = createEntity('bookings');
export const Notification = createEntity('notifications');
export const WaitingList = createEntity('waiting_list');
export const Subscription = createEntity('subscriptions');
export const Payment = createEntity('payments');
export const ScheduleOverride = createEntity('schedule_overrides');

export const entities = {
  Business,
  Staff,
  Service,
  Booking,
  Notification,
  WaitingList,
  Subscription,
  Payment,
  ScheduleOverride,
};

export default entities;
