import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Bell, Calendar, X, Edit, CheckCheck, ArrowLeft } from "lucide-react";
import { format, parseISO } from "date-fns";
import { he } from "date-fns/locale";

export default function NotificationDropdown({ businessId, onClose }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [swipedNotification, setSwipedNotification] = useState(null);
  const [swipeStartX, setSwipeStartX] = useState(null);
  const [swipeCurrentX, setSwipeCurrentX] = useState(null);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', businessId],
    queryFn: () => base44.entities.Notification.filter({ business_id: businessId }, '-created_date', 5),
    enabled: !!businessId,
    staleTime: 10 * 1000,
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.update(id, { is_read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const getNotificationIcon = (type) => {
    switch(type) {
      case 'booking_created': return <Calendar className="w-4 h-4 text-green-500" />;
      case 'booking_cancelled': return <X className="w-4 h-4 text-red-500" />;
      case 'booking_rescheduled': return <Edit className="w-4 h-4 text-blue-500" />;
      default: return <Bell className="w-4 h-4 text-[#FF6B35]" />;
    }
  };

  const handleViewAll = () => {
    onClose();
    navigate(createPageUrl("NotificationCenter"));
  };

  const handleSwipeStart = (e, notificationId) => {
    setSwipedNotification(notificationId);
    setSwipeStartX(e.touches[0].clientX);
    setSwipeCurrentX(e.touches[0].clientX);
  };

  const handleSwipeMove = (e, notificationId) => {
    if (swipedNotification === notificationId && swipeStartX !== null) {
      setSwipeCurrentX(e.touches[0].clientX);
    }
  };

  const handleSwipeEnd = (notificationId) => {
    if (swipeStartX !== null && swipeCurrentX !== null) {
      const swipeDistance = Math.abs(swipeCurrentX - swipeStartX);
      
      if (swipeDistance > 80) {
        markAsReadMutation.mutate(notificationId);
      }
    }
    
    setSwipedNotification(null);
    setSwipeStartX(null);
    setSwipeCurrentX(null);
  };

  const getSwipeOffset = (notificationId) => {
    if (swipedNotification === notificationId && swipeStartX !== null && swipeCurrentX !== null) {
      return swipeCurrentX - swipeStartX;
    }
    return 0;
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div 
      className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-16 pb-safe overflow-hidden"
      onClick={onClose}
    >
      <div 
        className="bg-[#1A1F35] rounded-2xl border-2 border-gray-800 w-full max-w-md mx-4 shadow-2xl max-h-[calc(100vh-8rem)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
          <h3 className="font-bold text-lg">התראות אחרונות</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
              {isLoading ? (
                <div className="p-8 text-center">
                  <Bell className="w-8 h-8 text-[#94A3B8] mx-auto mb-2 animate-pulse" />
                  <p className="text-[#94A3B8] text-sm">טוען...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-12 h-12 text-[#94A3B8] mx-auto mb-3" />
                  <p className="text-[#94A3B8]">אין התראות חדשות</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-800">
                  {notifications.filter(n => !n.is_read).map((notification) => {
                    const swipeOffset = getSwipeOffset(notification.id);
                    const opacity = Math.max(0, 1 - Math.abs(swipeOffset) / 150);
                    
                    return (
                      <div
                        key={notification.id}
                        className="relative overflow-hidden"
                        onTouchStart={(e) => handleSwipeStart(e, notification.id)}
                        onTouchMove={(e) => handleSwipeMove(e, notification.id)}
                        onTouchEnd={() => handleSwipeEnd(notification.id)}
                      >
                        <div
                          className="p-4 bg-[#FF6B35]/5 hover:bg-white/5 transition-colors"
                          style={{
                            transform: `translateX(${swipeOffset}px)`,
                            opacity: opacity,
                            transition: swipedNotification === notification.id ? 'none' : 'transform 0.3s ease, opacity 0.3s ease'
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#0C0F1D] flex items-center justify-center flex-shrink-0 mt-0.5">
                              {getNotificationIcon(notification.type)}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-1">
                                <h4 className="font-semibold text-sm">{notification.title}</h4>
                                <div className="w-2 h-2 bg-[#FF6B35] rounded-full flex-shrink-0 mr-2"></div>
                              </div>
                              <p className="text-xs text-[#94A3B8] mb-1">{notification.message}</p>
                              <p className="text-xs text-[#64748B]">
                                {format(parseISO(notification.created_date), 'HH:mm', { locale: he })}
                              </p>
                            </div>

                            <button
                              onClick={() => markAsReadMutation.mutate(notification.id)}
                              className="p-1 hover:bg-green-500/10 rounded-lg transition-colors text-green-500 flex-shrink-0"
                              title="סמן כנקרא"
                            >
                              <CheckCheck className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        {Math.abs(swipeOffset) > 10 && (
                          <div className="absolute top-0 bottom-0 left-4 right-4 flex items-center justify-center pointer-events-none">
                            <CheckCheck className="w-6 h-6 text-green-500" style={{ opacity: Math.min(1, Math.abs(swipeOffset) / 100) }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
        </div>

        <div className="p-4 border-t border-gray-800 flex-shrink-0">
              <button
                onClick={handleViewAll}
                className="w-full bg-gradient-to-r from-[#FF6B35] to-[#FF1744] rounded-xl py-3 font-semibold hover:scale-105 active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                <span>כל ההתראות</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
        </div>
      </div>
    </div>
  );
}