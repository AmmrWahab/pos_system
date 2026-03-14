// src/pages/Transactions.jsx
import { useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import { useFetch } from '../hooks/useApi';
import { getTransactions, updateTransaction, deleteTransaction } from '../utils/api';
import { fmt, fmtDate } from '../utils/format';

const PAYMENT_OPTIONS = ['Cash', 'Mobile Money', 'Card'];
const TYPE_OPTIONS    = ['Product', 'Service'];

export default function Transactions() {
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data: txs, loading, refetch } = useFetch(
    () => getTransactions({ search }),
    [search],
  );

  // ── Open edit modal ──────────────────────────────────────────────────────────
  const openEdit = (t) => {
    setEditing(t);
    setEditForm({
      payment: t.payment,
      type: t.type,
      items: t.items.map(i => ({ ...i, qty: String(i.qty), price: String(i.price) })),
    });
  };

  // ── Item field helpers ───────────────────────────────────────────────────────
  const setItemField = (idx, key, val) => {
    setEditForm(f => ({
      ...f,
      items: f.items.map((it, i) => i === idx ? { ...it, [key]: val } : it),
    }));
  };

  const addItem = () => {
    setEditForm(f => ({
      ...f,
      items: [...f.items, { name: '', qty: '1', price: '0', productId: null, serviceId: null }],
    }));
  };

  const removeItem = (idx) => {
    setEditForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  };

  // ── Save edits ───────────────────────────────────────────────────────────────
  const saveEdit = async () => {
    if (!editForm.items.length) return toast.error('At least one item is required');
    for (const it of editForm.items) {
      if (!it.name.trim()) return toast.error('All items must have a name');
      if (Number(it.qty) < 1) return toast.error('Quantity must be at least 1');
    }
    setSaving(true);
    try {
      await updateTransaction(editing.id, {
        payment: editForm.payment,
        type: editForm.type,
        items: editForm.items.map(i => ({
          productId: i.productId || null,
          serviceId: i.serviceId || null,
          name: i.name,
          qty: Number(i.qty),
          price: Number(i.price),
        })),
      });
      toast.success('Transaction updated!');
      setEditing(null);
      refetch();
    } catch (e) {
      toast.error(e.response?.data?.error || e.message);
    } finally { setSaving(false); }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const del = async (t) => {
    if (!confirm(`Delete transaction ${t.id}?`)) return;
    try { 
      await deleteTransaction(t.id); 
      toast.success('Deleted'); 
      refetch(); 
    } catch (e) { 
      toast.error(e.response?.data?.error || e.message); 
    }
  };

  // Computed total for edit form
  const editTotal = editForm
    ? editForm.items.reduce((s, i) => s + Number(i.price) * Number(i.qty), 0)
    : 0;

  return (
    <div className="page-container">
      {/* ── Page Header ───────────────────────────────────────────── */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start', 
        marginBottom: 28,
        gap: 12,
        flexWrap: 'wrap'  // ✅ Mobile: Allow wrapping
      }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 className="page-title">Transactions</h1>
          <p className="page-sub">View and manage past sales.</p>
        </div>
      </div>

      {/* ── Transactions Table Card ───────────────────────────────── */}
      <div className="card">
        <h2 className="card-title card-title-center">Transaction History</h2>
        
        {/* Search Input */}
        <div className="input-wrap" style={{ marginBottom: 18 }}>
          <span className="input-icon"><Icon name="search" size={14} /></span>
          <input 
            className="input-padded" 
            placeholder="Search by Transaction ID..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>

        {/* ✅ Table wrapped in .table-container for horizontal scroll */}
        {loading ? <Spinner /> : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  {['ID', 'Date', 'Type', 'Items', 'Total', 'Payment', 'Actions'].map(h => (
                    <th key={h} className="mobile-hide-payment">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(txs || []).map(t => (
                  <tr key={t.id}>
                    <td>
                      <strong style={{ fontFamily: 'monospace', fontSize: 11 }}>{t.id}</strong>
                    </td>
                    <td style={{ fontSize: 12 }}>{fmtDate(t.createdAt)}</td>
                    <td>
                      <span className={`badge ${t.type === 'Service' ? 'badge-purple' : 'badge-green'}`} style={{ fontSize: 11 }}>
                        {t.type}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{t.items.length} items</td>
                    <td><strong style={{ fontSize: 13 }}>{fmt(t.total)}</strong></td>
                    <td>
                      <span className="badge badge-gray" style={{ fontSize: 11 }}>{t.payment}</span>
                    </td>
                    <td style={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                      {/* View */}
                      <button 
                        className="icon-btn" 
                        title="View"
                        onClick={() => setViewing(t)}
                        style={{ padding: 4 }}
                      >
                        <Icon name="eye" size={13} />
                      </button>
                      {/* Edit */}
                      <button 
                        className="icon-btn" 
                        title="Edit"
                        onClick={() => openEdit(t)}
                        style={{ padding: 4, color: 'var(--primary)' }}
                      >
                        <Icon name="edit" size={13} color="var(--primary)" />
                      </button>
                      {/* Delete */}
                      <button 
                        className="icon-btn icon-btn-danger" 
                        title="Delete" 
                        onClick={() => del(t)}
                        style={{ padding: 4 }}
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {!(txs || []).length && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 30, fontSize: 13 }}>
                      No transactions found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── View Modal ────────────────────────────────────────────── */}
      {viewing && (
        <Modal 
          title={`Transaction: ${viewing.id}`} 
          onClose={() => setViewing(null)}
          width={400}  // ✅ Mobile: Better sizing
        >
          <div style={{ 
            display: 'flex', 
            gap: 16, 
            marginBottom: 18,
            flexWrap: 'wrap'  // ✅ Mobile: Wrap on small screens
          }}>
            {[['Date', fmtDate(viewing.createdAt)], ['Payment', viewing.payment], ['Type', viewing.type]].map(([l, v]) => (
              <div key={l} style={{ minWidth: 100 }}>
                <span style={{ color: 'var(--muted)', fontSize: 11 }}>{l}</span><br />
                <strong style={{ fontSize: 13 }}>{v}</strong>
              </div>
            ))}
          </div>
          
          {/* ✅ Items table wrapped for scroll */}
          <div className="table-container" style={{ margin: '0 -20px', padding: '0 20px' }}>
            <table style={{ minWidth: 400 }}>
              <thead>
                <tr>{['Item', 'Qty', 'Unit Price', 'Subtotal'].map(h => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {viewing.items.map((it, i) => (
                  <tr key={it._id || it.productId || `${it.name}-${i}`}>
                    <td style={{ fontSize: 13 }}>{it.name}</td>
                    <td style={{ fontSize: 12 }}>{it.qty}</td>
                    <td style={{ fontSize: 12 }}>{fmt(it.price)}</td>
                    <td style={{ fontSize: 13, fontWeight: 600 }}>{fmt(it.price * it.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div style={{ 
            borderTop: '1px solid var(--border)', 
            paddingTop: 14, 
            marginTop: 14, 
            display: 'flex', 
            justifyContent: 'space-between', 
            fontWeight: 700, 
            fontSize: 14  // ✅ Mobile: Slightly smaller
          }}>
            <span>Total</span>
            <span style={{ color: 'var(--primary)' }}>{fmt(viewing.total)}</span>
          </div>
          
          <div className="modal-footer">
            <button className="btn btn-outline btn-full-mobile" onClick={() => setViewing(null)}>
              Close
            </button>
            <button 
              className="btn btn-primary btn-full-mobile" 
              onClick={() => { setViewing(null); openEdit(viewing); }}
            >
              <Icon name="edit" size={13} /> Edit This Transaction
            </button>
          </div>
        </Modal>
      )}

      {/* ── Edit Modal ────────────────────────────────────────────── */}
      {editing && editForm && (
        <Modal 
          title={`Edit Transaction: ${editing.id}`} 
          onClose={() => setEditing(null)} 
          width={560}
        >
          {/* Meta fields - stacked on mobile */}
          <div className="form-row" style={{ marginBottom: 18 }}>
            <div>
              <label>Payment Method</label>
              <select 
                value={editForm.payment} 
                onChange={e => setEditForm(f => ({ ...f, payment: e.target.value }))}
              >
                {PAYMENT_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label>Transaction Type</label>
              <select 
                value={editForm.type} 
                onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}
              >
                {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Items editor header */}
          <div style={{ 
            marginBottom: 8, 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            flexWrap: 'wrap',  // ✅ Mobile: Wrap button
            gap: 8
          }}>
            <label style={{ margin: 0, fontSize: 13 }}>Items</label>
            <button 
              className="btn btn-sm btn-outline btn-full-mobile" 
              onClick={addItem}
              style={{ width: 'auto', minWidth: 120 }}
            >
              <Icon name="plus" size={12} /> Add Item
            </button>
          </div>

          {/* ✅ Items list wrapped for horizontal scroll on mobile */}
          <div className="table-container" style={{ 
            border: '1px solid var(--border)', 
            borderRadius: 10, 
            overflow: 'hidden', 
            marginBottom: 16,
            margin: '0 -16px',  // ✅ Full width touch area on mobile
            padding: '0 16px'
          }}>
            {/* Header row - hidden on very small screens, use compact view instead */}
            <div className="items-header" style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 60px 90px 32px', 
              gap: 8, 
              padding: '8px 12px', 
              background: 'var(--bg)', 
              fontSize: 10, 
              fontWeight: 600, 
              color: 'var(--muted)', 
              textTransform: 'uppercase', 
              letterSpacing: 0.5 
            }}>
              <span>Name</span><span>Qty</span><span>Price</span><span></span>
            </div>

            {editForm.items.map((item, idx) => (
              <div 
                key={idx} 
                className="items-row"
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 60px 90px 32px', 
                  gap: 8, 
                  padding: '8px 12px', 
                  borderTop: '1px solid var(--border)', 
                  alignItems: 'center' 
                }}
              >
                <input
                  value={item.name}
                  onChange={e => setItemField(idx, 'name', e.target.value)}
                  placeholder="Item name"
                  style={{ 
                    padding: '6px 10px', 
                    border: '1px solid var(--border)', 
                    borderRadius: 6, 
                    fontSize: 12,  // ✅ Mobile: Smaller
                    fontFamily: 'inherit',
                    minWidth: 0  // ✅ Prevent overflow
                  }}
                />
                <input
                  type="number" 
                  min="1"
                  value={item.qty}
                  onChange={e => setItemField(idx, 'qty', e.target.value)}
                  style={{ 
                    padding: '6px 8px', 
                    border: '1px solid var(--border)', 
                    borderRadius: 6, 
                    fontSize: 12, 
                    fontFamily: 'inherit', 
                    textAlign: 'center' 
                  }}
                />
                <input
                  type="number" 
                  min="0" 
                  step="0.01"
                  value={item.price}
                  onChange={e => setItemField(idx, 'price', e.target.value)}
                  style={{ 
                    padding: '6px 8px', 
                    border: '1px solid var(--border)', 
                    borderRadius: 6, 
                    fontSize: 12, 
                    fontFamily: 'inherit' 
                  }}
                />
                <button
                  onClick={() => removeItem(idx)}
                  disabled={editForm.items.length === 1}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    cursor: editForm.items.length === 1 ? 'not-allowed' : 'pointer', 
                    color: 'var(--danger)', 
                    opacity: editForm.items.length === 1 ? 0.3 : 1, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    padding: 4
                  }}
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* New total preview */}
          <div style={{ 
            background: 'var(--primary-light)', 
            borderRadius: 10, 
            padding: '12px 16px', 
            marginBottom: 20, 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center' 
          }}>
            <span style={{ fontWeight: 600, color: 'var(--primary)', fontSize: 13 }}>New Total</span>
            <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--primary)' }}>{fmt(editTotal)}</span>
          </div>

          <div className="modal-footer" style={{ marginTop: 0 }}>
            <button className="btn btn-outline btn-full-mobile" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button 
              className="btn btn-primary btn-full-mobile" 
              onClick={saveEdit} 
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}