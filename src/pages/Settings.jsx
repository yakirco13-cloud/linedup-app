import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useUser } from "@/components/UserContext";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  User,
  LogOut,
  Briefcase,
  Globe,
  RefreshCw,
  Clock,
  CheckCircle,
  Loader2,
  MessageSquare,
  ChevronLeft,
  HelpCircle,
  FileText,
  Users,
  Store,
  Palette,
  X,
  Repeat
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import MessageUsageCard from "@/components/MessageUsageCard";
import SubscriptionCard from "@/components/SubscriptionCard";
import { useFeatureGate } from "@/components/FeatureGate";
import UpgradeModal from "@/components/UpgradeModal";
import { isUserDemoAccount } from "@/utils/demoAccounts";

export default function Settings() {
  const navigate = useNavigate();
  const { user, logout, updateUser, refetchUser } = useUser();
  const queryClient = useQueryClient();
  const [switching, setSwitching] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showRecurringUpgrade, setShowRecurringUpgrade] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const { hasAccess: canUseRecurring } = useFeatureGate('recurringBookings');
  const [profileForm, setProfileForm] = useState({
    name: user?.name || "",
    phone: user?.phone || ""
  });

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
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });

  const { data: joinedBusiness } = useQuery({
    queryKey: ['joined-business', user?.email],
    queryFn: async () => {
      if (!user?.joined_business_id || user.joined_businesses.length === 0) return null;
      const businesses = await base44.entities.Business.filter({ id: user.joined_business_id });
      return businesses[0] || null;
    },
    enabled: !!user?.joined_business_id && user.joined_business_id && user?.user_role === 'client',
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });

  const profileUpdateMutation = useMutation({
    mutationFn: async (data) => {
      await updateUser(data);
    },
    onSuccess: async () => {
      await refetchUser();
      setEditingProfile(false);
    },
  });

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      // Always redirect to welcome page, even if logout fails
      navigate("/", { replace: true });
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      // Call the database function to delete both profile and auth user
      const { data, error } = await supabase.rpc('delete_current_user_account');

      if (error) {
        console.error('Error deleting account:', error);
        alert('שגיאה במחיקת החשבון. אנא נסה שוב.');
        setDeletingAccount(false);
        return;
      }

      if (data?.error) {
        console.error('Error deleting account:', data.error);
        alert('שגיאה במחיקת החשבון. אנא נסה שוב.');
        setDeletingAccount(false);
        return;
      }

      // Clear session storage
      localStorage.removeItem('linedup_session');

      // Sign out from Supabase auth
      await supabase.auth.signOut();

      // Call logout to clear user context
      try {
        await logout();
      } catch (logoutError) {
        console.log('Logout error after delete:', logoutError);
      }

      // Redirect to welcome page
      navigate("/", { replace: true });

      // Reload the page to fully clear state
      window.location.reload();
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('שגיאה במחיקת החשבון. אנא נסה שוב.');
      setDeletingAccount(false);
    }
  };

  const handleSwitchRole = async () => {
    setSwitching(true);
    const newRole = user.user_role === 'business_owner' ? 'client' : 'business_owner';
    
    await updateUser({ user_role: newRole });
    await refetchUser();
    
    if (newRole === 'business_owner') {
      const businesses = await base44.entities.Business.filter({ owner_id: user.id });
      if (businesses.length === 0) {
        navigate(createPageUrl("BusinessSetup"));
      } else {
        navigate(createPageUrl("BusinessDashboard"));
      }
    } else {
      navigate(createPageUrl("ClientDashboard"));
    }
    setSwitching(false);
  };

  const handleLeaveBusiness = async () => {
    try {
      if (!user || !joinedBusiness) {
        console.error("User or joined business not available.");
        return;
      }
      await updateUser({ joined_business_id: null });
      await refetchUser();
      queryClient.invalidateQueries(['joined-business', user.phone]);
      queryClient.invalidateQueries(['business', user.business_id]);
      setShowLeaveConfirm(false);
      navigate(createPageUrl("ClientDashboard"));
    } catch (error) {
      console.error('Error leaving business:', error);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    profileUpdateMutation.mutate({
      full_name: profileForm.name,
      phone: profileForm.phone
    });
  };

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return parts[0][0] + parts[1][0];
    }
    return name.substring(0, 2);
  };

  // Menu Item Component
  const MenuItem = ({ icon: Icon, label, value, onClick, showArrow = true, locked = false }) => (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 px-4 py-4 hover:bg-white/5 active:bg-white/10 transition-colors relative"
    >
      <Icon className={`w-5 h-5 ${locked ? 'text-[#94A3B8]' : 'text-[#FF6B35]'}`} />
      <span className={`flex-1 text-right ${locked ? 'text-[#94A3B8]' : 'text-white'}`}>{label}</span>
      {locked && (
        <span className="text-xs text-[#FF6B35] bg-[#FF6B35]/10 px-2 py-0.5 rounded-full">PRO</span>
      )}
      {value && <span className="text-[#64748B] text-sm">{value}</span>}
      {showArrow && <ChevronLeft className="w-5 h-5 text-[#64748B]" />}
    </button>
  );

  // Destructive Menu Item
  const DestructiveItem = ({ icon: Icon, label, onClick }) => (
    <button 
      onClick={onClick}
      className="w-full flex items-center gap-4 px-4 py-4 hover:bg-red-500/10 active:bg-red-500/15 transition-colors"
    >
      <Icon className="w-5 h-5 text-red-400" />
      <span className="flex-1 text-right text-red-400">{label}</span>
    </button>
  );

  // Card Component
  const Card = ({ title, children }) => (
    <div className="mb-5">
      {title && <p className="text-[#94A3B8] text-sm mb-2 px-1">{title}</p>}
      <div className="bg-[#1A1F35] rounded-2xl overflow-hidden border border-white/5 divide-y divide-white/5">
        {children}
      </div>
    </div>
  );

  // Confirmation Modal
  const ConfirmModal = ({ show, onClose, onConfirm, title, message, confirmText }) => {
    if (!show) return null;
    
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
        <div className="bg-[#1A1F35] rounded-2xl max-w-sm w-full p-6 border border-white/10">
          <h2 className="text-lg font-bold text-white text-center mb-2">{title}</h2>
          <p className="text-[#94A3B8] text-center text-sm mb-6">{message}</p>
          <div className="flex gap-3">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 h-11 rounded-xl border-white/10 bg-transparent text-white hover:bg-white/5"
            >
              ביטול
            </Button>
            <Button
              onClick={onConfirm}
              className="flex-1 h-11 rounded-xl font-semibold"
              style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Modals */}
      <ConfirmModal
        show={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="התנתקות"
        message="האם אתה בטוח שברצונך להתנתק מהחשבון?"
        confirmText="התנתק"
      />
      <ConfirmModal
        show={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        onConfirm={handleLeaveBusiness}
        title="עזיבת העסק"
        message="האם אתה בטוח שברצונך לעזוב את העסק? תוכל להצטרף לעסק אחר."
        confirmText="עזוב"
      />
      <ConfirmModal
        show={showDeleteConfirm}
        onClose={() => !deletingAccount && setShowDeleteConfirm(false)}
        onConfirm={handleDeleteAccount}
        title="מחיקת חשבון"
        message="האם אתה בטוח? פעולה זו תמחק לצמיתות את כל המידע שלך ולא ניתן לשחזר אותו."
        confirmText={deletingAccount ? "מוחק..." : "מחק חשבון"}
      />

      {/* Header */}
      <h1 className="text-3xl font-bold mb-4">הגדרות</h1>

        {/* Profile Section */}
        {editingProfile ? (
          <div className="bg-[#1A1F35] rounded-2xl p-5 mb-5 border border-white/5">
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => {
                  setEditingProfile(false);
                  setProfileForm({ name: user?.name || "", phone: user?.phone || "" });
                }}
                className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
              <h2 className="text-lg font-bold text-white">עריכת פרופיל</h2>
              <div className="w-9" />
            </div>
            
            <form onSubmit={handleProfileUpdate} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-[#94A3B8] text-sm">שם מלא</Label>
                <Input
                  id="name"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="bg-[#0C0F1D] border-white/10 text-white h-12 rounded-xl focus:border-[#FF6B35] focus:ring-[#FF6B35]/20"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-[#94A3B8] text-sm">מספר טלפון</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  className="bg-[#0C0F1D] border-white/10 text-white h-12 rounded-xl focus:border-[#FF6B35] focus:ring-[#FF6B35]/20"
                  dir="ltr"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={profileUpdateMutation.isPending}
                className="w-full h-12 rounded-xl font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform"
                style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
              >
                {profileUpdateMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'שמור שינויים'
                )}
              </Button>
            </form>
          </div>
        ) : (
          <Card>
            <button 
              onClick={() => setEditingProfile(true)}
              className="w-full flex items-center gap-4 p-4 hover:bg-white/5 transition-colors"
            >
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FF1744] flex items-center justify-center flex-shrink-0">
                <span className="text-lg font-bold text-white">
                  {getInitials(user?.name || user?.full_name)}
                </span>
              </div>
              <div className="flex-1 text-right min-w-0">
                <h2 className="font-bold text-white truncate">
                  {user?.name || user?.full_name}
                </h2>
                <p className="text-[#64748B] text-sm" dir="ltr">
                  {user?.phone ? `0${user.phone.slice(3)}` : ''}
                </p>
              </div>
              <ChevronLeft className="w-5 h-5 text-[#64748B] flex-shrink-0" />
            </button>
          </Card>
        )}

        {/* Business Owner Settings */}
        {user?.user_role === 'business_owner' && business && (
          <>
            {/* Subscription Status - Hidden for demo accounts */}
            {!isUserDemoAccount(user) && (
              <div className="mb-5">
                <p className="text-[#94A3B8] text-sm mb-2 px-1">מנוי</p>
                <SubscriptionCard />
              </div>
            )}

            <Card title="ניהול העסק">
              <MenuItem
                icon={Briefcase}
                label="פרטי העסק"
                onClick={() => navigate(createPageUrl("BusinessSettings"))}
              />
              <MenuItem
                icon={Palette}
                label="שירותים"
                onClick={() => navigate(createPageUrl("ServiceManagement"))}
              />
              <MenuItem
                icon={Users}
                label="צוות עובדים"
                onClick={() => navigate(createPageUrl("StaffManagement"))}
              />
              <MenuItem
                icon={CheckCircle}
                label="אישורים"
                onClick={() => navigate(createPageUrl("ApprovalManagement"))}
              />
              <MenuItem
                icon={Clock}
                label="מדיניות ביטולים"
                onClick={() => navigate(createPageUrl("BusinessPolicies"))}
              />
              <MenuItem
                icon={Repeat}
                label="תורים חוזרים"
                locked={!canUseRecurring}
                onClick={() => canUseRecurring ? navigate(createPageUrl("RecurringManagement")) : setShowRecurringUpgrade(true)}
              />
            </Card>
          </>
        )}

        {/* Client Business Settings */}
        {user?.user_role === 'client' && joinedBusiness && (
          <Card title="העסק שלי">
            <div className="flex items-center gap-4 px-4 py-4">
              <Store className="w-5 h-5 text-[#FF6B35]" />
              <div className="flex-1 text-right min-w-0">
                <p className="font-medium text-white truncate">{joinedBusiness.name}</p>
                <p className="text-[#64748B] text-sm" dir="ltr">{joinedBusiness.phone}</p>
              </div>
            </div>
            <DestructiveItem 
              icon={LogOut} 
              label="עזוב את העסק" 
              onClick={() => setShowLeaveConfirm(true)}
            />
          </Card>
        )}

        {/* Notifications - Client only */}
        {user?.user_role === 'client' && (
          <Card title="התראות">
            <div className="flex items-center gap-4 px-4 py-4">
              <MessageSquare className="w-5 h-5 text-[#FF6B35]" />
              <div className="flex-1 text-right">
                <p className="text-white">הודעות WhatsApp</p>
                <p className="text-[#64748B] text-sm">תזכורות ועדכונים</p>
              </div>
              <Switch
                checked={user?.whatsapp_notifications_enabled !== false}
                onCheckedChange={async (checked) => {
                  try {
                    await updateUser({ whatsapp_notifications_enabled: checked });
                    await refetchUser();
                  } catch (error) {
                    console.error('Failed to update WhatsApp preference:', error);
                  }
                }}
                className="data-[state=checked]:bg-[#FF6B35] data-[state=unchecked]:bg-[#3F4553]"
              />
            </div>
          </Card>
        )}

        {/* General Settings */}
        <Card title="כללי">
          <MenuItem
            icon={Globe}
            label="שפה"
            value="עברית"
            onClick={() => {}}
            showArrow={false}
          />
          <MenuItem
            icon={HelpCircle}
            label="עזרה והדרכה"
            onClick={() => {
              // Only trigger tutorial if the feature is available (database field exists)
              if (user && user.onboarding_completed !== undefined) {
                window.dispatchEvent(new Event('restart-tutorial'));
              } else {
                alert('תכונת ההדרכה תהיה זמינה בקרוב');
              }
            }}
          />
          <MenuItem
            icon={FileText}
            label="תנאי שימוש"
            onClick={() => navigate(createPageUrl("TermsOfService"))}
          />
          <MenuItem
            icon={X}
            label="מחיקת חשבון"
            onClick={() => navigate(createPageUrl("AccountDeletion"))}
          />
        </Card>

        {/* Admin Switch Role */}
        {user?.is_admin && (
          <Card title="מנהל">
            <button
              onClick={handleSwitchRole}
              disabled={switching}
              className="w-full flex items-center gap-4 px-4 py-4 hover:bg-white/5 active:bg-white/10 transition-colors"
            >
              <RefreshCw className={`w-5 h-5 text-[#FF6B35] ${switching ? 'animate-spin' : ''}`} />
              <span className="flex-1 text-right text-white">
                החלף ל{user?.user_role === 'business_owner' ? 'לקוח' : 'בעל עסק'}
              </span>
              <ChevronLeft className="w-5 h-5 text-[#64748B]" />
            </button>
          </Card>
        )}

        {/* Logout */}
        <Card>
          <DestructiveItem
            icon={LogOut}
            label="התנתק"
            onClick={() => setShowLogoutConfirm(true)}
          />
        </Card>

        {/* App Info */}
        <p className="text-center text-[#3F4553] text-sm mt-6 pb-4">LinedUp v1.0</p>

      <UpgradeModal
        isOpen={showRecurringUpgrade}
        onClose={() => setShowRecurringUpgrade(false)}
        feature="recurringBookings"
        highlightPlan="pro"
      />
    </>
  );
}