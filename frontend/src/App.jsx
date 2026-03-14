// src/App.jsx - ALWAYS PROFILESETUP FIRST VERSION ✅
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect, useState } from 'react';
import { AppProvider } from './context/AppContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import ServiceSales from './pages/ServiceSales';
import Products from './pages/Products';
import Services from './pages/Services';
import Transactions from './pages/Transactions';
import Reports from './pages/Reports';
import Profiles from './pages/Profiles';
import ProfileSetup from './pages/ProfileSetup';
import './styles/global.css';
import Icon from './components/Icon'; 

// ── Layout Components ─────────────────────────────────────
function Layout({ children, hideSidebar }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-layout">
      {!hideSidebar && (
        <Sidebar 
          isOpen={sidebarOpen} 
          onClose={() => setSidebarOpen(false)} 
        />
      )}
      <main className="main-content">
        {/* Hamburger Button - Mobile Only */}
        {!hideSidebar && (
          <button 
            className="menu-toggle"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Icon name="menu" size={20} />
          </button>
        )}
        {children}
      </main>
    </div>
  );
}

function POSLayout({ hideSidebar }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', width: '100%', position: 'relative' }}>
      {!hideSidebar && (
        <Sidebar 
          isOpen={sidebarOpen} 
          onClose={() => setSidebarOpen(false)} 
        />
      )}
      {/* Hamburger Button for POS - Mobile Only */}
      {!hideSidebar && (
        <button 
          className="menu-toggle"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
          style={{ position: 'absolute', top: 12, left: 12, zIndex: 600 }}
        >
          <Icon name="menu" size={18} />
        </button>
      )}
      <POS />
    </div>
  );
}

// ── Main App Component ────────────────────────────────────
export default function App() {
  // ═══════════════════════════════════════════════════════
  // ✅ ALL HOOKS AT TOP - NO CONDITIONS BEFORE THIS
  // ═══════════════════════════════════════════════════════
  
  const [fullscreen, setFullscreen] = useState(false);
  
  // ✅ ALWAYS start with ProfileSetup (true = show setup)
  const [showSetup, setShowSetup] = useState(true);

  // ✅ Hook: F11 fullscreen only (no profile check!)
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "F11") {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen();
        } else {
          document.exitFullscreen();
        }
      }
    };
    const handleChange = () => setFullscreen(!!document.fullscreenElement);
    window.addEventListener('keydown', handleKey);
    document.addEventListener('fullscreenchange', handleChange);
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.removeEventListener('fullscreenchange', handleChange);
    };
  }, []);

  // ═══════════════════════════════════════════════════════
  // ✅ ALWAYS SHOW PROFILESETUP FIRST (unless user selected)
  // ═══════════════════════════════════════════════════════
  
  if (showSetup) {
    return (
      <>
        {/* Debug button for development - clears localStorage */}
        {process.env.NODE_ENV === 'development' && (
          <button
            onClick={() => {
              localStorage.removeItem('nexus_active_profile');
              localStorage.removeItem('nexus_active_profile_name');
              localStorage.removeItem('nexus_active_profile_color');
              toast.success('Profile storage cleared!');
            }}
            style={{
              position: 'fixed',
              bottom: 16,
              right: 16,
              padding: '8px 14px',
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 11,
              zIndex: 9999
            }}
          >
            🧹 Clear Storage (Dev)
          </button>
        )}
        {/* ✅ ProfileSetup - ALWAYS shown first */}
        <ProfileSetup 
          onProfileSelected={(profileId) => {
            console.log('✅ Profile selected:', profileId);
            // ProfileSetup already saves to localStorage internally
            // Just switch to main app
            setShowSetup(false);
          }} 
        />
      </>
    );
  }

  // ═══════════════════════════════════════════════════════
  // ✅ SHOW MAIN APP AFTER PROFILE IS SELECTED
  // ═══════════════════════════════════════════════════════
  
  return (
    <AppProvider>
      <BrowserRouter>
        <Toaster position="top-right" />
        
        <Routes>
          <Route path="/" element={
            <Layout hideSidebar={fullscreen}>
              <Dashboard />
            </Layout>
          } />
          
          <Route path="/pos" element={<POSLayout hideSidebar={fullscreen} />} />
          
          <Route path="/service-sales" element={
            <Layout hideSidebar={fullscreen}>
              <ServiceSales />
            </Layout>
          } />
          
          <Route path="/products" element={
            <Layout hideSidebar={fullscreen}>
              <Products />
            </Layout>
          } />
          
          <Route path="/services" element={
            <Layout hideSidebar={fullscreen}>
              <Services />
            </Layout>
          } />
          
          <Route path="/transactions" element={
            <Layout hideSidebar={fullscreen}>
              <Transactions />
            </Layout>
          } />
          
          <Route path="/reports" element={
            <Layout hideSidebar={fullscreen}>
              <Reports />
            </Layout>
          } />
          
          <Route path="/profiles" element={
            <Layout hideSidebar={fullscreen}>
              <Profiles />
            </Layout>
          } />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}