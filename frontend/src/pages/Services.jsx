// src/pages/Services.jsx
import { useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import { useFetch } from '../hooks/useApi';
import { getServices, createService, updateService, deleteService } from '../utils/api';
import { fmt } from '../utils/format';

const EMPTY = { name: '', sku: '', category: 'Repair', price: '' };

export default function Services() {
  const [modal,  setModal]  = useState(null);
  const [form,   setForm]   = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const { data: services, loading, refetch } = useFetch(getServices, []);

  const openAdd  = () => { setForm(EMPTY); setModal('add'); };
  const openEdit = (s) => { setForm({ ...s, price: String(s.price) }); setModal(s); };
  const close    = () => setModal(null);
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name || !form.sku || !form.price) return toast.error('Fill all required fields');
    setSaving(true);
    try {
      if (modal === 'add') {
        await createService({ ...form, price: Number(form.price) });
        toast.success('Service added!');
      } else {
        await updateService(modal.id, { ...form, price: Number(form.price) });
        toast.success('Service updated!');
      }
      close(); refetch();
    } catch (e) { toast.error(e.response?.data?.error || e.message); }
    finally { setSaving(false); }
  };

  const del = async (s) => {
    if (!confirm(`Delete "${s.name}"?`)) return;
    try { await deleteService(s.id); toast.success('Deleted'); refetch(); }
    catch (e) { toast.error(e.response?.data?.error || e.message); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 className="page-title">Services</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>Manage your service offerings.</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Icon name="plus" size={14} /> Add Service</button>
      </div>

      <div className="card">
        {loading ? <Spinner /> : (
          <table>
            <thead><tr>{['Service', 'SKU', 'Category', 'Price', 'Actions'].map(h => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {(services || []).map(s => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.sku}</td>
                  <td><span className="badge badge-purple">{s.category}</span></td>
                  <td>{fmt(s.price)}</td>
                  <td>
                    <button className="icon-btn" onClick={() => openEdit(s)}><Icon name="edit" /></button>
                    <button className="icon-btn icon-btn-danger" onClick={() => del(s)}><Icon name="trash" /></button>
                  </td>
                </tr>
              ))}
              {!(services || []).length && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 30 }}>No services found</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <Modal title={modal === 'add' ? 'Add Service' : 'Edit Service'} onClose={close}>
          <div className="form-row">
            <div><label>Name *</label><input value={form.name} onChange={e => setField('name', e.target.value)} /></div>
            <div><label>SKU *</label><input value={form.sku} onChange={e => setField('sku', e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div><label>Category</label><input value={form.category} onChange={e => setField('category', e.target.value)} /></div>
            <div><label>Price (USh) *</label><input type="number" value={form.price} onChange={e => setField('price', e.target.value)} /></div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={close}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
