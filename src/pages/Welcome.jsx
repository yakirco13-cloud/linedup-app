import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/components/UserContext";
import { Calendar, Loader2, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function Welcome() {
  const navigate = useNavigate();
  const { user, profile, loading, isAuthenticated } = useUser();
  const [checking, setChecking] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [allBusinesses, setAllBusinesses] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (isAuthenticated() && profile) {
      redirectBasedOnProfile(profile);
    } else {
      setChecking(false);
    }
  }, [loading, profile]);

  // Load all businesses on mount
  useEffect(() => {
    const loadAllBusinesses = async () => {
      try {
        const businesses = await base44.entities.Business.filter({});
        setAllBusinesses(businesses.slice(0, 10)); // Show first 10 businesses
      } catch (error) {
        console.error('Error loading businesses:', error);
      }
    };
    loadAllBusinesses();
  }, []);

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

  const handleSearch = async (query) => {
    setSearchQuery(query);

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      console.log('Searching for:', query);

      // Search by filtering all businesses client-side
      // This avoids potential RLS or API issues
      const filteredBusinesses = allBusinesses.filter(business =>
        business.name?.toLowerCase().includes(query.toLowerCase()) ||
        business.business_code?.toLowerCase().includes(query.toLowerCase())
      );

      console.log('Found businesses:', filteredBusinesses);
      setSearchResults(filteredBusinesses.slice(0, 5)); // Limit to 5 results
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
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
        <div className="text-center mb-8">
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

        {/* Search Business */}
        <div className="mb-8 relative">
          <div className="relative">
            <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="חפש עסק לפי שם או קוד..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              className="w-full h-14 rounded-2xl bg-[#1A1F35] border-2 border-gray-700 text-white pr-12 pl-4 focus:border-[#FF6B35] focus:outline-none transition-colors"
              dir="rtl"
            />
          </div>

          {/* Dropdown Results */}
          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#1A1F35] border-2 border-gray-700 rounded-2xl overflow-hidden z-10 max-h-64 overflow-y-auto">
              {searching ? (
                <div className="p-4 text-center">
                  <Loader2 className="w-5 h-5 animate-spin text-[#FF6B35] mx-auto" />
                </div>
              ) : searchQuery ? (
                // Show search results when typing
                searchResults.length > 0 ? (
                  searchResults.map((business) => (
                    <button
                      key={business.id}
                      onClick={() => {
                        setSearchQuery("");
                        setSearchResults([]);
                        setShowDropdown(false);
                        navigate(`/BusinessPreview/${business.business_code}`);
                      }}
                      className="w-full p-4 hover:bg-white/5 transition-colors border-b border-gray-700 last:border-0 text-right"
                    >
                      <h3 className="text-white font-bold">{business.name}</h3>
                      <p className="text-[#94A3B8] text-sm">קוד: {business.business_code}</p>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-[#94A3B8] text-sm">
                    לא נמצאו עסקים
                  </div>
                )
              ) : (
                // Show all businesses when field is empty but focused
                allBusinesses.length > 0 ? (
                  <>
                    <div className="p-3 border-b border-gray-700">
                      <p className="text-[#94A3B8] text-xs font-semibold">עסקים זמינים</p>
                    </div>
                    {allBusinesses.map((business) => (
                      <button
                        key={business.id}
                        onClick={() => {
                          setShowDropdown(false);
                          navigate(`/BusinessPreview/${business.business_code}`);
                        }}
                        className="w-full p-4 hover:bg-white/5 transition-colors border-b border-gray-700 last:border-0 text-right"
                      >
                        <h3 className="text-white font-bold">{business.name}</h3>
                        <p className="text-[#94A3B8] text-sm">קוד: {business.business_code}</p>
                      </button>
                    ))}
                  </>
                ) : (
                  <div className="p-4 text-center text-[#94A3B8] text-sm">
                    אין עסקים זמינים
                  </div>
                )
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <button
            onClick={() => navigate("/DemoTour")}
            className="w-full h-14 rounded-2xl bg-[#1A1F35] text-white font-bold text-lg border-2 border-[#FF6B35] hover:bg-[#FF6B35]/10 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
          >
            <span>🎬</span>
            סיור באפליקציה
            <span className="text-xs bg-[#FF6B35]/20 text-[#FF6B35] px-2 py-1 rounded-full mr-2">ללא הרשמה</span>
          </button>

          <button
            onClick={() => navigate("/Auth?mode=signup")}
            className="w-full h-14 rounded-2xl text-white font-bold text-lg transition-all hover:scale-105 hover:shadow-2xl hover:shadow-[#FF6B35]/30 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
          >
            הרשמה
          </button>

          <button
            onClick={() => navigate("/Auth?mode=login")}
            className="w-full h-12 rounded-2xl text-[#94A3B8] font-medium text-base transition-all hover:text-white hover:bg-[#1A1F35]/50 active:scale-95"
          >
            התחברות
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
