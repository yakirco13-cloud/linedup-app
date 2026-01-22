import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/components/UserContext";
import { Calendar, Loader2 } from "lucide-react";

export default function Welcome() {
  const navigate = useNavigate();
  const { user, profile, loading, isAuthenticated } = useUser();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loading) return;

    if (isAuthenticated() && profile) {
      redirectBasedOnProfile(profile);
    } else {
      setChecking(false);
    }
  }, [loading, profile]);

  const redirectBasedOnProfile = (userProfile) => {
    if (!userProfile.user_role) {
      navigate("/Auth?mode=complete");
      return;
    }

    if (userProfile.user_role === 'business_owner') {
      if (!userProfile.business_id) {
        navigate("/BusinessSetup");
      } else {
        navigate("/BusinessDashboard");
      }
    } else {
      if (!userProfile.joined_business_id) {
        navigate("/JoinBusiness");
      } else {
        navigate("/ClientDashboard");
      }
    }
  };

  if (loading || checking) {
    return (
      <div className="min-h-screen bg-[#0C0F1D] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF6B35]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0C0F1D] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-12">
          <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-[#FF6B35] to-[#FF1744] flex items-center justify-center shadow-2xl shadow-[#FF6B35]/30">
            <Calendar className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-[#FF6B35] to-[#FF1744] bg-clip-text text-transparent">
            LinedUp
          </h1>
          <p className="text-[#94A3B8] text-xl mb-2">
            ניהול תורים בקלות
          </p>
          <p className="text-[#64748B] text-sm">
            הצטרף לאלפי עסקים ולקוחות שכבר משתמשים בנו
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => navigate("/Auth?mode=signup")}
            className="w-full h-14 rounded-2xl text-white font-bold text-lg transition-all hover:scale-105 hover:shadow-2xl hover:shadow-[#FF6B35]/30 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
          >
            הרשמה
          </button>

          <button
            onClick={() => navigate("/Auth?mode=login")}
            className="w-full h-14 rounded-2xl bg-[#1A1F35] text-white font-bold text-lg border-2 border-gray-700 hover:border-[#FF6B35] transition-all hover:scale-105 active:scale-95"
          >
            התחברות
          </button>

          <button
            onClick={() => navigate("/DemoTour")}
            className="w-full h-12 rounded-2xl text-[#94A3B8] font-medium text-base transition-all hover:text-white hover:bg-[#1A1F35]/50 active:scale-95 flex items-center justify-center gap-2"
          >
            סיור באפליקציה
            <span>🎬</span>
          </button>
        </div>

        <p className="text-center text-[#64748B] text-xs mt-8 leading-relaxed">
          בהרשמה אתה מסכים ל
          <button onClick={() => navigate("/TermsOfService")} className="text-[#FF6B35] hover:underline mx-1">
            תנאי השימוש
          </button>
          ו
          <button onClick={() => navigate("/TermsOfService")} className="text-[#FF6B35] hover:underline mx-1">
            מדיניות הפרטיות
          </button>
        </p>
      </div>
    </div>
  );
}
