import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';

const WHATSAPP_API_URL = import.meta.env.VITE_WHATSAPP_API_URL || 'https://linedup-official-production.up.railway.app';
const API_KEY = import.meta.env.VITE_WHATSAPP_API_KEY || '';

const UserContext = createContext();

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }
  return context;
};

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const isFetchingRef = useRef(false);

  const fetchProfile = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      return data;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  }, []);

  const fetchUser = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      // First check localStorage session (faster)
      const storedSession = localStorage.getItem('linedup_session');
      
      if (storedSession) {
        try {
          const sessionData = JSON.parse(storedSession);
          
          if (sessionData.expiresAt && new Date(sessionData.expiresAt) > new Date()) {
            const profileData = await fetchProfile(sessionData.userId);
            
            if (profileData) {
              setUser({ id: sessionData.userId, phone: sessionData.phone });
              setProfile(profileData);
              return; // Done - found valid session
            }
          }
        } catch (e) {
          console.error('Error parsing localStorage session:', e);
        }
        localStorage.removeItem('linedup_session');
      }

      // Then check Supabase session
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          const profileData = await fetchProfile(session.user.id);
          if (profileData) {
            setUser({ id: session.user.id, phone: profileData.phone });
            setProfile(profileData);
            return; // Done - found valid session
          }
        }
      } catch (e) {
        console.error('Error getting Supabase session:', e);
      }

      // No valid session found
      setUser(null);
      setProfile(null);
    } catch (error) {
      console.error('Error fetching user:', error);
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
      setInitialLoadComplete(true);
      isFetchingRef.current = false;
    }
  }, [fetchProfile]);

  useEffect(() => {
    fetchUser();
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('linedup_session');
        setUser(null);
        setProfile(null);
      }
      // Don't handle SIGNED_IN here - let the login functions handle it
    });

    return () => subscription.unsubscribe();
  }, []);

  const sendOTP = async (phone, checkExistsFirst = false) => {
    const normalizedPhone = normalizePhone(phone);
    
    // For login mode, check if user exists first
    if (checkExistsFirst) {
      const { data: existingProfile, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', normalizedPhone)
        .maybeSingle();
      
      if (!existingProfile) {
        throw new Error('משתמש לא קיים. נא להירשם תחילה');
      }
    }
    
    const response = await fetch(`${WHATSAPP_API_URL}/api/otp/send`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(API_KEY && { 'X-API-Key': API_KEY })
      },
      body: JSON.stringify({ phone }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to send OTP');
    return { success: true };
  };

  const verifyOTP = async (phone, code, userData = {}) => {
    // DEV MODE: Accept "123456" as valid code without API call
    const DEV_MODE = true; // Set to false for production
    
    if (DEV_MODE && code === '123456') {
      console.log('🔧 DEV MODE: Bypassing OTP verification');
    } else {
      const response = await fetch(`${WHATSAPP_API_URL}/api/otp/verify`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(API_KEY && { 'X-API-Key': API_KEY })
        },
        body: JSON.stringify({ phone, code }),
      });

      const data = await response.json();
      if (!response.ok || !data.verified) {
        throw new Error(data.error || 'Invalid OTP');
      }
    }

    // If verifyOnly is true, just return success without logging in
    // Used for forgot password flow
    if (userData.verifyOnly) {
      return { success: true };
    }

    const normalizedPhone = normalizePhone(phone);
    const isSignup = userData.userRole && userData.fullName && userData.password;
    
    // Check if user exists
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (existingProfile) {
      // Existing user during signup - this shouldn't happen normally
      // User already exists, sign them in with provided password
      const fakeEmail = `${normalizedPhone}@phone.linedup.app`;
      
      if (userData.password) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: fakeEmail,
          password: userData.password,
        });
        
        if (signInError) {
          throw new Error('סיסמה שגויה');
        }
      }
      
      setUser({ id: existingProfile.id, phone: normalizedPhone });
      setProfile(existingProfile);

      return { success: true, isNewUser: false, profile: existingProfile };
    } else {
      // User doesn't exist - must be a signup
      if (!isSignup) {
        throw new Error('משתמש לא קיים. נא להירשם תחילה');
      }
      
      if (!userData.acceptedTerms) {
        throw new Error('נא לאשר את תנאי השימוש');
      }
      
      // New user - create account with their password
      const fakeEmail = `${normalizedPhone}@phone.linedup.app`;
      const userPassword = userData.password;

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: fakeEmail,
        password: userPassword,
      });

      if (signUpError) {
        console.error('Signup error:', signUpError);
        throw new Error('שגיאה ביצירת חשבון. נסה שוב');
      }

      const userId = authData.user?.id;
      if (!userId) throw new Error('Failed to create user');

      const { data: newProfile, error: newProfileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          phone: normalizedPhone,
          full_name: userData.fullName || '',
          user_role: userData.userRole || null,
          accepted_terms: userData.acceptedTerms || false,
          accepted_terms_at: userData.acceptedTerms ? new Date().toISOString() : null,
          accepted_marketing: userData.acceptedMarketing || false,
        })
        .select()
        .single();

      if (newProfileError) {
        console.error('Profile creation error:', newProfileError);
        throw new Error('שגיאה ביצירת פרופיל');
      }

      setUser({ id: userId, phone: normalizedPhone });
      setProfile(newProfile);

      return { success: true, isNewUser: true, profile: newProfile };
    }
  };

  const resetPassword = async (phone, newPassword) => {
    const normalizedPhone = normalizePhone(phone);
    const fakeEmail = `${normalizedPhone}@phone.linedup.app`;

    // First, get the user's profile to find their user ID
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (!existingProfile) {
      throw new Error('משתמש לא נמצא');
    }

    // Use Supabase Admin API to update password
    // This requires calling our backend server which has the service role key
    try {
      const response = await fetch(`${WHATSAPP_API_URL}/api/reset-password`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(API_KEY && { 'X-API-Key': API_KEY })
        },
        body: JSON.stringify({ 
          email: fakeEmail, 
          newPassword,
          userId: existingProfile.id 
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'שגיאה באיפוס הסיסמה');
      }
    } catch (apiError) {
      console.error('Reset password API error:', apiError);
      // Fallback: try direct Supabase approach for dev/testing
      console.log('Trying fallback password reset approach...');
    }

    // Now try to sign in with the new password
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: fakeEmail,
      password: newPassword,
    });

    if (signInError) {
      console.error('Sign in after reset failed:', signInError);
      throw new Error('שגיאה באיפוס הסיסמה. נסה שוב או פנה לתמיכה');
    }

    setUser({ id: existingProfile.id, phone: normalizedPhone });
    setProfile(existingProfile);

    return { success: true, profile: existingProfile };
  };

  const loginWithPassword = async (phone, password) => {
    const normalizedPhone = normalizePhone(phone);
    const fakeEmail = `${normalizedPhone}@phone.linedup.app`;

    // Sign in with Supabase Auth
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: fakeEmail,
      password: password,
    });

    if (signInError) {
      console.error('Login error:', signInError);
      throw new Error('מספר טלפון או סיסמה שגויים');
    }

    const userId = signInData.user?.id;
    if (!userId) throw new Error('שגיאה בהתחברות');

    // Fetch profile
    const profileData = await fetchProfile(userId);
    if (!profileData) {
      throw new Error('לא נמצא פרופיל משתמש');
    }

    setUser({ id: userId, phone: normalizedPhone });
    setProfile(profileData);

    return { success: true, profile: profileData };
  };

  const updateUser = async (data) => {
    if (!user?.id) throw new Error('No user logged in');

    const { data: updatedProfile, error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;
    setProfile(updatedProfile);
    return updatedProfile;
  };

  const logout = async () => {
    localStorage.removeItem('linedup_session');
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const isAuthenticated = () => !!user && !!profile;

  // Combined user object for backward compatibility
  const combinedUser = profile ? {
    ...profile,
    id: user?.id,
    phone: user?.phone,
    name: profile.full_name,
    email: profile.email || `${user?.phone}@phone.linedup.app`,
    business_id: profile.business_id,
    joined_businesses: profile.joined_business_id ? [profile.joined_business_id] : [],
  } : null;

  return (
    <UserContext.Provider value={{ 
      user: combinedUser, 
      profile,
      loading, 
      initialLoadComplete, 
      isAuthenticated,
      sendOTP,
      verifyOTP,
      loginWithPassword,
      resetPassword,
      updateUser, 
      logout, 
      refetchUser: fetchUser 
    }}>
      {children}
    </UserContext.Provider>
  );
};

function normalizePhone(phone) {
  if (!phone) return null;
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
  if (!cleaned.startsWith('972')) cleaned = '972' + cleaned;
  return cleaned;
}