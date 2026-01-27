import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useUser } from "@/components/UserContext";
import { usePageHeader } from "@/components/PageHeaderContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Clock, CheckCircle, Loader2, Calendar } from "lucide-react";
import { LockedFeatureOverlay } from "@/components/FeatureGate";
import { getCurrentPlan } from "@/services/subscriptionService";

export default function BusinessPolicies() {
  const navigate = useNavigate();
  const { user } = useUser();
  const queryClient = useQueryClient();

  usePageHeader({
    title: "מדיניות ביטולים ואישורים",
    showBackButton: true,
    backPath: createPageUrl("Settings")
  });

  const [requireApproval, setRequireApproval] = useState(false); // Default false - STARTER+ feature
  const [cancellationHours, setCancellationHours] = useState("24");
  const [bookingWindowEnabled, setBookingWindowEnabled] = useState(false);
  const [bookingWindowDays, setBookingWindowDays] = useState("14");
  const [showSuccess, setShowSuccess] = useState(false);

  const { data: business, isLoading } = useQuery({
    queryKey: ['business', user?.business_id],
    queryFn: async () => {
      const businesses = await base44.entities.Business.filter({ id: user.business_id });
      return businesses[0];
    },
    enabled: !!user?.business_id,
  });

  // Get current subscription plan to enforce feature access
  const { data: currentPlan } = useQuery({
    queryKey: ['current-plan', user?.business_id],
    queryFn: () => getCurrentPlan(user.business_id),
    enabled: !!user?.business_id,
  });

  // Check feature access based on plan
  const hasNewClientApproval = currentPlan?.features?.newClientApproval || false;
  const hasCancellationPolicy = currentPlan?.features?.cancellationPolicy || false;
  const hasBookingVisibility = currentPlan?.features?.bookingVisibility || false;

  useEffect(() => {
    if (business) {
      // Enforce plan-based feature access
      const canUseApproval = hasNewClientApproval && (business.require_approval_for_new_clients ?? false);

      setRequireApproval(canUseApproval);
      setCancellationHours((business.cancellation_hours_limit || 24).toString());
      setBookingWindowEnabled(business.booking_window_enabled ?? false);
      setBookingWindowDays((business.booking_window_days || 14).toString());
    }
  }, [business, hasNewClientApproval]);

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Business.update(business.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business'] });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2500);
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      require_approval_for_new_clients: requireApproval,
      cancellation_hours_limit: parseInt(cancellationHours),
      booking_window_enabled: bookingWindowEnabled,
      booking_window_days: parseInt(bookingWindowDays)
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF6B35]" />
      </div>
    );
  }

  return (
    <>
        <div className="space-y-6">
          {/* Approval Policy - STARTER+ feature */}
          <LockedFeatureOverlay feature="newClientApproval">
          <div className="bg-[#1A1F35] rounded-2xl p-6 border border-gray-800">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-6 h-6 text-[#FF6B35]" />
              <h2 className="text-xl font-bold">אישור לקוחות חדשים</h2>
            </div>

            <p className="text-[#94A3B8] mb-4">
              האם לדרוש אישור ידני לתורים של לקוחות חדשים?
            </p>

            <div className="space-y-3">
              <button
                onClick={() => setRequireApproval(true)}
                className={`w-full p-4 rounded-xl border-2 transition-all text-right ${
                  requireApproval
                    ? 'border-[#FF6B35] bg-[#FF6B35]/10'
                    : 'border-gray-700 bg-[#0C0F1D]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    requireApproval ? 'border-[#FF6B35]' : 'border-gray-600'
                  }`}>
                    {requireApproval && <div className="w-3 h-3 rounded-full bg-[#FF6B35]" />}
                  </div>
                  <div>
                    <p className="font-bold text-white">כן, דרוש אישור</p>
                    <p className="text-sm text-[#94A3B8]">
                      לקוחות חדשים יצטרכו אישור לפני שהתור יאושר
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setRequireApproval(false)}
                className={`w-full p-4 rounded-xl border-2 transition-all text-right ${
                  !requireApproval
                    ? 'border-[#FF6B35] bg-[#FF6B35]/10'
                    : 'border-gray-700 bg-[#0C0F1D]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    !requireApproval ? 'border-[#FF6B35]' : 'border-gray-600'
                  }`}>
                    {!requireApproval && <div className="w-3 h-3 rounded-full bg-[#FF6B35]" />}
                  </div>
                  <div>
                    <p className="font-bold text-white">לא, אישור אוטומטי</p>
                    <p className="text-sm text-[#94A3B8]">
                      כל התורים יאושרו אוטומטית ללא צורך באישור ידני
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
          </LockedFeatureOverlay>

          {/* Cancellation Policy - PRO+ feature */}
          <LockedFeatureOverlay feature="cancellationPolicy">
          <div className="bg-[#1A1F35] rounded-2xl p-6 border border-gray-800">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-6 h-6 text-[#FF6B35]" />
              <h2 className="text-xl font-bold">מדיניות ביטולים</h2>
            </div>

            <p className="text-[#94A3B8] mb-4">
              כמה שעות לפני התור לקוחות יכולים לבטל או לערוך?
            </p>

            <div className="space-y-2">
              <Label className="text-white">זמן מינימלי לפני התור (שעות)</Label>
              <Select
                value={cancellationHours}
                onValueChange={setCancellationHours}
              >
                <SelectTrigger className="bg-[#0C0F1D] border-gray-700 text-white h-12 rounded-xl [&>span]:text-right [&>span]:flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">שעה אחת</SelectItem>
                  <SelectItem value="2">שעתיים</SelectItem>
                  <SelectItem value="3">3 שעות</SelectItem>
                  <SelectItem value="6">6 שעות</SelectItem>
                  <SelectItem value="12">12 שעות</SelectItem>
                  <SelectItem value="24">24 שעות (יום)</SelectItem>
                  <SelectItem value="48">48 שעות (יומיים)</SelectItem>
                  <SelectItem value="72">72 שעות (3 ימים)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[#94A3B8] text-sm">
                לקוחות יוכלו לבטל או לערוך תור עד {cancellationHours} שעות לפני מועד התור
              </p>
            </div>
          </div>
          </LockedFeatureOverlay>

          {/* Booking Window - STARTER+ feature (bookingVisibility) */}
          <LockedFeatureOverlay feature="bookingVisibility">
          <div className="bg-[#1A1F35] rounded-2xl p-6 border border-gray-800">
            <div className="flex items-center gap-3 mb-4">
              <Calendar className="w-6 h-6 text-[#FF6B35]" />
              <h2 className="text-xl font-bold">חלון הזמנות</h2>
            </div>

            <p className="text-[#94A3B8] mb-4">
              הגבל כמה ימים מראש לקוחות יכולים לקבוע תורים
            </p>

            <div className="space-y-4">
              <button
                onClick={() => setBookingWindowEnabled(false)}
                className={`w-full p-4 rounded-xl border-2 transition-all text-right ${
                  !bookingWindowEnabled
                    ? 'border-[#FF6B35] bg-[#FF6B35]/10'
                    : 'border-gray-700 bg-[#0C0F1D]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    !bookingWindowEnabled ? 'border-[#FF6B35]' : 'border-gray-600'
                  }`}>
                    {!bookingWindowEnabled && <div className="w-3 h-3 rounded-full bg-[#FF6B35]" />}
                  </div>
                  <div>
                    <p className="font-bold text-white">ללא הגבלה</p>
                    <p className="text-sm text-[#94A3B8]">
                      לקוחות יכולים לקבוע תורים לכל תאריך פנוי
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setBookingWindowEnabled(true)}
                className={`w-full p-4 rounded-xl border-2 transition-all text-right ${
                  bookingWindowEnabled
                    ? 'border-[#FF6B35] bg-[#FF6B35]/10'
                    : 'border-gray-700 bg-[#0C0F1D]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    bookingWindowEnabled ? 'border-[#FF6B35]' : 'border-gray-600'
                  }`}>
                    {bookingWindowEnabled && <div className="w-3 h-3 rounded-full bg-[#FF6B35]" />}
                  </div>
                  <div>
                    <p className="font-bold text-white">הגבל ימים מראש</p>
                    <p className="text-sm text-[#94A3B8]">
                      לקוחות יכולים לקבוע תורים רק עד מספר ימים מראש
                    </p>
                  </div>
                </div>
              </button>

              {bookingWindowEnabled && (
                <div className="space-y-2 mt-4 pr-8">
                  <Label className="text-white">מספר ימים מראש</Label>
                  <Select
                    value={bookingWindowDays}
                    onValueChange={setBookingWindowDays}
                  >
                    <SelectTrigger className="bg-[#0C0F1D] border-gray-700 text-white h-12 rounded-xl [&>span]:text-right [&>span]:flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 ימים</SelectItem>
                      <SelectItem value="7">שבוע</SelectItem>
                      <SelectItem value="14">שבועיים</SelectItem>
                      <SelectItem value="21">3 שבועות</SelectItem>
                      <SelectItem value="30">חודש</SelectItem>
                      <SelectItem value="60">חודשיים</SelectItem>
                      <SelectItem value="90">3 חודשים</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[#94A3B8] text-sm">
                    לקוחות יוכלו לקבוע תורים עד {bookingWindowDays} ימים מהיום
                  </p>
                </div>
              )}
            </div>
          </div>
          </LockedFeatureOverlay>

          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="w-full h-14 rounded-xl text-white font-semibold text-lg"
            style={{ background: showSuccess ? '#22c55e' : 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : showSuccess ? (
              <>
                <CheckCircle className="w-6 h-6 ml-2" />
                נשמר בהצלחה!
              </>
            ) : (
              'שמור שינויים'
            )}
          </Button>
        </div>
    </>
  );
}