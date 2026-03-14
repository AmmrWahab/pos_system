// src/pages/ProfileSetup.jsx - FIXED VERSION ✅
import { useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '../components/Icon';
import Spinner from '../components/Spinner';
import { getProfiles, createProfile, verifyProfilePassword } from '../utils/api';

const COLORS = ['#16a34a','#2563eb','#dc2626','#9333ea','#f59e0b','#0891b2','#db2777','#65a30d'];
const CURRENCIES = ['USh','USD','EUR','GBP','KES','NGN','GHS','ZAR','Rs'];

// ✅ Helper: Normalize profile ID (MongoDB _id vs frontend id)
const getProfileId = (p) => p.id || p._id;

export default function ProfileSetup({ onProfileSelected }) {
  const [step, setStep] = useState('choice');
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  
  const [createForm, setCreateForm] = useState({
    name: '', storeName: '', currency: 'USh', color: '#16a34a', password: ''
  });
  
  const [verifyForm, setVerifyForm] = useState({ password: '' });

  // ✅ In handleUseExisting function
const loadProfiles = async () => {
    try {
        setLoading(true);
        const res = await getProfiles();
        // ✅ Ensure array
        const profilesData = Array.isArray(res.data) ? res.data : [];
        setProfiles(profilesData);
    } catch (err) {
        console.error('Load profiles error:', err);
        toast.error('Failed to load profiles');
        setProfiles([]);
    } finally {
        setLoading(false);
    }
};

  const handleUseExisting = async () => {
    await loadProfiles();
    setStep('select');
  };

  const handleProfileSelect = (profile) => {
    setSelectedProfile(profile);
    setVerifyForm({ password: '' });
    setStep('verify');
  };

  // src/pages/ProfileSetup.jsx - handleCreateSubmit
const handleCreateSubmit = async (e) => {
  e.preventDefault();
  if (!createForm.name.trim()) return toast.error('Profile name is required');
  if (createForm.password.length < 4) return toast.error('Password must be at least 4 characters');
  
  setLoading(true);
  try {
    const branchId = createForm.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    const payload = {
      ...createForm,
      branchId,
    };
    
    const response = await createProfile(payload);
    
    // ✅ CRITICAL: Save to localStorage IMMEDIATELY after creation
    const profileId = response.data?._id || response.data?.id;
    localStorage.setItem('nexus_active_profile', profileId);
    localStorage.setItem('nexus_active_profile_name', createForm.storeName || createForm.name);
    localStorage.setItem('nexus_active_profile_color', createForm.color);
    
    toast.success('Profile created successfully!');
    
    // ✅ CRITICAL: Call onProfileSelected to trigger App.jsx state change
    onProfileSelected?.(profileId);
    
  } catch (err) {
    console.error('Create profile error:', err);
    toast.error(err.response?.data?.error || err.message || 'Creation failed');
  } finally {
    setLoading(false);
  }
};

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    if (!selectedProfile || !verifyForm.password) return toast.error('Please enter password');
    
    setLoading(true);
    try {
      // ✅ Use normalized ID for verification
      const profileId = getProfileId(selectedProfile);
      const res = await verifyProfilePassword(profileId, verifyForm.password);
      
      if (res.data?.valid) {
        // ✅ Save active profile with normalized ID
        localStorage.setItem('nexus_active_profile', profileId);
        localStorage.setItem('nexus_active_profile_name', selectedProfile.storeName || selectedProfile.name);
        localStorage.setItem('nexus_active_profile_color', selectedProfile.color);
        
        toast.success(`Welcome back to ${selectedProfile.name}!`);
        onProfileSelected?.(profileId);
      } else {
        toast.error('Incorrect password');
      }
    } catch (err) {
      console.error('Verify password error:', err);
      toast.error(err.response?.data?.error || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Render: Choice ─────────────────────────────
  if (step === 'choice') {
    return (
      <div className="auth-wrapper" style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: 20
      }}>
        <div style={{
          background: '#fff', borderRadius: 20, padding: '40px', maxWidth: 500, width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)', textAlign: 'center'
        }}>
          <div style={{ marginBottom: 30 }}>
            <div style={{
              width: 70, height: 70, borderRadius: '50%', background: 'var(--primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
              color: '#fff', fontSize: 28, fontWeight: 800
            }}>N</div>
            <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Welcome to Nexus POS</h1>
            <p style={{ color: '#64748b', fontSize: 14 }}>Select how you'd like to get started</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <button className="btn btn-primary" onClick={() => setStep('create')}
              style={{ padding: '16px', fontSize: 15, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Icon name="plus" size={18} /> Create New Profile
            </button>
            <button className="btn btn-outline" onClick={handleUseExisting}
              style={{ padding: '16px', fontSize: 15, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Icon name="users" size={18} /> Use Existing Profile
            </button>
          </div>

          <p style={{ marginTop: 24, fontSize: 12, color: '#94a3b8' }}>
            Each profile has its own secure database. You can link profiles later to share data.
          </p>
        </div>
      </div>
    );
  }

  // ── Render: Create Form ───────────────────────
  if (step === 'create') {
    return (
      <div className="auth-wrapper" style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: 20
      }}>
        <form onSubmit={handleCreateSubmit} style={{
          background: '#fff', borderRadius: 20, padding: '30px', maxWidth: 480, width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <button type="button" className="icon-btn" onClick={() => setStep('choice')}>
              <Icon name="arrow-left" />
            </button>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>Create New Profile</h2>
          </div>

          <div className="form-group">
            <label>Profile Name *</label>
            <input value={createForm.name} onChange={e => setCreateForm(f=>({...f, name: e.target.value}))} 
              placeholder="e.g. Main Branch" required />
            <small style={{ color: '#64748b', fontSize: 11 }}>This will be used as your branch ID</small>
          </div>

          <div className="form-group">
            <label>Store Name (for receipts)</label>
            <input value={createForm.storeName} onChange={e => setCreateForm(f=>({...f, storeName: e.target.value}))} 
              placeholder="e.g. Sadiq Superstore" />
          </div>

          <div className="form-group">
            <label>Password *</label>
            <input type="password" value={createForm.password} 
              onChange={e => setCreateForm(f=>({...f, password: e.target.value}))} 
              placeholder="••••••••" minLength={4} required />
            <small style={{ color: '#64748b', fontSize: 11 }}>Minimum 4 characters</small>
          </div>

          <div className="form-row">
            <div>
              <label>Currency</label>
              <select value={createForm.currency} onChange={e => setCreateForm(f=>({...f, currency: e.target.value}))}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label>Color</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {COLORS.map(c => (
                  <div key={c} onClick={() => setCreateForm(f=>({...f, color: c}))} style={{
                    width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
                    border: createForm.color === c ? '3px solid #0f172a' : '2px solid transparent',
                    transition: 'transform .1s', transform: createForm.color === c ? 'scale(1.2)' : 'scale(1)',
                  }} />
                ))}
              </div>
            </div>
          </div>

          <div className="modal-footer" style={{ marginTop: 24 }}>
            <button type="button" className="btn btn-outline" onClick={() => setStep('choice')}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <Spinner size={16} /> : 'Create Profile'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ── Render: Select Existing ──────────────────
  if (step === 'select') {
    return (
      <div className="auth-wrapper" style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: 20
      }}>
        <div style={{
          background: '#fff', borderRadius: 20, padding: '30px', maxWidth: 520, width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <button type="button" className="icon-btn" onClick={() => setStep('choice')}>
              <Icon name="arrow-left" />
            </button>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>Select Profile</h2>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Spinner /></div>
          ) : profiles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 20px', color: '#64748b' }}>
              <Icon name="inbox" size={32} style={{ marginBottom: 12 }} />
              <p>No profiles found.</p>
              <button className="btn btn-primary" onClick={() => setStep('create')} style={{ marginTop: 12 }}>
                Create One Now
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 400, overflowY: 'auto' }}>
              {profiles.map(p => {
                // ✅ FIXED: Use normalized ID for key
                const profileId = getProfileId(p);
                return (
                  <button
                    key={profileId}  // ✅ Unique key using _id or id
                    onClick={() => handleProfileSelect(p)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                      border: '2px solid #e2e8f0', borderRadius: 12, background: '#fff',
                      cursor: 'pointer', transition: 'all .15s', textAlign: 'left',
                    }}
                  >
                    <div style={{
                      width: 44, height: 44, borderRadius: 10, background: p.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 700, fontSize: 18, flexShrink: 0
                    }}>
                      {(p.storeName || p.name)[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{p.storeName || p.name}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{p.name} · {p.currency}</div>
                    </div>
                    <Icon name="arrow-right" size={16} color="#94a3b8" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Render: Password Verify ──────────────────
  if (step === 'verify' && selectedProfile) {
    return (
      <div className="auth-wrapper" style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: 20
      }}>
        <form onSubmit={handleVerifySubmit} style={{
          background: '#fff', borderRadius: 20, padding: '30px', maxWidth: 420, width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)', textAlign: 'center'
        }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{
              width: 60, height: 60, borderRadius: '50%', background: selectedProfile.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
              color: '#fff', fontWeight: 800, fontSize: 22
            }}>
              {(selectedProfile.storeName || selectedProfile.name)[0].toUpperCase()}
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
              {selectedProfile.storeName || selectedProfile.name}
            </h2>
            <p style={{ color: '#64748b', fontSize: 13 }}>Enter password to continue</p>
          </div>

          <div className="form-group" style={{ textAlign: 'left', marginBottom: 24 }}>
            <label>Password</label>
            <input type="password" value={verifyForm.password} 
              onChange={e => setVerifyForm(f=>({...f, password: e.target.value}))} 
              placeholder="••••••••" autoFocus required
              style={{ fontSize: 16, padding: '12px 14px' }}
            />
          </div>

          <div className="modal-footer" style={{ justifyContent: 'center', gap: 12 }}>
            <button type="button" className="btn btn-outline" onClick={() => setStep('select')}>
              <Icon name="arrow-left" size={14} /> Back
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ minWidth: 140 }}>
              {loading ? <Spinner size={16} /> : 'Unlock'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return null;
}