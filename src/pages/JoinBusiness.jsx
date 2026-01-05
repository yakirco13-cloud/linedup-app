import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useUser } from "@/components/UserContext";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Search, Loader2, CheckCircle, Store, Briefcase } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function JoinBusiness() {
  const navigate = useNavigate();
  const { user, updateUser, refetchUser } = useUser();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [joinMethod, setJoinMethod] = useState("search");

  const { data: allBusinesses = [], isLoading: searchLoading } = useQuery({
    queryKey: ['all-businesses'],
    queryFn: () => base44.entities.Business.list('-created_at', 100),
    enabled: joinMethod === 'search',
  });

  const filteredBusinesses = allBusinesses.filter(business =>
    business.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleJoinBusiness = async (business) => {
    setError("");
    setLoading(true);

    try {
      if (user?.joined_business_id === business.id) {
        setError("כבר הצטרפת לעסק זה");
        setLoading(false);
        return;
      }

      await updateUser({
        joined_business_id: business.id
      });

      queryClient.invalidateQueries({ queryKey: ['my-barbershop'] });
      
      await new Promise(resolve => setTimeout(resolve, 800));
      await refetchUser();
      await new Promise(resolve => setTimeout(resolve, 400));
      await refetchUser();

      setSuccess(true);
      setTimeout(() => {
        navigate(createPageUrl("ClientDashboard"));
      }, 1000);

    } catch (err) {
      console.error("Error joining business:", err);
      setError("שגיאה בהצטרפות לעסק. נסה שוב.");
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const businesses = await base44.entities.Business.filter({ 
        business_code: code.toUpperCase() 
      });

      if (businesses.length === 0) {
        setError("קוד עסק לא נמצא. אנא בדוק את הקוד ונסה שוב.");
        setLoading(false);
        return;
      }

      await handleJoinBusiness(businesses[0]);

    } catch (err) {
      console.error("Error joining business:", err);
      setError("שגיאה בהצטרפות לעסק. נסה שוב.");
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#0C0F1D] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-24 h-24 rounded-3xl bg-green-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-14 h-14 text-green-500" />
          </div>
          <h2 className="text-3xl font-bold text-green-500 mb-3">הצלחה!</h2>
          <p className="text-white text-lg">הצטרפת לעסק בהצלחה</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0C0F1D] p-4 pb-24 pt-safe">
      <div className="max-w-md mx-auto">
        <button
          onClick={() => navigate(createPageUrl("ClientDashboard"))}
          className="flex items-center gap-2 text-[#94A3B8] mb-8 hover:text-white transition-colors h-10"
        >
          <ArrowRight className="w-5 h-5" />
          <span className="font-medium">חזרה</span>
        </button>

        <div className="text-center mb-8 pt-4">
          <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-[#FF6B35] to-[#FF1744] flex items-center justify-center">
            <Store className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-3">הצטרף לעסק</h1>
          <p className="text-[#94A3B8] text-base leading-relaxed">חפש עסק או הזן קוד להצטרפות</p>
        </div>

        {/* Join Method Toggle */}
        <div className="flex gap-3 mb-6">
          <button
            type="button"
            onClick={() => setJoinMethod('search')}
            className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
              joinMethod === 'search'
                ? 'bg-gradient-to-r from-[#FF6B35] to-[#FF1744] text-white scale-105'
                : 'bg-[#1A1F35] text-[#94A3B8] border-2 border-gray-800 hover:border-[#FF6B35]'
            }`}
          >
            <Search className="w-5 h-5 inline ml-2" />
            חיפוש עסק
          </button>
          <button
            type="button"
            onClick={() => setJoinMethod('code')}
            className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
              joinMethod === 'code'
                ? 'bg-gradient-to-r from-[#FF6B35] to-[#FF1744] text-white scale-105'
                : 'bg-[#1A1F35] text-[#94A3B8] border-2 border-gray-800 hover:border-[#FF6B35]'
            }`}
          >
            <Store className="w-5 h-5 inline ml-2" />
            קוד עסק
          </button>
        </div>

        {joinMethod === 'search' ? (
          <div className="space-y-4">
            <div className="bg-[#1A1F35] rounded-2xl p-6 border border-gray-800">
              <Label htmlFor="search" className="text-white text-lg font-semibold mb-3 block">חפש עסק</Label>
              <div className="relative">
                <Search className="absolute right-4 top-4 w-5 h-5 text-[#94A3B8]" />
                <Input
                  id="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="הקלד שם עסק..."
                  className="bg-[#0C0F1D] border-gray-700 text-white h-14 text-lg rounded-xl focus:border-[#FF6B35] focus:ring-[#FF6B35] pr-12"
                />
              </div>
            </div>

            {searchLoading ? (
              <div className="py-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#FF6B35] mx-auto" />
              </div>
            ) : filteredBusinesses.length === 0 ? (
              <div className="py-16 text-center bg-[#1A1F35] rounded-2xl border border-gray-800">
                <Briefcase className="w-16 h-16 text-[#94A3B8] mx-auto mb-4" />
                <p className="text-[#94A3B8] text-lg">
                  {searchQuery ? 'לא נמצאו עסקים' : 'התחל לחפש עסקים'}
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredBusinesses.map((business) => (
                  <button
                    key={business.id}
                    onClick={() => handleJoinBusiness(business)}
                    disabled={loading}
                    className="w-full bg-[#1A1F35] border-2 border-gray-800 hover:border-[#FF6B35] rounded-2xl p-5 text-right transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                  >
                    <div className="flex items-center gap-4">
                      {business.photo_url ? (
                        <img src={business.photo_url} alt={business.name} className="w-16 h-16 rounded-xl object-cover" />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#FF6B35] to-[#FF1744] flex items-center justify-center flex-shrink-0">
                          <Store className="w-8 h-8 text-white" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-xl text-white mb-1">{business.name}</h3>
                        {business.description && (
                          <p className="text-sm text-[#94A3B8] line-clamp-1">{business.description}</p>
                        )}
                        {business.phone && (
                          <p className="text-sm text-[#94A3B8] mt-1">{business.phone}</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border-2 border-red-500/50 rounded-2xl p-4 text-red-400 text-sm text-center font-medium">
                {error}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-[#1A1F35] rounded-2xl p-6 border border-gray-800">
            <div className="space-y-3">
              <Label htmlFor="code" className="text-white text-lg font-semibold">קוד עסק</Label>
              <Input
                id="code"
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError("");
                }}
                className="bg-[#0C0F1D] border-gray-700 text-white h-16 rounded-xl text-center text-3xl tracking-widest font-bold focus:border-[#FF6B35] focus:ring-[#FF6B35] transition-colors"
                placeholder="XXXXXX"
                maxLength={6}
                required
              />
              <p className="text-[#94A3B8] text-sm text-center mt-3">
                הקוד מורכב מ-6 תווים
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border-2 border-red-500/50 rounded-2xl p-4 text-red-400 text-sm text-center font-medium">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full h-14 rounded-xl text-white font-semibold text-lg hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{
              background: 'linear-gradient(135deg, #FF6B35, #FF1744)',
            }}
          >
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              "הצטרף לעסק"
            )}
          </Button>

          <div className="mt-8 bg-[#1A1F35] rounded-2xl p-6 border border-gray-800">
          <h3 className="font-bold mb-4 text-lg">איפה אני מוצא את הקוד?</h3>
          <ul className="space-y-3 text-[#94A3B8] text-base leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="text-[#FF6B35] font-bold">•</span>
              <span>שאל את בעל העסק</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#FF6B35] font-bold">•</span>
              <span>הקוד מופיע בדף הבית של העסק</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#FF6B35] font-bold">•</span>
              <span>הקוד מורכב מ-6 אותיות באנגלית</span>
            </li>
          </ul>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}