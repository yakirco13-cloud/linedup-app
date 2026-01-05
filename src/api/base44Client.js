// This file provides backward compatibility with base44 imports
// All calls are redirected to Supabase

import { supabase } from '@/lib/supabase/client';
import { entities } from '@/lib/supabase/entities';
import { integrations } from '@/lib/supabase/integrations';

// Auth is handled by UserContext, but we provide a compatible interface
const auth = {
  async isAuthenticated() {
    const session = localStorage.getItem('linedup_session');
    return !!session;
  },
  
  async me() {
    // This should be called through UserContext instead
    console.warn('base44.auth.me() is deprecated. Use useUser() hook instead.');
    return null;
  },
  
  async updateMe(data) {
    console.warn('base44.auth.updateMe() is deprecated. Use useUser().updateUser() instead.');
    return null;
  },
  
  async logout() {
    localStorage.removeItem('linedup_session');
    await supabase.auth.signOut();
  },
  
  async redirectToLogin(callbackUrl) {
    window.location.href = '/Auth?mode=login&redirect=' + encodeURIComponent(callbackUrl);
  }
};

export const base44 = {
  auth,
  entities,
  integrations,
};

export default base44;
