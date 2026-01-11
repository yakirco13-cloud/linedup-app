import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useUser } from "@/components/UserContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle, XCircle, Clock, User, Calendar, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { he } from "date-fns/locale";

// Import centralized services
import { sendConfirmation, sendCancellation } from "@/services/whatsappService";

export default function ApprovalManagement() {
  const navigate = useNavigate();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('pending');

  const { data: business } = useQuery({
    queryKey: ['business', user?.business_id],
    queryFn: async () => {
      const businesses = await base44.entities.Business.filter({ id: user.business_id });
      return businesses[0];
    },
    enabled: !!user?.business_id,
  });

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['pending-bookings', business?.id],
    queryFn: () => base44.entities.Booking.filter({ 
      business_id: business.id,
      status: 'pending_approval'
    }, '-created_at', 50),
    enabled: !!business?.id,
    staleTime: 5 * 1000,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const approveMutation = useMutation({
    mutationFn: async (booking) => {
      // Update booking status to confirmed
      await base44.entities.Booking.update(booking.id, { status: 'confirmed' });
      return booking;
    },
    onSuccess: async (booking) => {
      // Send WhatsApp confirmation to client
      if (booking.client_phone) {
        await sendConfirmation({
          phone: booking.client_phone,
          clientName: booking.client_name,
          businessName: business?.name || 'העסק',
          date: booking.date,
          time: booking.time
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['pending-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (booking) => {
      await base44.entities.Booking.update(booking.id, { status: 'cancelled' });
      return booking;
    },
    onSuccess: async (booking) => {
      // Send WhatsApp rejection notification to client
      if (booking.client_phone) {
        await sendCancellation({
          phone: booking.client_phone,
          clientName: booking.client_name,
          businessName: business?.name || 'העסק'
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['pending-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });

  const handleApprove = (booking) => {
    if (window.confirm(`לאשר את התור של ${booking.client_name}?`)) {
      approveMutation.mutate(booking);
    }
  };

  const handleReject = (booking) => {
    if (window.confirm(`לדחות את התור של ${booking.client_name}?`)) {
      rejectMutation.mutate(booking);
    }
  };

  return (
    <div className="min-h-screen bg-[#0C0F1D] p-6 pb-24">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate(createPageUrl("Settings"))}
          className="flex items-center gap-2 text-[#94A3B8] mb-6 hover:text-white transition-colors py-2 px-1 -ml-1 min-h-[44px]"
        >
          <ArrowRight className="w-5 h-5" />
          <span>חזרה</span>
        </button>

        <h1 className="text-3xl font-bold mb-8">תורים הממתינים לאישור</h1>

        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#FF6B35] mx-auto" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-12 bg-[#1A1F35] rounded-2xl border border-gray-800">
            <CheckCircle className="w-16 h-16 text-[#94A3B8] mx-auto mb-4" />
            <p className="text-[#94A3B8]">אין תורים הממתינים לאישור</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <div key={booking.id} className="bg-[#1A1F35] rounded-2xl p-5 border border-gray-800">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-5 h-5 text-[#FF6B35]" />
                      <h3 className="text-lg font-bold">{booking.client_name}</h3>
                      {booking.is_first_booking && (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-lg">
                          לקוח חדש
                        </span>
                      )}
                    </div>
                    <p className="text-[#94A3B8] text-sm mb-1">{booking.client_email}</p>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-[#94A3B8]">
                    <Calendar className="w-4 h-4" />
                    <span>{booking.service_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#94A3B8]">
                    <User className="w-4 h-4" />
                    <span>עם {booking.staff_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#94A3B8]">
                    <Clock className="w-4 h-4" />
                    <span>
                      {format(parseISO(booking.date), 'd בMMMM yyyy', { locale: he })} • {booking.time}
                    </span>
                  </div>
                </div>

                {booking.notes && (
                  <div className="bg-[#0C0F1D] rounded-xl p-3 mb-4">
                    <p className="text-[#94A3B8] text-sm">{booking.notes}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={() => handleApprove(booking)}
                    disabled={approveMutation.isPending}
                    className="flex-1 h-12 rounded-xl bg-green-600 hover:bg-green-700"
                  >
                    {approveMutation.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5 ml-2" />
                        אשר
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => handleReject(booking)}
                    disabled={rejectMutation.isPending}
                    variant="outline"
                    className="flex-1 h-12 rounded-xl border-red-500 text-red-500 hover:bg-red-500/10"
                  >
                    {rejectMutation.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <XCircle className="w-5 h-5 ml-2" />
                        דחה
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}