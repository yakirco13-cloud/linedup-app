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
    <div className="min-h-screen bg-[#0C0F1D]">
      <div className="max-w-2xl mx-auto">
        {/* Sticky Header */}
        <div className="sticky top-0 bg-[#0C0F1D] z-20 p-4 pt-safe border-b border-gray-800/50">
          <button
            onClick={() => navigate(createPageUrl("BusinessDashboard"))}
            className="flex items-center gap-2 text-[#94A3B8] mb-4 hover:text-white transition-colors py-2 px-1 -ml-1 min-h-[44px]"
          >
            <ArrowRight className="w-5 h-5" />
            <span className="font-medium">חזרה</span>
          </button>

          <h1 className="text-3xl font-bold">הלקוחות שלי</h1>
        </div>

        {/* Content */}
        <div className="p-4">
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
        {clients.length > 0 && (
          <Button
            onClick={() => setBroadcastOpen(true)}
            className="w-full mb-6 h-14 rounded-xl gap-3 font-semibold text-lg"
            style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
          >
            <MessageSquare className="w-6 h-6" />
            שליחת הודעה לכל הלקוחות ({clients.length} לקוחות)
          </Button>
        )}

        {/* Broadcast Dialog */}
        <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
          <DialogContent className="bg-[#1A1F35] border-gray-800 text-white max-w-sm overflow-y-auto max-h-[90vh]" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center justify-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#FF6B35]" />
                הודעה לכל הלקוחות
              </DialogTitle>
              <DialogDescription className="text-[#94A3B8] text-sm text-center">
                הלקוחות יראו את ההודעה בפעם הבאה שיכנסו לאפליקציה
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 mt-2">
              <Textarea
                placeholder="כתוב את ההודעה שלך כאן..."
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                className="bg-[#0C0F1D] border-gray-700 text-white min-h-[100px] rounded-xl text-sm"
                maxLength={500}
                dir="rtl"
              />
              <p className="text-xs text-[#94A3B8] text-right">{broadcastMessage.length}/500</p>
              
              {broadcastResult && (
                <div className={`p-4 rounded-xl ${broadcastResult.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {broadcastResult.message}
                </div>
              )}
              
              <div className="flex gap-2 flex-row-reverse">
                <Button
                  onClick={async () => {
                    if (!broadcastMessage.trim()) return;

                    setSendingBroadcast(true);
                    setBroadcastResult(null);

                    try {
                      // Save the broadcast message to the database
                      await base44.entities.BroadcastMessage.create({
                        business_id: business.id,
                        message: broadcastMessage,
                        created_by: user.id,
                        active: true
                      });

                      setBroadcastResult({
                        success: true,
                        message: `✅ ההודעה נשלחה בהצלחה!`
                      });
                      setBroadcastMessage("");
                      setTimeout(() => {
                        setBroadcastOpen(false);
                        setBroadcastResult(null);
                      }, 2000);
                    } catch (error) {
                      setBroadcastResult({
                        success: false,
                        message: `❌ שגיאה: ${error.message}`
                      });
                    } finally {
                      setSendingBroadcast(false);
                    }
                  }}
                  disabled={sendingBroadcast || !broadcastMessage.trim()}
                  className="flex-1 h-11 rounded-xl font-semibold text-sm"
                  style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
                >
                  {sendingBroadcast ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4 ml-2" />
                      שלח
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
                  className="h-11 px-6 rounded-xl border-gray-700 bg-transparent text-white hover:bg-[#0C0F1D] text-sm"
                >
                  ביטול
                </Button>
              </div>
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
                          <button
                            onClick={() => {
                              const normalizedPhone = client.phone.replace(/\D/g, '');
                              const whatsappNumber = normalizedPhone.startsWith('972') ? normalizedPhone : '972' + normalizedPhone.substring(1);
                              window.open(`https://wa.me/${whatsappNumber}`, '_blank');
                            }}
                            className="ml-2 p-1.5 rounded-full bg-green-500/20 hover:bg-green-500/30 transition-colors"
                            title="פתח ב-WhatsApp"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#22c55e">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                            </svg>
                          </button>
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
    </div>
  );
}