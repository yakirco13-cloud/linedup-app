import Layout from "./Layout.jsx";
import ApprovalManagement from "./ApprovalManagement";
import Auth from "./Auth";
import BookAppointment from "./BookAppointment";
import BusinessDashboard from "./BusinessDashboard";
import BusinessPolicies from "./BusinessPolicies";
import BusinessPreview from "./BusinessPreview";
import BusinessSettings from "./BusinessSettings";
import BusinessSetup from "./BusinessSetup";
import CalendarView from "./CalendarView";
import ClientDashboard from "./ClientDashboard";
import Clients from "./Clients";
import CreateBooking from "./CreateBooking";
import DemoTour from "./DemoTour";
import JoinBusiness from "./JoinBusiness";
import MyBookings from "./MyBookings";
import NotificationCenter from "./NotificationCenter";
import Pricing from "./Pricing";
import RecurringManagement from "./RecurringManagement";
import ServiceManagement from "./ServiceManagement";
import Settings from "./Settings";
import SharedCalendar from "./SharedCalendar";
import StaffManagement from "./StaffManagement";
import Statistics from "./Statistics";
import TermsOfService from "./TermsOfService";
import Welcome from "./Welcome";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    ApprovalManagement,
    Auth,
    BookAppointment,
    BusinessDashboard,
    BusinessPolicies,
    BusinessPreview,
    BusinessSettings,
    BusinessSetup,
    CalendarView,
    ClientDashboard,
    Clients,
    CreateBooking,
    DemoTour,
    JoinBusiness,
    MyBookings,
    NotificationCenter,
    Pricing,
    RecurringManagement,
    ServiceManagement,
    Settings,
    SharedCalendar,
    StaffManagement,
    Statistics,
    TermsOfService,
    Welcome,
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || 'Welcome';
}

function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>
                <Route path="/" element={<Welcome />} />
                <Route path="/Welcome" element={<Welcome />} />
                <Route path="/Auth" element={<Auth />} />
                <Route path="/ApprovalManagement" element={<ApprovalManagement />} />
                <Route path="/BookAppointment" element={<BookAppointment />} />
                <Route path="/BusinessDashboard" element={<BusinessDashboard />} />
                <Route path="/BusinessPolicies" element={<BusinessPolicies />} />
                <Route path="/BusinessPreview/:businessCode" element={<BusinessPreview />} />
                <Route path="/BusinessSettings" element={<BusinessSettings />} />
                <Route path="/BusinessSetup" element={<BusinessSetup />} />
                <Route path="/CalendarView" element={<CalendarView />} />
                <Route path="/ClientDashboard" element={<ClientDashboard />} />
                <Route path="/Clients" element={<Clients />} />
                <Route path="/CreateBooking" element={<CreateBooking />} />
                <Route path="/DemoTour" element={<DemoTour />} />
                <Route path="/JoinBusiness" element={<JoinBusiness />} />
                <Route path="/MyBookings" element={<MyBookings />} />
                <Route path="/NotificationCenter" element={<NotificationCenter />} />
                <Route path="/Pricing" element={<Pricing />} />
                <Route path="/RecurringManagement" element={<RecurringManagement />} />
                <Route path="/ServiceManagement" element={<ServiceManagement />} />
                <Route path="/Settings" element={<Settings />} />
                <Route path="/SharedCalendar" element={<SharedCalendar />} />
                <Route path="/StaffManagement" element={<StaffManagement />} />
                <Route path="/Statistics" element={<Statistics />} />
                <Route path="/TermsOfService" element={<TermsOfService />} />
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}