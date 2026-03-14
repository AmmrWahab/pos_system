// src/pages/Profiles.jsx - FINAL FIXED VERSION ✅
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import { getProfiles, createProfile, updateProfile, deleteProfile, linkProfile, unlinkProfile, logoutProfile } from '../utils/api';

const COLORS = ['#16a34a','#2563eb','#dc2626','#9333ea','#f59e0b','#0891b2','#db2777','#65a30d'];
const CURRENCIES = ['USh','USD','EUR','GBP','KES','NGN','GHS','ZAR','Rs'];

// ✅ Helper: Get normalized ID from profile (handles both _id and id)
const getProfileId = (p) => p?.id || p?._id;

export default function Profiles() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [target, setTarget] = useState(null);
  const [form, setForm] = useState({ name: '', storeName: '', currency: 'USh', color: '#16a34a', password: '' });
  const [linkTarget, setLinkTarget] = useState('');
  const [saving, setSaving] = useState(false);
  
  const activeId = localStorage.getItem('nexus_active_profile');

 const load = async () => {
    setLoading(true);
    try {
        const r = await getProfiles();
        // ✅ Ensure data is an array before setting
        const profilesData = Array.isArray(r.data) ? r.data : [];
        setProfiles(profilesData);
    } catch (err) {
        console.error('Failed to load profiles:', err);
        toast.error('Failed to load profiles: ' + (err.response?.data?.error || err.message));
        setProfiles([]);  // ✅ Set empty array instead of null
    } finally {
        setLoading(false);
    }
};

  useEffect(() => { load(); }, []);

  const switchProfile = (p) => {
    const profileId = getProfileId(p);
    localStorage.setItem('nexus_active_profile', profileId);
    localStorage.setItem('nexus_active_profile_name', p.storeName || p.name);
    localStorage.setItem('nexus_active_profile_color', p.color);
    toast.success(`Switched to "${p.name}"`);
    window.location.reload();
  };

  const openCreate = () => {
    setForm({ name: '', storeName: '', currency: 'USh', color: '#16a34a', password: '' });
    setModal('create');
  };

  const openEdit = (p) => {
    setTarget(p);
    setForm({ 
      name: p.name, 
      storeName: p.storeName, 
      currency: p.currency, 
      color: p.color,
      password: '' 
    });
    setModal('edit');
  };

  const openLink = (p) => {
    setTarget(p);
    setLinkTarget(p.linkedTo || '');
    setModal('link');
  };

  const saveCreate = async () => {
    if (!form.name.trim()) return toast.error('Profile name is required');
    if (form.password && form.password.length < 4) return toast.error('Password must be at least 4 characters');
    
    setSaving(true);
    try {
      await createProfile(form);
      toast.success('Profile created!');
      setModal(null); 
      load();
    } catch(e) { 
      toast.error(e.response?.data?.error || e.message); 
    } finally { 
      setSaving(false); 
    }
  };

  // ✅ FIXED: saveEdit with proper ID handling
  const saveEdit = async () => {
    setSaving(true);
    try {
      const profileId = getProfileId(target); // ✅ Use helper
      if (!profileId) throw new Error('Profile ID not found');
      
      const payload = { ...form };
      if (!payload.password || payload.password.trim() === '') {
        delete payload.password;
      }
      
      console.log('✏️ Updating profile:', { profileId, payload });
      await updateProfile(profileId, payload);
      toast.success('Profile updated!');
      setModal(null); 
      load();
    } catch(e) { 
      console.error('❌ Update failed:', e);
      toast.error(e.response?.data?.error || e.message || 'Failed to update'); 
    } finally { 
      setSaving(false); 
    }
  };

  // ✅ FIXED: saveLink with proper ID handling
  const saveLink = async () => {
    setSaving(true);
    try {
      const profileId = getProfileId(target);
      if (!profileId) throw new Error('Profile ID not found');
      
      if (linkTarget) {
        await linkProfile(profileId, linkTarget);
        toast.success('Profile linked! It now uses the selected store\'s database.');
      } else {
        await unlinkProfile(profileId);
        toast.success('Profile unlinked — now uses its own database.');
      }
      setModal(null); 
      load();
    } catch(e) { 
      toast.error(e.response?.data?.error || e.message); 
    } finally { 
      setSaving(false); 
    }
  };

  // ✅ FIXED: Delete with proper ID handling
  const delProfile = async (p) => {
    const profileId = getProfileId(p);
    const profileName = p.storeName || p.name;
    
    if (profileId === 'default') return toast.error('Cannot delete the default profile');
    if (profileId === activeId) return toast.error('Cannot delete the active profile. Switch first.');
    
    if (!confirm(`Delete "${profileName}"? This cannot be undone.`)) return;
    
    try { 
      console.log('🗑 Deleting profile:', profileId);
      await deleteProfile(profileId);
      toast.success('Profile deleted successfully'); 
      load();
    } catch(e) { 
      console.error('❌ Delete error:', e);
      toast.error(e.response?.data?.error || e.message || 'Failed to delete profile'); 
    }
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 className="page-title">Store Profiles</h1>
          <p className="page-sub">Manage multiple stores. Each profile has its own database. Link profiles to share data.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Icon name="plus" size={14} /> New Profile
        </button>
      </div>

      {/* Profile cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {profiles.map(p => {
          const profileId = getProfileId(p);
          const isActive = profileId === activeId;
          const linkedProfile = p.linkedTo ? profiles.find(x => getProfileId(x) === p.linkedTo) : null;
          
          return (
            <div key={profileId} style={{
              background: '#fff', borderRadius: 14, border: `2px solid ${isActive ? p.color : '#e2e8f0'}`,
              padding: '20px', position: 'relative', boxShadow: isActive ? `0 0 0 4px ${p.color}22` : '0 1px 3px rgba(0,0,0,.06)',
              transition: 'all .2s',
            }}>
              {isActive && (
                <span style={{ position: 'absolute', top: 12, right: 12, fontSize: 10, fontWeight: 700, background: p.color, color: '#fff', padding: '2px 8px', borderRadius: 20 }}>
                  ACTIVE
                </span>
              )}

              {/* Avatar + name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 20, flexShrink: 0 }}>
                  {(p.storeName || p.name)[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{p.storeName || p.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{p.name} · {p.currency}</div>
                </div>
              </div>

              {/* Link info */}
              {linkedProfile ? (
                <div style={{ marginBottom: 14, padding: '8px 12px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', fontSize: 12 }}>
                  <span style={{ color: '#16a34a', fontWeight: 600 }}>🔗 Linked to:</span>{' '}
                  <span style={{ color: '#15803d', fontWeight: 700 }}>{linkedProfile.storeName || linkedProfile.name}</span>
                  <span style={{ color: '#64748b' }}> — uses shared database</span>
                </div>
              ) : (
                <div style={{ marginBottom: 14, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, color: '#64748b' }}>
                  🗄 Uses own database
                </div>
              )}

              {/* DB path */}
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.resolvedDb?.split('/').pop() || p.resolvedDb}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {!isActive && (
                  <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => switchProfile(p)}>
                    Switch
                  </button>
                )}
                <button className="btn btn-outline" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => openEdit(p)}>
                  <Icon name="edit" size={12} /> Edit
                </button>
                <button className="btn btn-outline" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => openLink(p)}>
                  <Icon name="link" size={12} /> {p.linkedTo ? 'Relink' : 'Link'}
                </button>
                {profileId !== 'default' && (
                  <button className="icon-btn icon-btn-danger" onClick={() => delProfile(p)} title="Delete">
                    <Icon name="trash" size={14} />
                  </button>
                )}
              </div>

              {/* Logout button for active profile */}
              {isActive && (
                <button 
                  className="icon-btn icon-btn-danger" 
                  onClick={() => {
                    if (confirm('Are you sure you want to logout?')) {
                      logoutProfile();
                    }
                  }} 
                  title="Logout"
                >
                  <Icon name="log-out" size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Create Modal ─────────────────────────────────────────────────── */}
      {modal === 'create' && (
        <Modal title="Create New Profile" onClose={() => setModal(null)}>
          <div className="form-group">
            <label>Profile Name *</label>
            <input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Main Branch" required />
            <small style={{ color: '#64748b', fontSize: 11 }}>This becomes your branch ID</small>
          </div>
          <div className="form-group">
            <label>Store Name (shown on receipts)</label>
            <input value={form.storeName} onChange={e => setForm(f=>({...f,storeName:e.target.value}))} placeholder="e.g. Sadiq Shafiq Superstore" />
          </div>
          <div className="form-group">
            <label>Password *</label>
            <input 
              type="password"
              value={form.password || ''} 
              onChange={e => setForm(f=>({...f, password: e.target.value}))} 
              placeholder="••••••••"
              minLength={4}
              required
            />
            <small style={{ color: '#64748b', fontSize: 11 }}>Minimum 4 characters</small>
          </div>
          <div className="form-row">
            <div>
              <label>Currency</label>
              <select value={form.currency} onChange={e => setForm(f=>({...f,currency:e.target.value}))}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label>Color</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {COLORS.map(c => (
                  <div key={c} onClick={() => setForm(f=>({...f,color:c}))} style={{
                    width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
                    border: form.color === c ? '3px solid #0f172a' : '2px solid transparent',
                    transition: 'transform .1s', transform: form.color === c ? 'scale(1.2)' : 'scale(1)',
                  }} />
                ))}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveCreate} disabled={saving}>{saving ? 'Creating…' : 'Create Profile'}</button>
          </div>
        </Modal>
      )}

      {/* ── Edit Modal ───────────────────────────────────────────────────── */}
      {modal === 'edit' && (
        <Modal title={`Edit: ${target?.name}`} onClose={() => setModal(null)}>
          <div className="form-group">
            <label>Profile Name</label>
            <input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} />
          </div>
          <div className="form-group">
            <label>Store Name</label>
            <input value={form.storeName} onChange={e => setForm(f=>({...f,storeName:e.target.value}))} />
          </div>
          <div className="form-group">
            <label>Password <span style={{color:'#64748b',fontWeight:400}}>(leave blank to keep current)</span></label>
            <input 
              type="password"
              value={form.password || ''} 
              onChange={e => setForm(f=>({...f, password: e.target.value}))} 
              placeholder="•••••••• (optional)"
              minLength={4}
            />
          </div>
          <div className="form-row">
            <div>
              <label>Currency</label>
              <select value={form.currency} onChange={e => setForm(f=>({...f,currency:e.target.value}))}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label>Color</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {COLORS.map(c => (
                  <div key={c} onClick={() => setForm(f=>({...f,color:c}))} style={{
                    width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
                    border: form.color === c ? '3px solid #0f172a' : '2px solid transparent',
                    transform: form.color === c ? 'scale(1.2)' : 'scale(1)',
                  }} />
                ))}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </Modal>
      )}

      {/* ── Link Modal ───────────────────────────────────────────────────── */}
      {modal === 'link' && (
        <Modal title={`Link Profile: ${target?.name}`} onClose={() => setModal(null)}>
          <div style={{ padding: '12px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, marginBottom: 20, fontSize: 13 }}>
            <strong>🔗 How linking works:</strong><br />
            When you link this profile to another, it will use that store's database instead of its own.
            Products, transactions, and inventory are all shared.
          </div>
          <div className="form-group">
            <label>Link "{target?.name}" to:</label>
            <select value={linkTarget} onChange={e => setLinkTarget(e.target.value)}>
              <option value="">— Use own database (unlink) —</option>
              {profiles.filter(p => getProfileId(p) !== getProfileId(target) && !p.linkedTo).map(p => (
                <option key={getProfileId(p)} value={getProfileId(p)}>{p.storeName || p.name}</option>
              ))}
            </select>
          </div>
          {linkTarget && (
            <div style={{ padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, fontSize: 13, color: '#166534', border: '1px solid #bbf7d0' }}>
              ✓ <strong>{target?.name}</strong> will share the database of <strong>{profiles.find(p=>getProfileId(p)===linkTarget)?.storeName}</strong>
            </div>
          )}
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveLink} disabled={saving}>{saving ? 'Saving…' : 'Confirm Link'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}