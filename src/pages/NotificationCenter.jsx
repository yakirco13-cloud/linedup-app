import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useUser } from "@/components/UserContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Bell, CheckCheck, Trash2, Calendar, X, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { he } from "date-fns/locale";

export default function NotificationCenter() {
  const navigate = useNavigate();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');

  const { data: business } = useQuery({
    queryKey: ['business', user?.business_id],
    queryFn: async () => {
      const businesses = await base44.entities.Business.filter({ id: user.business_id });
      return businesses[0];
    },
    enabled: !!user?.business_id,
    staleTime: 10 * 60 * 1000,
  });

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', business?.id],
    queryFn: () => base44.entities.Notification.filter({ business_id: business.id }, '-created_at', 100),
    enabled: !!business?.id,
    staleTime: 30 * 1000,
    refetchInterval: 30000,
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.update(id, { is_read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const unreadNotifications = notifications.filter(n => !n.is_read);
      await Promise.all(
        unreadNotifications.map(n => base44.entities.Notification.update(n.id, { is_read: true }))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const getNotificationIcon = (type) => {
    switch(type) {
      case 'booking_created': return <Calendar className="w-5 h-5 text-green-500" />;
      case 'booking_cancelled': return <X className="w-5 h-5 text-red-500" />;
      case 'booking_rescheduled': return <Edit className="w-5 h-5 text-blue-500" />;
      default: return <Bell className="w-5 h-5 text-[#FF6B35]" />;
    }
  };

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.is_read)
    : notifications;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen bg-[#0C0F1D] p-4 pt-safe">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate(createPageUrl("BusinessDashboard"))}
          className="flex items-center justify-center gap-2 text-[#94A3B8] mb-6 hover:text-white transition-colors min-h-12 p-3 -mx-3 rounded-lg hover:bg-white/5"
        >
          <ArrowRight className="w-5 h-5" />
          <span className="font-medium">חזרה</span>
        </button>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">התראות</h1>
          {unreadCount > 0 && (
            <Button
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
              variant="ghost"
              className="text-[#FF6B35] hover:text-[#FF6B35]/80 hover:bg-[#FF6B35]/10 h-10 rounded-xl font-semibold"
            >
              <CheckCheck className="w-5 h-5 ml-2" />
              סמן הכל כנקרא
            </Button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all ${
              filter === 'all'
                ? 'bg-gradient-to-r from-[#FF6B35] to-[#FF1744] text-white shadow-lg scale-105'
                : 'bg-[#1A1F35] text-[#94A3B8] border-2 border-gray-800 hover:border-[#FF6B35] hover:scale-105 active:scale-95'
            }`}
          >
            <div className="text-base">הכל</div>
            <div className="text-2xl font-bold mt-1">{notifications.length}</div>
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all ${
              filter === 'unread'
                ? 'bg-gradient-to-r from-[#FF6B35] to-[#FF1744] text-white shadow-lg scale-105'
                : 'bg-[#1A1F35] text-[#94A3B8] border-2 border-gray-800 hover:border-[#FF6B35] hover:scale-105 active:scale-95'
            }`}
          >
            <div className="text-base">לא נקראו</div>
            <div className="text-2xl font-bold mt-1">{unreadCount}</div>
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-16">
            <Bell className="w-12 h-12 text-[#94A3B8] mx-auto mb-4 animate-pulse" />
            <p className="text-[#94A3B8]">טוען התראות...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 rounded-full bg-[#1A1F35] flex items-center justify-center mx-auto mb-6">
              <Bell className="w-12 h-12 text-[#94A3B8]" />
            </div>
            <h3 className="text-2xl font-bold mb-3">
              {filter === 'unread' ? 'אין התראות חדשות' : 'אין התראות'}
            </h3>
            <p className="text-[#94A3B8] text-lg">
              {filter === 'unread' 
                ? 'כל ההתראות נקראו' 
                : 'התראות על פעולות לקוחות יופיעו כאן'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-[#1A1F35] rounded-2xl p-5 border-2 transition-all hover:scale-[1.01] ${
                  notification.is_read 
                    ? 'border-gray-800 opacity-70' 
                    : 'border-[#FF6B35]/30 bg-[#FF6B35]/5'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#0C0F1D] flex items-center justify-center flex-shrink-0">
                    {getNotificationIcon(notification.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-bold text-lg">{notification.title}</h3>
                      {!notification.is_read && (
                        <div className="w-2 h-2 bg-[#FF6B35] rounded-full flex-shrink-0 mr-2 mt-2"></div>
                      )}
                    </div>
                    
                    <p className="text-[#94A3B8] mb-3">{notification.message}</p>
                    
                    <p className="text-xs text-[#64748B]">
                      {format(parseISO(notification.created_at), 'PPpp', { locale: he })}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {!notification.is_read && (
                      <button
                        onClick={() => markAsReadMutation.mutate(notification.id)}
                        disabled={markAsReadMutation.isPending}
                        className="p-2 hover:bg-green-500/10 rounded-lg transition-colors text-green-500"
                        title="סמן כנקרא"
                      >
                        <CheckCheck className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteMutation.mutate(notification.id)}
                      disabled={deleteMutation.isPending}
                      className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-red-500"
                      title="מחק"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}