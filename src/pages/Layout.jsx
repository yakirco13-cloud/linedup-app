import React, { useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useUser } from "@/components/UserContext";
import { Home, Calendar, Settings, CalendarCheck, User } from "lucide-react";
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
    { name: 'לקוחות', path: "/Clients", icon: User },
    { name: 'הגדרות', path: "/Settings", icon: Settings },
  ];

  const clientTabs = [
    { name: 'בית', path: "/ClientDashboard", icon: Home },
    { name: 'תור חדש', path: "/BookAppointment", icon: Calendar },
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
      <main className={showNav ? "pb-20" : ""}>
        {children}
      </main>
      
      <PWAInstallPrompt />
      
      {showNav && (
        <motion.nav 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-0 left-0 right-0 bg-[#1A1F35]/95 backdrop-blur-lg border-t border-gray-800 z-50 shadow-2xl safe-area-inset-bottom"
        >
          <div className="flex justify-around items-center h-20 max-w-screen-lg mx-auto px-2">
            {tabs.map((tab) => {
              const isActive = location.pathname === tab.path;
              const Icon = tab.icon;
              
              return (
                <Link
                  key={tab.name}
                  to={tab.path}
                  className="relative flex flex-col items-center justify-center flex-1 h-16 transition-all duration-200"
                >
                  <motion.div
                    whileTap={{ scale: 0.9 }}
                    className={`flex flex-col items-center justify-center ${
                      isActive 
                        ? 'text-[#FF6B35]' 
                        : 'text-[#94A3B8]'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-[#FF6B35]/10 rounded-2xl"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <Icon className={`w-6 h-6 mb-1 relative z-10 ${isActive ? 'drop-shadow-[0_0_8px_rgba(255,107,53,0.5)]' : ''}`} />
                    <span className={`text-xs font-semibold relative z-10 ${isActive ? 'font-bold' : 'font-medium'}`}>
                      {tab.name}
                    </span>
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </motion.nav>
      )}

      <style jsx global>{`
        /* PWA optimizations */
        * {
          -webkit-tap-highlight-color: transparent;
          -webkit-touch-callout: none;
        }

        html, body {
          overscroll-behavior: none;
          -webkit-user-select: none;
          user-select: none;
        }

        input, textarea, button, select {
          -webkit-user-select: text;
          user-select: text;
        }

        /* Safe area for iPhone notch and top */
        .safe-area-inset-bottom {
          padding-bottom: env(safe-area-inset-bottom);
        }

        .pt-safe {
          padding-top: env(safe-area-inset-top);
        }

        .pb-safe {
          padding-bottom: calc(80px + env(safe-area-inset-bottom));
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