// src/pages/Products.jsx
import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import { getProducts, createProduct, updateProduct, deleteProduct } from '../utils/api';
import { fmt } from '../utils/format';
import { cacheProducts, getCachedProducts } from '../utils/offlineDB';

const EMPTY_FORM = { name: '', sku: '', barcode: '', category: 'Other', cost: '', price: '', stock: '' };
const CATEGORIES = ['Electronics', 'Clothing', 'Food', 'Home', 'Other'];

// ── Barcode Display Component ─────────────────────────────────────
function BarcodeDisplay({ value }) {
  const svgRef = useRef(null);
  
  useEffect(() => {
    if (!value || !svgRef.current) return;
    
    if (window.JsBarcode) {
      try { 
        window.JsBarcode(svgRef.current, value, { 
          format: 'CODE128', 
          width: 1.5, 
          height: 50, 
          displayValue: true, 
          fontSize: 12 
        }); 
      } catch {}
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js';
    script.onload = () => {
      try { 
        window.JsBarcode(svgRef.current, value, { 
          format: 'CODE128', 
          width: 1.5, 
          height: 50, 
          displayValue: true, 
          fontSize: 12 
        }); 
      } catch {}
    };
    document.head.appendChild(script);
  }, [value]);

  if (!value) return null;
  
  return (
    <div style={{ 
      textAlign: 'center', 
      padding: '12px', 
      background: '#fff', 
      border: '1px solid #e2e8f0', 
      borderRadius: 8, 
      marginTop: 8,
      overflowX: 'auto'  // ✅ Mobile: Allow barcode scroll if needed
    }}>
      <svg ref={svgRef} style={{ maxWidth: '100%', height: 'auto' }} />
    </div>
  );
}

// ── Barcode Input Component ───────────────────────────────────────
function BarcodeInput({ value, onChange }) {
  const inputRef = useRef(null);

  const generateBarcode = () => {
    const code = '200' + Date.now().toString().slice(-10);
    onChange(code);
    toast.success('Barcode generated!');
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}> {/* ✅ Mobile: Wrap on small screens */}
        <input
          ref={inputRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Scan or type barcode…"
          style={{ flex: 1, minWidth: 0 }}  // ✅ Mobile: Prevent overflow
          onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
        />
        <button 
          type="button" 
          title="Auto-generate barcode" 
          onClick={generateBarcode}
          className="btn btn-outline btn-sm"  // ✅ Use existing button styles
          style={{ whiteSpace: 'nowrap' }}
        >
          Generate
        </button>
      </div>
      <BarcodeDisplay value={value} />
    </div>
  );
}

// ── Main Products Component ───────────────────────────────────────
export default function Products() {
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [barcodeView, setBarcodeView] = useState(null);

  // ✅ Custom state for products (replaces useFetch)
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await getProducts({ search });
        const productList = res.data || res;
        setProducts(productList);
        if (navigator.onLine) {
          await cacheProducts(productList);
        }
      } catch (error) {
        const cached = await getCachedProducts();
        setProducts(cached);
        toast.error('Using cached products (offline)');
      } finally {
        setLoading(false);
      }
    };
    loadProducts();
  }, [search]);

  // ✅ Custom refetch function
  const refetch = async () => {
    setLoading(true);
    try {
      const res = await getProducts({ search });
      const productList = res.data || res;
      setProducts(productList);
      if (navigator.onLine) {
        await cacheProducts(productList);
      }
    } catch (error) {
      const cached = await getCachedProducts();
      setProducts(cached);
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => { setForm(EMPTY_FORM); setModal('add'); };
  
  const openEdit = (p) => { 
    setForm({ 
      ...p, 
      cost: String(p.cost || 0), 
      price: String(p.price), 
      stock: String(p.stock), 
      barcode: p.barcode || '',
      _id: p._id
    }); 
    setModal(p); 
  };
  
  const close = () => setModal(null);
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name || !form.sku || !form.price) {
      return toast.error('Fill in all required fields');
    }
    setSaving(true);

    try {
      const payload = {
        name: form.name, 
        sku: form.sku,
        barcode: form.barcode || null,
        category: form.category,
        cost: Number(form.cost) || 0, 
        price: Number(form.price), 
        stock: Number(form.stock) || 0,
      };
      
      if (modal === 'add') { 
        await createProduct(payload); 
        toast.success('Product added!'); 
      } else { 
        const productId = modal._id || modal.id;
        if (!productId) return toast.error('Product ID missing');
        await updateProduct(productId, payload); 
        toast.success('Product updated!'); 
      }
      close(); 
      refetch();
    } catch (e) { 
      toast.error(e.response?.data?.error || e.message); 
    } finally { 
      setSaving(false); 
    }
  };

  const del = async (p) => {
    if (!confirm(`Delete "${p.name}"?`)) return;
    try { 
      const productId = p._id || p.id;
      if (!productId) return toast.error('Product ID missing');
      await deleteProduct(productId); 
      toast.success('Product deleted'); 
      refetch(); 
    } catch (e) { 
      toast.error(e.response?.data?.error || e.message); 
    }
  };

  const margin = (cost, price) => {
    if (!cost || !price || price === 0) return null;
    return (((price - cost) / price) * 100).toFixed(1);
  };

  const printBarcode = (p) => {
    if (!p.barcode) return toast.error('No barcode for this product');
    const html = `<!DOCTYPE html><html><head><title>Barcode - ${p.name}</title>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      </head><body style="text-align:center;font-family:sans-serif;padding:16px;margin:0;">
      <h3 style="margin:0 0 8px;font-size:16px">${p.name}</h3>
      <p style="margin:0 0 12px;color:#666;font-size:11px">${p.sku}</p>
      <div style="overflow-x:auto;padding:8px 0"><svg id="bc"></svg></div>
      <p style="margin:12px 0 0;font-weight:bold;font-size:14px">Price: ${fmt(p.price)}</p>
      <script>JsBarcode('#bc','${p.barcode}',{format:'CODE128',width:2,height:50,displayValue:true,fontSize:12})<\/script>
      </body></html>`;
    const w = window.open('', '_blank'); 
    w.document.write(html); 
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

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
          <h1 className="page-title">Products</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>Manage your product inventory.</p>
        </div>
        <button className="btn btn-primary btn-full-mobile" onClick={openAdd}>
          <Icon name="plus" size={14} /> Add Product
        </button>
      </div>

      {/* ── Products Table Card ───────────────────────────────────── */}
      <div className="card">
        <h2 className="card-title card-title-center">Inventory</h2>
        
        {/* Search Input */}
        <div className="input-wrap" style={{ marginBottom: 18 }}>
          <span className="input-icon"><Icon name="search" size={14} /></span>
          <input 
            className="input-padded" 
            placeholder="Search by name, SKU or barcode..." 
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
                  {['Product', 'SKU', 'Barcode', 'Category', 'Cost', 'Price', 'Margin', 'Stock', 'Actions'].map(h => (
                    <th key={h} className="mobile-hide-margin">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(products || []).map(p => {
                  const m = margin(p.cost, p.price);
                  return (
                    <tr key={p._id || p.id}>
                      <td><strong style={{ fontSize: '13px' }}>{p.name}</strong></td>
                      <td style={{ fontSize: 11, color: '#64748b' }}>{p.sku}</td>
                      <td>
                        {p.barcode ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#0f172a' }}>{p.barcode}</span>
                            <button onClick={() => setBarcodeView(p)} title="View barcode"
                              className="icon-btn" style={{ padding: 2 }}>
                              <Icon name="eye" size={12} />
                            </button>
                            <button onClick={() => printBarcode(p)} title="Print barcode"
                              className="icon-btn" style={{ padding: 2 }}>
                              <Icon name="print" size={12} />
                            </button>
                          </div>
                        ) : <span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span>}
                      </td>
                      <td><span className="badge badge-green" style={{ fontSize: 11 }}>{p.category}</span></td>
                      <td style={{ color: '#64748b', fontSize: 13 }}>{p.cost ? fmt(p.cost) : '—'}</td>
                      <td><strong style={{ fontSize: 13 }}>{fmt(p.price)}</strong></td>
                      <td>
                        {m ? (
                          <span style={{ 
                            fontSize: 11, 
                            fontWeight: 600, 
                            color: Number(m) >= 30 ? '#16a34a' : Number(m) >= 10 ? '#f59e0b' : '#ef4444' 
                          }}>
                            {m}%
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        <span style={{ 
                          color: p.stock <= 5 ? '#ef4444' : '#0f172a', 
                          fontWeight: p.stock <= 5 ? 700 : 400,
                          fontSize: 12
                        }}>
                          {p.stock}{p.stock <= 5 ? '⚠' : ''}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 2 }}>
                          <button className="icon-btn" onClick={() => openEdit(p)} title="Edit">
                            <Icon name="edit" size={14} />
                          </button>
                          <button className="icon-btn icon-btn-danger" onClick={() => del(p)} title="Delete">
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!(products || []).length && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', color: '#64748b', padding: 30, fontSize: 13 }}>
                      No products found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Barcode View Modal ────────────────────────────────────── */}
      {barcodeView && (
        <Modal 
          title={`Barcode — ${barcodeView.name}`} 
          onClose={() => setBarcodeView(null)}
          width={400}  // ✅ Mobile: Better sizing
        >
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>
              SKU: {barcodeView.sku} · {fmt(barcodeView.price)}
            </p>
            <BarcodeDisplay value={barcodeView.barcode} />
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline btn-full-mobile" onClick={() => setBarcodeView(null)}>
              Close
            </button>
            <button className="btn btn-primary btn-full-mobile" onClick={() => printBarcode(barcodeView)}>
              <Icon name="print" size={13} /> Print Barcode
            </button>
          </div>
        </Modal>
      )}

      {/* ── Add / Edit Modal ──────────────────────────────────────── */}
      {modal && (
        <Modal 
          title={modal === 'add' ? 'Add New Product' : 'Edit Product'} 
          onClose={close}
          width={480}  // ✅ Mobile: Better sizing
        >
          <div className="form-group">
            <label>Product Name *</label>
            <input 
              value={form.name} 
              onChange={e => setField('name', e.target.value)} 
              placeholder="e.g. Wireless Mouse" 
            />
          </div>
          
          <div className="form-row">
            <div>
              <label>SKU *</label>
              <input 
                value={form.sku} 
                onChange={e => setField('sku', e.target.value)} 
                placeholder="e.g. ELEC-001" 
              />
            </div>
            <div>
              <label>Category</label>
              <select 
                value={form.category} 
                onChange={e => setField('category', e.target.value)}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          
          <div className="form-group">
            <label>Barcode (scan or type)</label>
            <BarcodeInput value={form.barcode} onChange={v => setField('barcode', v)} />
          </div>
          
          <div className="form-row">
            <div>
              <label>Cost ($)</label>
              <input 
                type="number" 
                value={form.cost} 
                onChange={e => setField('cost', e.target.value)} 
                placeholder="0" 
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label>Price ($) *</label>
              <input 
                type="number" 
                value={form.price} 
                onChange={e => setField('price', e.target.value)} 
                placeholder="0" 
                min="0"
                step="0.01"
              />
            </div>
          </div>
          
          {form.cost && form.price && (
            <div style={{ 
              marginBottom: 14, 
              padding: '8px 12px', 
              background: '#dcfce7', 
              borderRadius: 8, 
              fontSize: 11,  // ✅ Mobile: Smaller text
              color: '#16a34a', 
              fontWeight: 600 
            }}>
              Margin: {margin(Number(form.cost), Number(form.price))}% · Profit: {fmt(Number(form.price) - Number(form.cost))}/unit
            </div>
          )}
          
          <div className="form-group">
            <label>Stock</label>
            <input 
              type="number" 
              value={form.stock} 
              onChange={e => setField('stock', e.target.value)} 
              placeholder="0" 
              min="0"
            />
          </div>
          
          <div className="modal-footer">
            <button className="btn btn-outline btn-full-mobile" onClick={close}>
              Cancel
            </button>
            <button 
              className="btn btn-primary btn-full-mobile" 
              onClick={save} 
              disabled={saving}
            >
              {saving ? 'Saving…' : modal === 'add' ? 'Create Product' : 'Save Changes'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}