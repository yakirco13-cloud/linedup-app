import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, AlertTriangle, TrendingUp } from 'lucide-react';
import { getMessageUsage } from '@/lib/supabase/messageTracking';

export default function MessageUsageCard({ businessId }) {
  const { data: usage, isLoading } = useQuery({
    queryKey: ['message-usage', businessId],
    queryFn: () => getMessageUsage(businessId),
    enabled: !!businessId,
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading || !usage) {
    return (
      <div className="bg-[#1A1F35] rounded-2xl p-4 border border-gray-800 animate-pulse">
        <div className="h-20 bg-gray-700 rounded"></div>
      </div>
    );
  }

  const { count, limit, percentage } = usage;
  
  // Determine status color
  let statusColor = 'text-green-400';
  let bgColor = 'bg-green-500';
  let warningMessage = null;

  if (percentage >= 100) {
    statusColor = 'text-red-400';
    bgColor = 'bg-red-500';
    warningMessage = 'הגעת למגבלת ההודעות החודשית';
  } else if (percentage >= 80) {
    statusColor = 'text-yellow-400';
    bgColor = 'bg-yellow-500';
    warningMessage = 'קרוב למגבלת ההודעות';
  }

  return (
    <div className="bg-[#1A1F35] rounded-2xl p-4 border border-gray-800">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-[#FF6B35]" />
          <span className="font-semibold text-sm">הודעות WhatsApp</span>
        </div>
        <span className={`text-xs font-medium ${statusColor}`}>
          {percentage}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-[#0C0F1D] rounded-full overflow-hidden mb-2">
        <div 
          className={`h-full ${bgColor} transition-all duration-500`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      {/* Count display */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#94A3B8]">נשלחו החודש</span>
        <span className={`font-bold ${statusColor}`}>
          {count.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>

      {/* Warning message */}
      {warningMessage && (
        <div className={`mt-3 flex items-center gap-2 text-xs ${statusColor}`}>
          <AlertTriangle className="w-4 h-4" />
          <span>{warningMessage}</span>
        </div>
      )}

      {/* Upgrade prompt when near limit */}
      {percentage >= 80 && (
        <button className="mt-3 w-full py-2 px-3 bg-[#FF6B35]/10 hover:bg-[#FF6B35]/20 border border-[#FF6B35]/30 rounded-xl text-[#FF6B35] text-xs font-medium transition-colors">
          <TrendingUp className="w-3 h-3 inline ml-1" />
          שדרג לעוד הודעות
        </button>
      )}
    </div>
  );
}
