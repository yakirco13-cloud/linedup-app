import React, { useEffect, useState } from "react";
import { useUser } from "@/components/UserContext";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";

/**
 * BroadcastMessagePopup - Displays unread broadcast messages to clients
 * Shows as a popup when user opens the app
 */
export default function BroadcastMessagePopup() {
  const { user } = useUser();
  const [messages, setMessages] = useState([]);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user?.joined_business_id || user?.user_role !== 'client') return;

    const fetchUnreadMessages = async () => {
      try {
        // Get all active broadcast messages for this business
        const allMessages = await base44.entities.BroadcastMessage.filter({
          business_id: user.joined_business_id,
          active: true
        }, '-created_at');

        if (allMessages.length === 0) return;

        // Get messages that the user has already read
        const readRecords = await base44.entities.BroadcastMessageRead.filter({
          profile_id: user.id
        }, '-read_at');

        const readMessageIds = new Set(readRecords.map(r => r.message_id));

        // Filter to only unread messages
        const unreadMessages = allMessages.filter(msg => !readMessageIds.has(msg.id));

        if (unreadMessages.length > 0) {
          setMessages(unreadMessages);
          setIsOpen(true);
        }
      } catch (error) {
        console.error('Error fetching broadcast messages:', error);
      }
    };

    fetchUnreadMessages();
  }, [user]);

  const markAsRead = async (messageId) => {
    try {
      await base44.entities.BroadcastMessageRead.create({
        message_id: messageId,
        profile_id: user.id
      });
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const handleClose = async () => {
    if (messages.length === 0) return;

    // Mark current message as read
    await markAsRead(messages[currentMessageIndex].id);

    // If there are more messages, show the next one
    if (currentMessageIndex < messages.length - 1) {
      setCurrentMessageIndex(currentMessageIndex + 1);
    } else {
      // No more messages, close the popup
      setIsOpen(false);
      setMessages([]);
      setCurrentMessageIndex(0);
    }
  };

  if (messages.length === 0 || !isOpen) return null;

  const currentMessage = messages[currentMessageIndex];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) handleClose();
    }}>
      <DialogContent className="bg-[#1A1F35] border-gray-800 text-white max-w-sm overflow-y-auto max-h-[90vh]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center justify-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#FF6B35]" />
            הודעה חדשה
          </DialogTitle>
          {messages.length > 1 && (
            <DialogDescription className="text-[#94A3B8] text-sm text-center">
              הודעה {currentMessageIndex + 1} מתוך {messages.length}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="mt-2">
          <div className="bg-[#0C0F1D] rounded-xl p-4 mb-4">
            <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
              {currentMessage.message}
            </p>
          </div>

          <Button
            onClick={handleClose}
            className="w-full h-11 rounded-xl font-semibold text-sm"
            style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
          >
            {currentMessageIndex < messages.length - 1 ? 'הודעה הבאה' : 'הבנתי'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
