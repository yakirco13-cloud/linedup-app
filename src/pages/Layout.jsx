import React, { useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useUser } from "@/components/UserContext";
import { Home, Calendar, Settings, CalendarCheck, CalendarPlus, User, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";

function AppContent({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, initialLoadComplete } = useUser();
  const hasCheckedSetup = useRef(false);
  const hasRenderedOnce = useRef(false);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Add PWA meta tags
  useEffect(() => {
    // Set viewport meta tag for mobile
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      document.head.appendChild(viewport);
    }
    viewport.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';

    // Add theme color
    let themeColor = document.querySelector('meta[name="theme-color"]');
    if (!themeColor) {
      themeColor = document.createElement('meta');
      themeColor.name = 'theme-color';
      document.head.appendChild(themeColor);
    }
    themeColor.content = '#FF6B35';

    // Add apple mobile web app capable
    let appleMobile = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
    if (!appleMobile) {
      appleMobile = document.createElement('meta');
      appleMobile.name = 'apple-mobile-web-app-capable';
      document.head.appendChild(appleMobile);
    }
    appleMobile.content = 'yes';

    // Add apple mobile web app status bar style
    let appleStatusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (!appleStatusBar) {
      appleStatusBar = document.createElement('meta');
      appleStatusBar.name = 'apple-mobile-web-app-status-bar-style';
      document.head.appendChild(appleStatusBar);
    }
    appleStatusBar.content = 'black-translucent';

    // Add apple mobile web app title
    let appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (!appleTitle) {
      appleTitle = document.createElement('meta');
      appleTitle.name = 'apple-mobile-web-app-title';
      document.head.appendChild(appleTitle);
    }
    appleTitle.content = 'LinedUp';

    // Add manifest link
    let manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = '/manifest.json';

    // Prevent pull to refresh on mobile
    document.body.style.overscrollBehavior = 'none';
  }, []);

  useEffect(() => {
    if (!loading && user && !hasCheckedSetup.current) {
      hasCheckedSetup.current = true;
      
      const currentPath = location.pathname;
      const isSetupPage = currentPath.includes('BusinessSetup') || 
                         currentPath.includes('Welcome') || 
                         currentPath.includes('Auth');

      if (!isSetupPage) {
        if (!user.user_role) {
          navigate("/Welcome");
          return;
        }
        
        if (user.user_role === 'business_owner' && !user.business_id) {
          navigate("/BusinessSetup");
          return;
        }
      }
    }
    
    if (!user) {
      hasCheckedSetup.current = false;
    }
  }, [user, loading, location.pathname, navigate]);

  const hideNav = location.pathname.includes('Welcome') ||
                  location.pathname.includes('Auth') ||
                  location.pathname.includes('BusinessSetup');

  const showNav = !hideNav && user?.user_role &&
                  (user.user_role === 'client' || (user.user_role === 'business_owner' && user.business_id));

  const isOwner = user?.user_role === 'business_owner';

  const ownerTabs = [
    { name: 'בית', path: "/BusinessDashboard", icon: Home },
    { name: 'יומן', path: "/CalendarView", icon: Calendar },
    { name: 'סטטיסטיקה', path: "/Statistics", icon: BarChart3 },
    { name: 'לקוחות', path: "/Clients", icon: User },
    { name: 'הגדרות', path: "/Settings", icon: Settings },
  ];

  const clientTabs = [
    { name: 'בית', path: "/ClientDashboard", icon: Home },
    { name: 'תור חדש', path: "/BookAppointment", icon: CalendarPlus },
    { name: 'התורים שלי', path: "/MyBookings", icon: CalendarCheck },
    { name: 'הגדרות', path: "/Settings", icon: Settings },
  ];

  const tabs = isOwner ? ownerTabs : clientTabs;

  // Only show loading on very first render, never again
  if (loading && !initialLoadComplete && !hasRenderedOnce.current) {
    return (
      <div className="min-h-screen bg-[#0C0F1D] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#FF6B35]"></div>
      </div>
    );
  }
  
  // Mark that we've rendered at least once
  if (initialLoadComplete || user) {
    hasRenderedOnce.current = true;
  }

  return (
    <div className="min-h-screen bg-[#0C0F1D] text-white" dir="rtl">
      <main className={`px-4 pt-safe ${showNav ? "pb-28" : ""}`}>
        <div className="max-w-2xl mx-auto">
          {children}
        </div>
      </main>

      <PWAInstallPrompt />

      {showNav && (
        <motion.nav
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-0 left-0 right-0 z-50 pb-safe"
        >
          <div className="bg-[#1A1F35] rounded-full py-2 px-2 mx-3 mb-2 flex justify-around items-center border border-white/5 shadow-2xl">
            {tabs.map((tab) => {
              // Case-insensitive path comparison
              const currentPath = location.pathname.toLowerCase();
              const tabPath = tab.path.toLowerCase();
              const isActive = currentPath === tabPath || currentPath.startsWith(tabPath + '/');
              const Icon = tab.icon;
              
              return (
                <Link
                  key={tab.name}
                  to={tab.path}
                  className={`flex items-center gap-1.5 transition-all duration-300 ${
                    isActive 
                      ? 'bg-[#FF6B35] text-white px-4 py-2.5 rounded-full' 
                      : 'text-[#94A3B8] p-2.5'
                  }`}
                  style={isActive ? { boxShadow: '0 4px 15px rgba(255, 107, 53, 0.4)' } : {}}
                >
                  <Icon className="w-5 h-5" />
                  {isActive && <span className="text-sm font-bold">{tab.name}</span>}
                </Link>
              );
            })}
          </div>
        </motion.nav>
      )}

      <style>{`
        /* PWA optimizations */
        * {
          -webkit-tap-highlight-color: transparent;
          -webkit-touch-callout: none;
        }

        html, body {
          overscroll-behavior: none;
          -webkit-user-select: none;
          user-select: none;
          background-color: #0C0F1D;
        }

        input, textarea, button, select {
          -webkit-user-select: text;
          user-select: text;
        }

        /* Safe area padding - applied to page containers */
        .pt-safe {
          padding-top: env(safe-area-inset-top, 8px);
        }

        /* Safe area top position - for sticky headers */
        .top-safe {
          top: env(safe-area-inset-top, 0px);
        }

        /* Bottom padding for pages with nav - Layout handles this now */
        .pb-safe {
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }

        /* Prevent zoom on input focus */
        input[type="text"],
        input[type="email"],
        input[type="tel"],
        input[type="number"],
        input[type="password"],
        textarea {
          font-size: 16px !important;
        }

        /* Hide scrollbar but keep functionality */
        ::-webkit-scrollbar {
          display: none;
        }

        * {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}

export default function Layout({ children }) {
  return <AppContent>{children}</AppContent>;
}