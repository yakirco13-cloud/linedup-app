import React from "react";

export default function StickyHeader({ children, className = "" }) {
  return (
    <div className={`sticky top-0 z-20 bg-[#0C0F1D] -mx-4 px-4 pt-safe pb-4 ${className}`}>
      {children}
    </div>
  );
}
