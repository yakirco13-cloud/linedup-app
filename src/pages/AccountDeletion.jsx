import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useUser } from "@/components/UserContext";
import { usePageHeader } from "@/components/PageHeaderContext";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { X, Loader2 } from "lucide-react";

export default function AccountDeletion() {
  const navigate = useNavigate();
  const { user, logout } = useUser();

  // Set sticky header with back button
  usePageHeader({
    title: "מחיקת חשבון",
    showBackButton: true,
    backPath: createPageUrl("Settings")
  });

  const [deleteConfirmChecked, setDeleteConfirmChecked] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

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
      <ConfirmModal
        show={showDeleteConfirm}
        onClose={() => !deletingAccount && setShowDeleteConfirm(false)}
        onConfirm={handleDeleteAccount}
        title="מחיקת חשבון"
        message="האם אתה בטוח? פעולה זו תמחק לצמיתות את כל המידע שלך ולא ניתן לשחזר אותו."
        confirmText={deletingAccount ? "מוחק..." : "מחק חשבון"}
      />

      {/* Content */}
      <div>
          <div className="bg-[#1A1F35] rounded-2xl p-6 border-2 border-red-500/30">
            <div className="flex items-center gap-3 mb-4">
              <X className="w-6 h-6 text-red-400" />
              <h2 className="text-xl font-bold text-red-400">מחיקת חשבון לצמיתות</h2>
            </div>

            <p className="text-[#94A3B8] mb-6 text-sm leading-relaxed">
              מחיקת החשבון תמחק לצמיתות את כל המידע שלך מהמערכת, כולל תורים, הגדרות ונתונים אישיים. פעולה זו אינה ניתנת לביטול ולא ניתן לשחזר את המידע לאחר המחיקה.
            </p>

            <div className="bg-red-500/10 rounded-xl p-4 mb-6 border border-red-500/20">
              <h3 className="text-white font-bold mb-2">מה יימחק:</h3>
              <ul className="space-y-2 text-[#94A3B8] text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">•</span>
                  <span>כל פרטי החשבון האישיים שלך</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">•</span>
                  <span>כל התורים שלך (עבר ועתיד)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">•</span>
                  <span>כל ההגדרות וההעדפות שלך</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">•</span>
                  <span>היסטוריית הפעילות שלך במערכת</span>
                </li>
              </ul>
            </div>

            <div className="flex items-start gap-3 mb-6 p-4 bg-red-500/10 rounded-xl border border-red-500/20">
              <input
                type="checkbox"
                id="deleteConfirm"
                checked={deleteConfirmChecked}
                onChange={(e) => setDeleteConfirmChecked(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-red-500/50 bg-transparent checked:bg-red-500 focus:ring-red-500 focus:ring-offset-0 cursor-pointer"
              />
              <label htmlFor="deleteConfirm" className="text-white text-sm cursor-pointer select-none">
                אני מבין/ה שמחיקת החשבון היא פעולה בלתי הפיכה ושכל המידע שלי, כולל תורים והגדרות, יימחק לצמיתות ללא אפשרות שחזור
              </label>
            </div>

            <Button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={!deleteConfirmChecked || deletingAccount}
              className="w-full h-12 rounded-xl font-semibold bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {deletingAccount ? (
                <div className="flex items-center gap-2 justify-center">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>מוחק חשבון...</span>
                </div>
              ) : (
                'מחק את החשבון שלי'
              )}
            </Button>
          </div>
      </div>
    </>
  );
}
