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

// Staff entity with special handling for soft-delete (is_active filter)
const baseStaff = createEntity('staff');
export const Staff = {
  ...baseStaff,
  // Override filter to exclude inactive staff by default
  async filter(conditions = {}, orderBy = '-created_at', limit = 100) {
    let query = supabase.from('staff').select('*');

    Object.entries(conditions).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    });

    // Always filter out inactive staff (is_active = false)
    // This includes records where is_active is null (for backwards compatibility)
    query = query.neq('is_active', false);

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
};

export const Service = createEntity('services');
export const Booking = createEntity('bookings');
export const Notification = createEntity('notifications');
export const WaitingList = createEntity('waiting_list');
export const Subscription = createEntity('subscriptions');
export const Payment = createEntity('payments');
export const ScheduleOverride = createEntity('schedule_overrides');
export const RecurringAppointment = createEntity('recurring_appointments');
export const Profile = createEntity('profiles');

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
  RecurringAppointment,
  Profile,
};

export default entities;