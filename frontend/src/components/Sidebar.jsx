// src/components/Sidebar.jsx
import { NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Icon from './Icon';
import { getProfiles } from '../utils/api';

const NAV = [
  { to: '/',             icon: 'dashboard', label: 'Dashboard'     },
  { to: '/pos',          icon: 'pos',       label: 'POS'           },
  { to: '/service-sales',icon: 'wrench',    label: 'Service Sales' },
  { to: '/products',     icon: 'box',       label: 'Products'      },
  { to: '/services',     icon: 'services',  label: 'Services'      },
  { to: '/transactions', icon: 'clock',     label: 'Transactions'  },
  { to: '/reports',      icon: 'chart',     label: 'Reports'       },
];

// ✅ Props add kiye: isOpen, onClose (mobile toggle ke liye)
export default function Sidebar({ isOpen, onClose }) {
  const [dark, setDark] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [showSwitch, setShowSwitch] = useState(false);
  const navigate = useNavigate();

  const activeId    = localStorage.getItem('nexus_active_profile') || 'default';
  const activeName  = localStorage.getItem('nexus_active_profile_name') || 'Nexus Store';
  const activeColor = localStorage.getItem('nexus_active_profile_color') || '#16a34a';

  useEffect(() => {
    getProfiles().then(r => setProfiles(r.data)).catch(() => {});
  }, []);

  const switchTo = (p) => {
    localStorage.setItem('nexus_active_profile', p.id);
    localStorage.setItem('nexus_active_profile_name', p.storeName || p.name);
    localStorage.setItem('nexus_active_profile_color', p.color);
    setShowSwitch(false);
    window.location.reload();
  };

  const toggleDark = () => {
    setDark(d => {
      document.documentElement.classList.toggle('dark', !d);
      return !d;
    });
  };

  useEffect(() => {
  console.log('🔍 Sidebar props:', { 
    isOpen, 
    onClose: typeof onClose,
    hasActiveClass: isOpen === true ? 'YES' : 'NO'
  });
}, [isOpen, onClose]);

  return (
    <>
      {/* ✅ Mobile Overlay - Sidebar ke bahar click karne par close */}
      {isOpen && window.innerWidth <= 768 && (
  <div 
    className="sidebar-overlay active" 
    onClick={onClose}
    aria-hidden="true"
  />
)}
      
      {/* ✅ Conditional class for mobile slide animation */}
      <div className={`sidebar ${isOpen ? 'active' : ''}`}>
        
        {/* Logo / Active store */}
        <div className="sidebar-logo" style={{ padding: '14px 16px' }}>
          
          {/* ✅ Mobile Close Button (CSS se hide/show hoga) */}
          <button 
  onClick={onClose}
  className="menu-toggle"
  title="Close menu"
  aria-label="Close sidebar"
  style={{ 
    // ✅ Remove 'display: none' - CSS will handle visibility
    position: 'absolute', 
    top: 12, 
    right: 12, 
    background: 'transparent', 
    border: 'none', 
    cursor: 'pointer', 
    color: 'var(--muted)',
    padding: 6,
    zIndex: 1002
    // ❌ Remove: display: 'none'
  }}
>
  <Icon name="x" size={20} />
</button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
            <div style={{ 
              width: 30, height: 30, borderRadius: 8, 
              background: activeColor, 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              flexShrink: 0 
            }}>
              <Icon name="store" size={15} color="#fff" />
            </div>
            <span style={{ 
              fontWeight: 700, fontSize: 14, color: activeColor, 
              flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' 
            }}>
              {activeName}
            </span>
            <button 
              onClick={() => setShowSwitch(s => !s)} 
              title="Switch store"
              style={{ 
                background: 'none', border: 'none', cursor: 'pointer', 
                color: '#94a3b8', padding: 2 
              }}
            >
              <Icon name="profiles" size={14} />
            </button>
          </div>

          {/* Profile switcher dropdown */}
          {showSwitch && (
            <div style={{
              position: 'absolute', left: 210, top: 10, zIndex: 200,
              background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,.12)', minWidth: 220, padding: 8,
            }}>
              <p style={{ 
                fontSize: 10, fontWeight: 700, color: '#94a3b8', 
                textTransform: 'uppercase', padding: '4px 10px 8px', letterSpacing: 0.5 
              }}>Switch Store</p>
              {profiles.map(p => (
                <div key={p.id} onClick={() => switchTo(p)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                    borderRadius: 8, cursor: 'pointer',
                    background: p.id === activeId ? '#f0fdf4' : 'transparent',
                    transition: 'background .12s',
                  }}>
                  <div style={{ 
                    width: 28, height: 28, borderRadius: 7, background: p.color, 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0 
                  }}>
                    {(p.storeName || p.name)[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      fontWeight: 600, fontSize: 13, 
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' 
                    }}>{p.storeName || p.name}</div>
                    {p.linkedTo && <div style={{ fontSize: 10, color: '#16a34a' }}>🔗 Linked</div>}
                  </div>
                  {p.id === activeId && <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 700 }}>●</span>}
                </div>
              ))}
              <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 6, paddingTop: 6 }}>
                <div onClick={() => { setShowSwitch(false); navigate('/profiles'); }}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', 
                    borderRadius: 8, cursor: 'pointer', color: '#64748b', fontSize: 13, 
                    transition: 'background .12s' 
                  }}>
                  <Icon name="profiles" size={14} /> Manage Profiles
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          {NAV.map(({ to, icon, label }) => (
            <NavLink 
              key={to} 
              to={to} 
              end={to === '/'}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              // ✅ Mobile par click ke baad sidebar close ho jaye
              onClick={() => onClose?.()}
            >
              <Icon name={icon} size={16} />
              {label}
            </NavLink>
          ))}
          {/* Profiles link */}
          <NavLink 
            to="/profiles" 
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            onClick={() => onClose?.()}
          >
            <Icon name="profiles" size={16} /> Profiles
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <button 
            className="nav-item" 
            onClick={toggleDark} 
            style={{ 
              width: '100%', cursor: 'pointer', background: 'none', 
              border: 'none', fontFamily: 'inherit', textAlign: 'left' 
            }}
          >
            <Icon name={dark ? 'sun' : 'moon'} size={14} />
            Theme
          </button>
        </div>
      </div>
    </>
  );
}