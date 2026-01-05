import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useUser } from "../components/UserContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, LogOut, Briefcase, Globe, Settings as SettingsIcon, RefreshCw, Clock, CheckCircle, Edit, Loader2, MessageSquare } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export default function Settings() {
  const navigate = useNavigate();
  const { user, logout, updateUser, refetchUser } = useUser();
  const queryClient = useQueryClient();
  const [switching, setSwitching] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: user?.name || "",
    phone: user?.phone || ""
  });

  // Update form when user data changes
  useEffect(() => {
    if (user && !editingProfile) {
      setProfileForm({
        name: user.name || "",
        phone: user.phone || ""
      });
    }
  }, [user, editingProfile]);

  const { data: business } = useQuery({
    queryKey: ['business', user?.business_id],
    queryFn: async () => {
      if (!user?.business_id) return null;
      const businesses = await base44.entities.Business.filter({ id: user.business_id });
      return businesses[0] || null;
    },
    enabled: !!user?.business_id && user?.user_role === 'business_owner',
    staleTime: 10 * 60 * 1000,
    cacheTime: 15 * 60 * 1000,
    refetchOnWindowFocus: true,
    keepPreviousData: true,
  });

  // Get client's joined business
  const { data: joinedBusiness } = useQuery({
    queryKey: ['joined-business', user?.email],
    queryFn: async () => {
      if (!user?.joined_businesses || user.joined_businesses.length === 0) return null;
      const businesses = await base44.entities.Business.filter({ id: user.joined_businesses[0] });
      return businesses[0] || null;
    },
    enabled: !!user?.joined_businesses && user.joined_businesses.length > 0 && user?.user_role === 'client',
    staleTime: 10 * 60 * 1000,
    cacheTime: 15 * 60 * 1000,
    refetchOnWindowFocus: true,
    keepPreviousData: true,
  });

  const profileUpdateMutation = useMutation({
    mutationFn: async (data) => {
      await base44.auth.updateMe(data);
    },
    onSuccess: async () => {
      await refetchUser();
      setEditingProfile(false);
    },
  });

  const handleLogout = async () => {
    if (window.confirm('האם אתה בטוח שברצונך להתנתק?')) {
      await logout();
      window.location.href = createPageUrl("Welcome");
    }
  };

  const handleSwitchRole = async () => {
    if (window.confirm('האם אתה בטוח שברצונך להחליף תפקיד?')) {
      setSwitching(true);
      const newRole = user.user_role === 'business_owner' ? 'client' : 'business_owner';
      
      await updateUser({ user_role: newRole });
      await refetchUser();
      
      if (newRole === 'business_owner') {
        const businesses = await base44.entities.Business.filter({ owner_email: user.email });
        if (businesses.length === 0) {
          navigate(createPageUrl("BusinessSetup"));
        } else {
          navigate(createPageUrl("BusinessDashboard"));
        }
      } else {
        navigate(createPageUrl("ClientDashboard"));
      }
      setSwitching(false);
    }
  };

  const handleLeaveBusiness = async () => {
    if (window.confirm('האם אתה בטוח שברצונך לעזוב את העסק? תוכל להצטרף לעסק אחר אחר כך.')) {
      try {
        if (!user || !joinedBusiness) {
          console.error("User or joined business not available.");
          alert('שגיאה: פרטי משתמש או עסק חסרים.');
          return;
        }
        // Remove the business from joined_businesses array
        const updatedBusinesses = (user.joined_businesses || []).filter(id => id !== joinedBusiness.id);
        await updateUser({ joined_businesses: updatedBusinesses });
        await refetchUser();
        
        // Invalidate queries related to business to ensure fresh data if the user joins a new one
        queryClient.invalidateQueries(['joined-business', user.email]);
        queryClient.invalidateQueries(['business', user.business_id]);
        
        // Navigate to ClientDashboard which will show the join business screen
        navigate(createPageUrl("ClientDashboard"));
      } catch (error) {
        console.error('Error leaving business:', error);
        alert('שגיאה בעזיבת העסק. נסה שוב.');
      }
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    profileUpdateMutation.mutate({
      name: profileForm.name,
      phone: profileForm.phone
    });
  };

  return (
    <div className="min-h-screen bg-[#0C0F1D] p-4 pb-24 pt-safe">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 pt-4">הגדרות</h1>

        {/* User Info */}
        <div className="bg-[#1A1F35] rounded-2xl p-6 mb-6 border border-gray-800">
          {editingProfile ? (
            <form onSubmit={handleProfileUpdate} className="space-y-5">
              <h2 className="text-xl font-bold mb-6">ערוך פרופיל</h2>
              
              <div className="space-y-2">
                <Label htmlFor="name" className="text-white text-base font-medium">שם</Label>
                <Input
                  id="name"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="bg-[#0C0F1D] border-gray-700 text-white h-12 rounded-xl focus:border-[#FF6B35] focus:ring-[#FF6B35] transition-colors"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-white text-base font-medium">טלפון</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  className="bg-[#0C0F1D] border-gray-700 text-white h-12 rounded-xl focus:border-[#FF6B35] focus:ring-[#FF6B35] transition-colors"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={profileUpdateMutation.isPending}
                  className="flex-1 h-12 rounded-xl font-semibold hover:scale-105 active:scale-95 transition-transform"
                  style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
                >
                  {profileUpdateMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'שמור'
                  )}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setEditingProfile(false);
                    setProfileForm({ name: user?.name || "", phone: user?.phone || "" });
                  }}
                  variant="outline"
                  className="flex-1 h-12 rounded-xl border-gray-700 bg-transparent text-white hover:bg-[#0C0F1D] hover:scale-105 active:scale-95 transition-all"
                >
                  ביטול
                </Button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#FF6B35] to-[#FF1744] flex items-center justify-center">
                  <User className="w-10 h-10 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold mb-1">{user?.name}</h2>
                  <p className="text-[#94A3B8] text-sm">{user?.email}</p>
                </div>
                <Button
                  onClick={() => setEditingProfile(true)}
                  variant="ghost"
                  size="sm"
                  className="text-[#FF6B35] hover:text-[#FF6B35]/80 hover:bg-[#FF6B35]/10 h-10 w-10 rounded-xl hover:scale-110 transition-all"
                >
                  <Edit className="w-5 h-5" />
                </Button>
              </div>

              <div className="pt-5 border-t border-gray-800 space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <Briefcase className="w-5 h-5 text-[#94A3B8]" />
                    <span className="text-white font-medium">תפקיד</span>
                  </div>
                  <span className="text-[#94A3B8]">
                    {user?.user_role === 'business_owner' ? 'בעל עסק' : 'לקוח'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-[#94A3B8]" />
                    <span className="text-white font-medium">שפה</span>
                  </div>
                  <span className="text-[#94A3B8]">עברית</span>
                </div>
              </div>

              {user?.is_admin && (
                <Button
                  onClick={handleSwitchRole}
                  disabled={switching}
                  className="w-full mt-6 gap-2 h-12 rounded-xl bg-blue-600 hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all font-semibold"
                >
                  <RefreshCw className={`w-5 h-5 ${switching ? 'animate-spin' : ''}`} />
                  <span>החלף תפקיד ל{user?.user_role === 'business_owner' ? 'לקוח' : 'בעל עסק'}</span>
                </Button>
              )}
            </>
          )}
        </div>

        {/* Business Owner Settings */}
        {user?.user_role === 'business_owner' && business && (
          <>
            <div className="bg-[#1A1F35] rounded-2xl p-6 mb-6 border border-gray-800">
              <h3 className="font-bold mb-6 flex items-center gap-2 text-lg">
                <SettingsIcon className="w-6 h-6 text-[#FF6B35]" />
                ניהול העסק
              </h3>
              
              <div className="space-y-3">
                <Button
                  onClick={() => navigate(createPageUrl("BusinessSettings"))}
                  variant="ghost"
                  className="w-full justify-start gap-3 h-12 hover:bg-[#FF6B35]/10 text-white hover:text-white rounded-xl font-medium hover:scale-[1.02] transition-all"
                >
                  <Briefcase className="w-5 h-5" />
                  <span>עריכת פרטי העסק</span>
                </Button>

                <Button
                  onClick={() => navigate(createPageUrl("ServiceManagement"))}
                  variant="ghost"
                  className="w-full justify-start gap-3 h-12 hover:bg-[#FF6B35]/10 text-white hover:text-white rounded-xl font-medium hover:scale-[1.02] transition-all"
                >
                  <SettingsIcon className="w-5 h-5" />
                  <span>ניהול שירותים</span>
                </Button>

                <Button
                  onClick={() => navigate(createPageUrl("StaffManagement"))}
                  variant="ghost"
                  className="w-full justify-start gap-3 h-12 hover:bg-[#FF6B35]/10 text-white hover:text-white rounded-xl font-medium hover:scale-[1.02] transition-all"
                >
                  <User className="w-5 h-5" />
                  <span>ניהול עובדים</span>
                </Button>

                <Button
                  onClick={() => navigate(createPageUrl("ApprovalManagement"))}
                  variant="ghost"
                  className="w-full justify-start gap-3 h-12 hover:bg-[#FF6B35]/10 text-white hover:text-white rounded-xl font-medium hover:scale-[1.02] transition-all"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>אישור לקוחות ותורים</span>
                </Button>

                <Button
                  onClick={() => navigate(createPageUrl("BusinessPolicies"))}
                  variant="ghost"
                  className="w-full justify-start gap-3 h-12 hover:bg-[#FF6B35]/10 text-white hover:text-white rounded-xl font-medium hover:scale-[1.02] transition-all"
                >
                  <Clock className="w-5 h-5" />
                  <span>מדיניות ביטולים</span>
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Client Business Settings */}
        {user?.user_role === 'client' && joinedBusiness && (
          <div className="bg-[#1A1F35] rounded-2xl p-6 mb-6 border border-gray-800">
            <h3 className="font-bold mb-4 flex items-center gap-2 text-lg">
              <Briefcase className="w-6 h-6 text-[#FF6B35]" />
              העסק שלי
            </h3>
            
            <div className="bg-[#0C0F1D] rounded-xl p-4 mb-4 border border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FF6B35] to-[#FF1744] flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-white">{joinedBusiness.name}</h4>
                  <p className="text-[#94A3B8] text-sm">{joinedBusiness.phone}</p>
                </div>
              </div>
            </div>

            <Button
              onClick={handleLeaveBusiness}
              variant="ghost"
              className="w-full justify-start gap-3 h-12 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl font-medium hover:scale-[1.02] transition-all"
            >
              <LogOut className="w-5 h-5" />
              <span>עזוב את העסק</span>
            </Button>
          </div>
        )}

        {/* WhatsApp Notifications Settings */}
        <div className="bg-[#1A1F35] rounded-2xl p-6 mb-6 border border-gray-800">
          <h3 className="font-bold mb-4 flex items-center gap-2 text-lg">
            <MessageSquare className="w-6 h-6 text-green-500" />
            התראות WhatsApp
          </h3>
          
          <div className="flex flex-row-reverse items-center gap-4 py-3">
            <Switch
              checked={user?.whatsapp_notifications_enabled !== false}
              onCheckedChange={async (checked) => {
                try {
                  await base44.auth.updateMe({ whatsapp_notifications_enabled: checked });
                  await refetchUser();
                } catch (error) {
                  console.error('Failed to update WhatsApp preference:', error);
                }
              }}
              className="data-[state=checked]:bg-green-500
              [&>span]:transition-transform
              data-[state=checked]:[&>span]:-translate-x-4
              "
            />
            <div className="flex-1 text-right">
              <p className="text-white font-medium">קבלת הודעות WhatsApp</p>
              <p className="text-[#94A3B8] text-sm mt-1">
                קבל תזכורות, אישורים ועדכונים ב-WhatsApp
              </p>
            </div>
          </div>
        </div>

        {/* Account Actions */}
        <div className="bg-[#1A1F35] rounded-2xl p-6 border border-gray-800">
          <h3 className="font-bold mb-4 text-lg">פעולות</h3>
          
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="w-full justify-start gap-3 h-12 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl font-medium hover:scale-[1.02] transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span>התנתק</span>
          </Button>
        </div>

        {/* App Info */}
        <div className="text-center mt-12 mb-8">
          <p className="text-[#94A3B8] text-sm">LinedUp v1.0</p>
          <p className="text-[#64748B] text-xs mt-1">מערכת ניהול תורים חכמה</p>
        </div>
      </div>
    </div>
  );
}