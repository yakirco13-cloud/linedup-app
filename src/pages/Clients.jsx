import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useUser } from "@/components/UserContext";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ArrowRight, User, Phone, Mail, Calendar, Loader2, Search, Send, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { format, parseISO } from "date-fns";
import { he } from "date-fns/locale";

// Import centralized services
import { sendBroadcast } from "@/services/whatsappService";

export default function Clients() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState(null);

  const { data: business } = useQuery({
    queryKey: ['business', user?.business_id],
    queryFn: async () => {
      const businesses = await base44.entities.Business.filter({ id: user.business_id });
      return businesses[0];
    },
    enabled: !!user?.business_id,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['all-bookings', business?.id],
    queryFn: () => base44.entities.Booking.filter({ business_id: business.id }, '-created_at', 500),
    enabled: !!business?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });

  // Extract unique clients and their statistics
  const clients = React.useMemo(() => {
    const clientMap = {};
    
    bookings.forEach(booking => {
      // Skip walk-in clients (no phone or walkin email pattern)
      if (!booking.client_phone) return;
      if (booking.client_email?.includes('walkin_')) return;
      
      if (!clientMap[booking.client_phone]) {
        clientMap[booking.client_phone] = {
          email: booking.client_email || "",
          name: booking.client_name,
          phone: booking.client_phone,
          totalBookings: 0,
          completedBookings: 0,
          cancelledBookings: 0,
          lastVisit: null,
          firstVisit: booking.date,
        };
      }
      
      const client = clientMap[booking.client_phone];
      client.totalBookings++;
      
      if (booking.status === 'completed') {
        client.completedBookings++;
      } else if (booking.status === 'cancelled') {
        client.cancelledBookings++;
      }
      
      // Update last visit
      if (!client.lastVisit || booking.date > client.lastVisit) {
        if (booking.status === 'completed') {
          client.lastVisit = booking.date;
        }
      }
      
      // Update first visit
      if (booking.date < client.firstVisit) {
        client.firstVisit = booking.date;
      }
    });
    
    return Object.values(clientMap).sort((a, b) => {
      // Sort by last visit (most recent first), then by total bookings
      if (a.lastVisit && b.lastVisit) {
        return b.lastVisit.localeCompare(a.lastVisit);
      }
      if (a.lastVisit) return -1;
      if (b.lastVisit) return 1;
      return b.totalBookings - a.totalBookings;
    });
  }, [bookings]);

  // Filter clients based on search
  const filteredClients = clients.filter(client => {
    const query = searchQuery.toLowerCase();
    return (
      client.name?.toLowerCase().includes(query) ||
      client.email?.toLowerCase().includes(query) ||
      client.phone?.includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-[#0C0F1D] p-4 pt-safe">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate(createPageUrl("BusinessDashboard"))}
          className="flex items-center gap-2 text-[#94A3B8] mb-6 hover:text-white transition-colors py-2 px-1 -ml-1 min-h-[44px]"
        >
          <ArrowRight className="w-5 h-5" />
          <span className="font-medium">חזרה</span>
        </button>

        <h1 className="text-3xl font-bold mb-6 pt-2">הלקוחות שלי</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-[#1A1F35] rounded-2xl p-4 border-2 border-gray-800">
            <p className="text-[#94A3B8] text-sm mb-1">סך הכל לקוחות</p>
            <p className="text-3xl font-bold text-white">{clients.length}</p>
          </div>
          <div className="bg-[#1A1F35] rounded-2xl p-4 border-2 border-gray-800">
            <p className="text-[#94A3B8] text-sm mb-1">סך תורים</p>
            <p className="text-3xl font-bold text-white">
              {bookings.filter(b => b.client_phone && !b.client_email?.includes('walkin_')).length}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
          <Input
            type="text"
            placeholder="חפש לקוח..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-[#1A1F35] border-2 border-gray-800 text-white rounded-xl h-14 pr-12 placeholder:text-[#94A3B8] focus:border-[#FF6B35]"
          />
        </div>

        {/* Broadcast Button */}
        {clients.filter(c => c.phone).length > 0 && (
          <Button
            onClick={() => setBroadcastOpen(true)}
            className="w-full mb-6 h-14 rounded-xl gap-3 font-semibold text-lg"
            style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}
          >
            <MessageSquare className="w-6 h-6" />
            שליחת הודעת תפוצה ({clients.filter(c => c.phone).length} לקוחות)
          </Button>
        )}

        {/* Broadcast Dialog */}
        <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
          <DialogContent className="bg-[#1A1F35] border-gray-800 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-green-500" />
                שליחת הודעת תפוצה
              </DialogTitle>
              <DialogDescription className="text-[#94A3B8]">
                ההודעה תישלח ל-{clients.filter(c => c.phone).length} לקוחות שיש להם מספר טלפון
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 mt-4">
              <Textarea
                placeholder="כתוב את ההודעה שלך כאן..."
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                className="bg-[#0C0F1D] border-gray-700 text-white min-h-[120px] rounded-xl"
                maxLength={500}
              />
              <p className="text-xs text-[#94A3B8] text-left">{broadcastMessage.length}/500</p>
              
              {broadcastResult && (
                <div className={`p-4 rounded-xl ${broadcastResult.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {broadcastResult.message}
                </div>
              )}
              
              <div className="flex gap-3">
                <Button
                  onClick={async () => {
                    if (!broadcastMessage.trim()) return;
                    
                    setSendingBroadcast(true);
                    setBroadcastResult(null);
                    
                    try {
                      const clientsWithPhone = clients.filter(c => c.phone).map(c => ({
                        phone: c.phone,
                        name: c.name
                      }));
                      
                      const result = await sendBroadcast({
                        phones: clientsWithPhone.map(c => c.phone),
                        recipients: clientsWithPhone,
                        message: broadcastMessage,
                        businessName: business.name
                      });
                      
                      if (result.success) {
                        setBroadcastResult({
                          success: true,
                          message: `✅ ההודעה נשלחה ל-${result.data?.sent || 0} לקוחות!`
                        });
                        setBroadcastMessage("");
                        setTimeout(() => {
                          setBroadcastOpen(false);
                          setBroadcastResult(null);
                        }, 2000);
                      } else {
                        setBroadcastResult({
                          success: false,
                          message: `❌ שגיאה: ${result.error}`
                        });
                      }
                    } catch (error) {
                      setBroadcastResult({
                        success: false,
                        message: `❌ שגיאה בשליחה: ${error.message}`
                      });
                    } finally {
                      setSendingBroadcast(false);
                    }
                  }}
                  disabled={sendingBroadcast || !broadcastMessage.trim()}
                  className="flex-1 h-12 rounded-xl font-semibold"
                  style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}
                >
                  {sendingBroadcast ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-5 h-5 ml-2" />
                      שלח הודעה
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => {
                    setBroadcastOpen(false);
                    setBroadcastMessage("");
                    setBroadcastResult(null);
                  }}
                  variant="outline"
                  className="h-12 rounded-xl border-gray-700 bg-transparent text-white hover:bg-[#0C0F1D]"
                >
                  ביטול
                </Button>
              </div>
              
              <p className="text-xs text-[#94A3B8] text-center">
                💰 עלות: ${(clients.filter(c => c.phone).length * 0.0353).toFixed(2)} (לפי $0.0353 להודעה)
              </p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Clients List */}
        {isLoading ? (
          <div className="text-center py-16">
            <Loader2 className="w-12 h-12 animate-spin text-[#FF6B35] mx-auto" />
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 rounded-full bg-[#1A1F35] flex items-center justify-center mx-auto mb-6">
              <User className="w-12 h-12 text-[#94A3B8]" />
            </div>
            <h3 className="text-2xl font-bold mb-3">
              {searchQuery ? 'לא נמצאו לקוחות' : 'אין לקוחות עדיין'}
            </h3>
            <p className="text-[#94A3B8] text-lg">
              {searchQuery ? 'נסה חיפוש אחר' : 'לקוחות יופיעו כאן אחרי התור הראשון שלהם'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredClients.map((client) => (
              <div
                key={client.email}
                className="bg-[#1A1F35] rounded-2xl p-5 border-2 border-gray-800 hover:border-[#FF6B35] transition-all"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FF1744] flex items-center justify-center text-2xl font-bold flex-shrink-0">
                    {client.name ? client.name[0].toUpperCase() : '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold mb-1">{client.name}</h3>
                    <div className="space-y-1">
                      {client.email && (
                        <div className="flex items-center gap-2 text-[#94A3B8] text-sm">
                          <Mail className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{client.email}</span>
                        </div>
                      )}
                      {client.phone && (
                        <div className="flex items-center gap-2 text-[#94A3B8] text-sm">
                          <Phone className="w-4 h-4 flex-shrink-0" />
                          <span>{client.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-800">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[#FF6B35]">{client.totalBookings}</p>
                    <p className="text-xs text-[#94A3B8] mt-1">תורים</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-500">{client.completedBookings}</p>
                    <p className="text-xs text-[#94A3B8] mt-1">הושלמו</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-500">{client.cancelledBookings}</p>
                    <p className="text-xs text-[#94A3B8] mt-1">בוטלו</p>
                  </div>
                </div>

                {client.lastVisit && (
                  <div className="mt-3 pt-3 border-t border-gray-800">
                    <div className="flex items-center gap-2 text-[#94A3B8] text-sm">
                      <Calendar className="w-4 h-4" />
                      <span>ביקור אחרון: {format(parseISO(client.lastVisit), 'd בMMMM yyyy', { locale: he })}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}