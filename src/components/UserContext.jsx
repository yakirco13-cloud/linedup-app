import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';

const WHATSAPP_API_URL = import.meta.env.VITE_WHATSAPP_API_URL || 'https://linedup-official-production.up.railway.app';

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
      const storedSession = localStorage.getItem('linedup_session');
      
      if (storedSession) {
        const sessionData = JSON.parse(storedSession);
        
        if (sessionData.expiresAt && new Date(sessionData.expiresAt) > new Date()) {
          const profileData = await fetchProfile(sessionData.userId);
          
          if (profileData) {
            setUser({ id: sessionData.userId, phone: sessionData.phone });
            setProfile(profileData);
          } else {
            localStorage.removeItem('linedup_session');
            setUser(null);
            setProfile(null);
          }
        } else {
          localStorage.removeItem('linedup_session');
          setUser(null);
          setProfile(null);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
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
  }, [fetchUser]);

  const sendOTP = async (phone) => {
    const response = await fetch(`${WHATSAPP_API_URL}/api/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });

      const data = await response.json();
      if (!response.ok || !data.verified) {
        throw new Error(data.error || 'Invalid OTP');
      }
    }

    const normalizedPhone = normalizePhone(phone);
    const isSignup = userData.userRole && userData.fullName;
    
    // Check if user exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone', normalizedPhone)
      .single();

    if (existingProfile) {
      // Existing user - log them in
      const session = {
        userId: existingProfile.id,
        phone: normalizedPhone,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };
      
      localStorage.setItem('linedup_session', JSON.stringify(session));
      setUser({ id: existingProfile.id, phone: normalizedPhone });
      setProfile(existingProfile);

      return { success: true, isNewUser: false, profile: existingProfile };
    } else {
      // User doesn't exist
      if (!isSignup) {
        // Trying to login without account - reject
        throw new Error('משתמש לא קיים. נא להירשם תחילה');
      }
      
      // Check terms acceptance for signup
      if (!userData.acceptedTerms) {
        throw new Error('נא לאשר את תנאי השימוש');
      }
      
      // New user - create account
      const fakeEmail = `${normalizedPhone}@phone.linedup.app`;
      const tempPassword = `temp_${normalizedPhone}_${Date.now()}`;

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: fakeEmail,
        password: tempPassword,
      });

      if (signUpError) throw new Error('Failed to create account');

      const userId = authData.user?.id;
      if (!userId) throw new Error('Failed to create user');

      const { data: newProfile, error: profileError } = await supabase
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

      if (profileError) throw new Error('Failed to create profile');

      const session = {
        userId: userId,
        phone: normalizedPhone,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };
      
      localStorage.setItem('linedup_session', JSON.stringify(session));
      setUser({ id: userId, phone: normalizedPhone });
      setProfile(newProfile);

      return { success: true, isNewUser: true, profile: newProfile };
    }
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
