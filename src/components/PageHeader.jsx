import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function PageHeader({ title, showBackButton = true }) {
  const navigate = useNavigate();

  return (
    <div className="sticky top-0 z-20 bg-[#0C0F1D] border-b border-gray-800/50 pt-safe">
      {/* Header content */}
      <div className="px-5 pb-4">
        {showBackButton && (
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-[#94A3B8] mb-3 hover:text-white transition-colors"
          >
            <ArrowRight className="w-5 h-5" />
            <span className="font-medium">חזרה</span>
          </button>
        )}
        <h1 className="text-2xl font-bold text-white">{title}</h1>
      </div>
    </div>
  );
}
