// src/pages/POS.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import Icon from '../components/Icon';
import Spinner from '../components/Spinner';
import MobileScanner from '../components/MobileScanner'; // ✅ Ensure this import exists
import { getProducts, createTransaction, getProductByBarcode } from '../utils/api';
import { fmt, fmtDate } from '../utils/format';
import { cacheProducts, getCachedProducts} from '../utils/offlineDB';

// ── Offline Sync Imports ──────────────────────────────────
import { useNetwork } from '../hooks/useNetwork';
import { saveTransactionSmart, startAutoSync } from '../services/syncService';

const CATS = ['All', 'Electronics', 'Clothing', 'Food', 'Home', 'Other'];
const PAY_METHODS = [
  { id: 'Cash',         label: 'Cash',   icon: 'dollar' },
  { id: 'Card',         label: 'Card',   icon: 'card'   },
  { id: 'Mobile Money', label: 'Mobile', icon: 'phone'  },
];

/* ── Barcode scanner hook ──────────────────────────────────────────────────── */
function useBarcodeScanner(onScan) {
  useEffect(() => {
    let buffer = '';
    let timer  = null;
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      const isBarcodeInput = document.activeElement?.dataset?.barcode === 'true';
      if ((tag === 'INPUT' || tag === 'TEXTAREA') && !isBarcodeInput) return;
      if (e.key === 'Enter') {
        if (buffer.length >= 3) onScan(buffer.trim());
        buffer = '';
        clearTimeout(timer);
        return;
      }
      if (e.key.length === 1) {
        buffer += e.key;
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (buffer.length >= 3) onScan(buffer.trim());
          buffer = '';
        }, 100);
      }
    };
    window.addEventListener('keydown', handler);
    return () => { window.removeEventListener('keydown', handler); clearTimeout(timer); };
  }, [onScan]);
}

/* ── Payment Modal ─────────────────────────────────────────────────────────── */
function PaymentModal({ total, onConfirm, onClose }) {
  const [method, setMethod] = useState('Cash');
  const [received, setReceived] = useState('');
  const [placing, setPlacing] = useState(false);
  const inputRef = useRef(null);
  
  useEffect(() => { if (method === 'Cash') inputRef.current?.focus(); }, [method]);
  
  const amt = parseFloat(received) || 0;
  const change = Math.max(0, amt - total);
  
  const confirm = async () => {
    if (method === 'Cash' && amt < total) return toast.error('Amount received is less than total');
    setPlacing(true);
    const ok = await onConfirm(method, method === 'Cash' ? amt : total);
    if (!ok) setPlacing(false);
  };
  
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ width: 460 }}>
        <div className="modal-header">
          <span className="modal-title">Complete Payment</span>
          <button className="icon-btn" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Total Amount Due</p>
          <p style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1 }}>{fmt(total)}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
          {PAY_METHODS.map(m => (
            <button key={m.id} onClick={() => setMethod(m.id)} style={{
              padding: '14px 10px', borderRadius: 10, cursor: 'pointer',
              border: '2px solid', borderColor: method === m.id ? 'var(--primary)' : 'var(--border)',
              background: method === m.id ? 'var(--primary-light)' : 'var(--white)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              color: method === m.id ? 'var(--primary)' : 'var(--muted)',
              fontWeight: 600, fontSize: 13, fontFamily: 'inherit', transition: 'all .15s',
            }}>
              <Icon name={m.icon} size={22} />{m.label}
            </button>
          ))}
        </div>
        {method === 'Cash' && (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>Amount Received</label>
              <input ref={inputRef} type="number" step="0.01" placeholder="0.00" value={received}
                onChange={e => setReceived(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && confirm()}
                style={{ border: '2px solid var(--primary)', borderRadius: 8, padding: '10px 12px', fontSize: 16, width: '100%', outline: 'none', fontFamily: 'inherit' }}
              />
              <button onClick={() => setReceived(String(total))} style={{
                marginTop: 8, padding: '4px 14px', borderRadius: 20,
                border: '1px solid var(--primary)', background: 'var(--primary-light)',
                color: 'var(--primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>{fmt(total)}</button>
            </div>
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--muted)' }}>Change Due</span>
              <span style={{ fontWeight: 700, fontSize: 16 }}>{fmt(change)}</span>
            </div>
          </>
        )}
        {method !== 'Cash' && <div style={{ height: 12 }} />}
        <div className="modal-footer" style={{ marginTop: 0 }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={confirm}
            disabled={placing || (method === 'Cash' && !received)}
            style={{ opacity: (placing || (method === 'Cash' && !received)) ? 0.6 : 1 }}>
            {placing ? 'Processing…' : 'Confirm Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Receipt Modal ─────────────────────────────────────────────────────────── */
function ReceiptModal({ receipt, onClose }) {
  const printReceipt = () => {
    const rows = receipt.items.map(i =>
      `<div class="row"><span>${i.qty}x ${i.name}</span><span>USh ${(i.price * i.qty).toLocaleString()}</span></div>`
    ).join('');
    const html = `<!DOCTYPE html><html><head><title>Receipt ${receipt.id}</title>
<style>body{font-family:'Courier New',monospace;max-width:320px;margin:0 auto;padding:20px;font-size:13px;}
h2{text-align:center;font-size:16px;margin-bottom:2px;}.center{text-align:center;color:#666;font-size:11px;margin-bottom:12px;}
hr{border:none;border-top:1px dashed #999;margin:10px 0;}.row{display:flex;justify-content:space-between;margin-bottom:4px;}
.bold{font-weight:bold;}.footer{text-align:center;margin-top:12px;color:#555;font-size:12px;}</style></head>
<body><h2>NEXUS STORE</h2><p class="center">123 Commerce St, Business City<br/>Tel: (555) 123-4567</p>
<hr/><div class="row"><span>Date:</span><span>${fmtDate(receipt.date)}</span></div>
<div class="row"><span>Trans ID:</span><span>${receipt.id}</span></div><hr/>
${rows}<hr/>
<div class="row"><span>Subtotal</span><span>USh ${receipt.total.toLocaleString()}</span></div>
<div class="row bold"><span>TOTAL</span><span>USh ${receipt.total.toLocaleString()}</span></div><hr/>
<div class="row"><span>${receipt.payment}</span><span>USh ${receipt.amountReceived.toLocaleString()}</span></div>
<div class="row"><span>Change</span><span>USh ${receipt.change.toLocaleString()}</span></div>
<p class="footer">Thank you for your business!<br/>Please come again.</p></body></html>`;
    const w = window.open('', '_blank'); w.document.write(html); w.document.close(); w.print();
  };
  
  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ width: 480 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
          <button className="icon-btn" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
            <Icon name="check" size={24} color="var(--primary)" />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 2 }}>Payment Successful</h2>
          <p style={{ color: 'var(--primary)', fontSize: 13 }}>Transaction completed</p>
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '18px 22px', fontSize: 13 }}>
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>NEXUS STORE</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>123 Commerce St, Business City · Tel: (555) 123-4567</div>
          </div>
          <hr style={{ border: 'none', borderTop: '1px dashed var(--border)', margin: '10px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}><span style={{ color: 'var(--muted)' }}>Date:</span><span>{fmtDate(receipt.date)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}><span style={{ color: 'var(--muted)' }}>Trans ID:</span><span style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 12 }}>
            {receipt?.id || receipt?._id || 'N/A'}
          </span></div>
          <hr style={{ border: 'none', borderTop: '1px dashed var(--border)', margin: '10px 0' }} />
          {receipt.items.map((it, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span>{it.qty}x {it.name}</span><span>{fmt(it.price * it.qty)}</span>
            </div>
          ))}
          <hr style={{ border: 'none', borderTop: '1px dashed var(--border)', margin: '10px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}><span>Subtotal</span><span>{fmt(receipt.total)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15, marginBottom: 10 }}><span>TOTAL</span><span>{fmt(receipt.total)}</span></div>
          <hr style={{ border: 'none', borderTop: '1px dashed var(--border)', margin: '10px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}><span>{receipt.payment}</span><span>{fmt(receipt.amountReceived)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}><span>Change</span><span>{fmt(receipt.change)}</span></div>
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>Thank you for your business! Please come again.</div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={printReceipt}><Icon name="print" size={14} /> Print Receipt</button>
        </div>
      </div>
    </div>
  );
}

/* ══ POS Page ══════════════════════════════════════════════════════════════ */
export default function POS() {
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('All');
  const [cart, setCart] = useState([]);
  const [showPayment, setShowPayment] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const searchRef = useRef(null);
  const [showMobileScanner, setShowMobileScanner] = useState(false);
  
  // ✅ NEW: Mobile cart drawer state
  const [isCartOpen, setIsCartOpen] = useState(false);

  const isMobileDevice = useCallback(() => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || (window.innerWidth <= 768);
  }, []);

  // ── Offline Sync Hook ──────────────────────────────────
  const { isOnline, lastSync, updateLastSync } = useNetwork();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const updateLocalStock = useCallback((items) => {
    if (!items || !items.length) return;
    
    setProducts(prev => {
      if (!prev || !prev.length) return prev;
      return prev.map(product => {
        const item = items.find(i => i.productId === product._id || i.productId === product.id);
        if (item) {
          return {
            ...product,
            stock: Math.max(0, (product.stock || 0) - item.qty),
            updatedAt: new Date().toISOString()
          };
        }
        return product;
      });
    });
    
    setCart(prev => prev.map(cartItem => {
      const item = items.find(i => i.productId === cartItem._id || i.productId === cartItem.id);
      if (item) {
        return { ...cartItem, stock: Math.max(0, (cartItem.stock || 0) - item.qty) };
      }
      return cartItem;
    }));
  }, []);

  useEffect(() => {
    if (isMobileDevice()) {
      const hasSeenHint = localStorage.getItem('pos_mobile_hint');
      if (!hasSeenHint) {
        toast('📱 Tap "Scan" to use camera', { 
          duration: 5000, icon: '📷',
          style: { background: '#3b82f6', color: '#fff' }
        });
        localStorage.setItem('pos_mobile_hint', '1');
      }
    }
  }, [isMobileDevice]);

  useEffect(() => {
    let isMounted = true;
    const loadProducts = async () => {
      try {
        const apiPromise = getProducts();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('API_TIMEOUT')), 3000)
        );
        const res = await Promise.race([apiPromise, timeoutPromise]);
        const productList = res?.data || res || [];
        if (isMounted) {
          setProducts(productList);
          if (navigator.onLine && productList.length > 0) {
            cacheProducts(productList).catch(() => {});
          }
          setLoading(false);
        }
      } catch (error) {
        console.warn('API failed, trying cache:', error?.message || String(error));
        if (isMounted) {
          try {
            const cachePromise = getCachedProducts();
            const cacheTimeout = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('CACHE_TIMEOUT')), 1500)
            );
            const cached = await Promise.race([cachePromise, cacheTimeout]);
            setProducts(Array.isArray(cached) ? cached : []);
            if (!cached?.length) {
              toast.error('No products available. Check connection.', { duration: 4000 });
            }
          } catch (cacheErr) {
            console.error('Cache also failed:', cacheErr?.message || String(cacheErr));
            setProducts([]);
            toast.error('Offline mode - no cached data', { duration: 3000 });
          } finally {
            setLoading(false);
          }
        }
      }
    };
    loadProducts();
    return () => { isMounted = false; };
  }, []);

  const refetch = async () => {
    setLoading(true);
    try {
      const res = await getProducts();
      const productList = res.data || res;
      setProducts(productList);
      if (navigator.onLine) await cacheProducts(productList);
    } catch (error) {
      console.warn('Refetch failed:', error?.message || String(error));
      try {
        const cached = await getCachedProducts();
        setProducts(Array.isArray(cached) ? cached : []);
        if (!cached?.length) toast.error('No cached products available', { duration: 3000 });
      } catch {
        setProducts([]);
        toast.error('Offline - no data available', { duration: 3000 });
      }
    } finally {
      setLoading(false);
    }
  };

  const filtered = (products || []).filter(p =>
    (cat === 'All' || p.category === cat) &&
    (p.name.toLowerCase().includes(search.toLowerCase()) ||
     p.sku.toLowerCase().includes(search.toLowerCase())),
  );

  const addToCart = useCallback((p) => {
    if (p.stock < 1) return toast.error('Out of stock');
    setCart(c => {
      const ex = c.find(x => x._id === p._id);
      if (ex) {
        if (ex.qty >= p.stock) { toast.error('Not enough stock'); return c; }
        return c.map(x => x._id === p._id ? { ...x, qty: x.qty + 1 } : x);
      }
      return [...c, { 
        _id: p._id || p.id, id: p.id || p._id, name: p.name, 
        price: p.price, stock: p.stock, qty: 1 
      }];
    });
  }, []);

  const handleBarcodeScan = useCallback(async (code) => {
    const existing = (products || []).find(p => p.barcode === code || p.sku === code);
    if (existing) {
      addToCart(existing);
      toast.success(`Added: ${existing.name}`, { icon: '🔍', duration: 1500 });
      return;
    }
    try {
      const res = await getProductByBarcode(code);
      addToCart(res.data);
      toast.success(`Added: ${res.data.name}`, { icon: '🔍', duration: 1500 });
    } catch {
      toast.error(`No product found for barcode: ${code}`);
    }
  }, [products, addToCart]);

  useBarcodeScanner(handleBarcodeScan);

  const changeQty = (id, d) =>
    setCart(c => c.map(x => (x._id === id || x.id === id) ? { ...x, qty: Math.max(0, x.qty + d) } : x).filter(x => x.qty > 0));
  
  const removeItem = (id) => setCart(c => c.filter(x => x._id !== id && x.id !== id));
  const clearCart = useCallback(() => { if (cart.length && confirm('Clear cart?')) setCart([]); }, [cart]);
  const total = cart.reduce((s, x) => s + x.price * x.qty, 0);

  useEffect(() => { return startAutoSync(); }, []);

  useEffect(() => {
    const h = (e) => {
      const tag = e.target.tagName;
      if (e.target.closest('.modal-overlay')) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); searchRef.current?.focus(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (cart.length) setShowPayment(true); }
      if (e.key === 'Escape') { setSearch(''); searchRef.current?.blur(); }
      if (e.key === 'Delete' && tag !== 'INPUT') clearCart();
      if (!e.ctrlKey && !e.metaKey && !e.altKey && tag !== 'INPUT') {
        const n = parseInt(e.key);
        if (n >= 1 && n <= CATS.length) setCat(CATS[n - 1]);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [cart, clearCart]);

  const confirmPayment = async (method, amountReceived) => {
    try {
      const txPayload = {
        type: 'Product', payment: method,
        items: cart.map(x => ({ productId: x._id || x.id, name: x.name, qty: x.qty, price: x.price })),
      };
      const result = await saveTransactionSmart(txPayload);
      if (result.success) {
        if (result.source === 'offline' && typeof updateLocalStock === 'function') {
          try { updateLocalStock(txPayload.items); } 
          catch (stockErr) { console.error('updateLocalStock failed:', stockErr); await refetch(); }
        }
        setReceipt({
          id: result.source === 'cloud' ? (result.data?.remoteId || result.data?._id || result.data?.id) : `OFFLINE-${result.data?.localId || 'pending'}`,
          date: result.data?.createdAt || new Date().toISOString(), items: cart, total, payment: method,
          amountReceived, change: method === 'Cash' ? Math.max(0, amountReceived - total) : 0, source: result.source,
        });
        setCart([]);
        setShowPayment(false);
        // ✅ Mobile cart bhi close karein payment ke baad
        setIsCartOpen(false);
        if (result.source === 'cloud') await refetch();
        if (result.source === 'offline') updateLastSync();
        return true;
      }
      return false;
    } catch (e) {
      toast.error(e.response?.data?.error || e.message);
      return false;
    }
  };

  return (
    <>
      {/* ── Connection Status Badge ─────────────────────────── */}
      <div style={{ 
        position: 'fixed', top: 12, right: 12, zIndex: 1000,
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
        borderRadius: 20, background: isOnline ? '#dcfce7' : '#fef9c3',
        color: isOnline ? '#16a34a' : '#b45309', fontSize: 11, fontWeight: 600,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <span style={{ 
          width: 8, height: 8, borderRadius: '50%', 
          background: isOnline ? '#22c55e' : '#f59e0b',
          animation: !isOnline ? 'pulse 2s infinite' : 'none'
        }} />
        {isOnline ? '● Online' : '○ Offline'}
        {lastSync && <span style={{ color: '#64748b', marginLeft: 4 }}>· {new Date(lastSync).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>}
      </div>

      <div className="pos-layout" style={{ paddingTop: 'var(--header-height, 0px)' }}>
        {/* ══ LEFT: product area ══════════════════════════════════════════ */}
        <div className="pos-products">
          {/* Search + Barcode input row */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <div className="pos-search-bar" style={{ flex: 1, marginBottom: 0 }}>
              <Icon name="search" size={15} color="var(--muted)" />
              <input ref={searchRef} placeholder="Search products… (Ctrl+F)" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 14px', minWidth: 190 }}>
              <Icon name="barcode" size={15} color="var(--muted)" />
              <input data-barcode="true" placeholder="Scan barcode…"
                style={{ border: 'none', outline: 'none', fontSize: 13, width: '100%', fontFamily: 'inherit', background: 'transparent' }}
                onKeyDown={e => { if (e.key === 'Enter' && e.target.value.trim()) { handleBarcodeScan(e.target.value.trim()); e.target.value = ''; } }}
              />
            </div>
            {/* ✅ Mobile Camera Scanner Button */}
            {isMobileDevice() && (
              <button className="btn btn-primary" onClick={() => setShowMobileScanner(true)}
                style={{ padding: '8px 12px', fontSize: 12, whiteSpace: 'nowrap' }} title="Scan with camera">
                <Icon name="camera" size={14} style={{ marginRight: 4 }} /> Scan
              </button>
            )}
          </div>

          {/* Category chips */}
          <div className="pos-cats">
            {CATS.map((c, i) => (
              <button key={c} title={`Press ${i + 1}`} className={`pos-cat-btn${c === cat ? ' active' : ''}`} onClick={() => setCat(c)}>{c}</button>
            ))}
          </div>

          {/* Product list */}
          {loading ? <Spinner /> : (
            <div className="product-list">
              {filtered.map(p => (
                <div key={p._id || p.id} className={`product-row${p.stock < 1 ? ' disabled' : ''}`} onClick={() => addToCart(p)}>
                  <div className="product-row-avatar">{p.name[0].toUpperCase()}</div>
                  <div className="product-row-info">
                    <span className="product-row-name">{p.name}</span>
                    <span className="product-row-sku">{p.sku}{p.barcode ? ` · 🔖 ${p.barcode}` : ''} · {p.category}</span>
                  </div>
                  <div className="product-row-stock"><span className={p.stock <= 5 ? 'low-stock' : ''}>{p.stock} left</span></div>
                  <div className="product-row-price">{fmt(p.price)}</div>
                  <button className="product-row-add" disabled={p.stock < 1}><Icon name="plus" size={14} color="var(--primary)" /></button>
                </div>
              ))}
              {!filtered.length && (
                <div className="pos-empty-list"><Icon name="search" size={32} /><p>No products found</p></div>
              )}
            </div>
          )}
        </div>

        {/* ══ RIGHT: cart panel (Mobile: Bottom Sheet) ═══════════════════ */}
        {/* ✅ Conditional class for mobile slide animation */}
        <div className={`pos-cart ${isCartOpen ? 'open' : ''}`}>
          {/* Cart header */}
          <div className="pos-cart-header">
            <div className="pos-cart-title"><Icon name="cart" size={16} /> Current Order</div>
            {/* ✅ Mobile Close Button */}
            <button className="icon-btn" onClick={() => setIsCartOpen(false)}
              style={{ display: 'none' }} title="Close cart" aria-label="Close cart">
              <Icon name="minus" size={18} />
            </button>
            {cart.length > 0 && (
              <button className="pos-clear-btn" onClick={clearCart}>
                <Icon name="trash" size={12} color="var(--danger)" /> Clear
              </button>
            )}
          </div>

          {/* Empty state */}
          {cart.length === 0 ? (
            <div className="pos-empty">
              <Icon name="cart" size={40} />
              <p style={{ fontWeight: 600, marginTop: 12, fontSize: 14 }}>Cart is empty</p>
              <p style={{ fontSize: 12, textAlign: 'center', marginTop: 5, color: 'var(--muted)' }}>Click a product or scan a barcode to add it.</p>
              <div className="pos-shortcuts">
                <strong>⌨ Shortcuts</strong>
                <span><b>Ctrl+F</b> Search</span><span><b>1-6</b> Categories</span>
                <span><b>Ctrl+Enter</b> Checkout</span><span><b>Del</b> Clear cart</span>
              </div>
            </div>
          ) : (
            <>
              {/* Cart items */}
              <div className="pos-cart-items">
                {cart.map((item, index) => (
                  <div key={item._id || item.id || index} className="pos-cart-item">
                    <div className="pos-cart-item-name">{item.name}</div>
                    <div className="pos-cart-item-sub">{fmt(item.price)} each</div>
                    <div className="pos-cart-item-controls">
                      <button className="qty-btn" onClick={() => changeQty(item._id || item.id, -1)}><Icon name="minus" size={11} /></button>
                      <span className="qty-num">{item.qty}</span>
                      <button className="qty-btn" onClick={() => changeQty(item._id || item.id, 1)}><Icon name="plus" size={11} /></button>
                      <span className="pos-cart-item-total">{fmt(item.price * item.qty)}</span>
                      <button className="icon-btn icon-btn-danger" onClick={() => removeItem(item._id || item.id)}><Icon name="trash" size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer totals */}
              <div className="pos-cart-footer">
                <div className="pos-cart-row"><span style={{ color: 'var(--muted)' }}>Subtotal</span><span>{fmt(total)}</span></div>
                <div className="pos-cart-row pos-cart-total"><span>Total</span><span>{fmt(total)}</span></div>
                <button className="btn btn-primary btn-full" style={{ marginTop: 12, fontSize: 15, padding: '13px', justifyContent: 'center', borderRadius: 10 }}
                  onClick={() => setShowPayment(true)}>Charge {fmt(total)}</button>
                <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>Ctrl+Enter to charge</p>
              </div>
            </>
          )}
        </div>
      </div>

      {showPayment && <PaymentModal total={total} onConfirm={confirmPayment} onClose={() => setShowPayment(false)} />}
      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
      
      {/* ✅ Mobile Scanner Modal */}
      {showMobileScanner && (
        <MobileScanner 
          onScan={(code) => { handleBarcodeScan(code); setShowMobileScanner(false); }}
          onClose={() => setShowMobileScanner(false)}
        />
      )}

      {/* ✅ Mobile Floating Cart Button (Sirf mobile par, jab cart open na ho) */}
      {cart.length > 0 && !isCartOpen && isMobileDevice() && (
        <button 
          className="pos-cart-floating-btn"
          onClick={() => setIsCartOpen(true)}
          title="Open cart"
          aria-label="Open cart"
        >
          <Icon name="cart" size={24} color="#fff" />
          <span className="pos-cart-badge">{cart.length}</span>
        </button>
      )}
    </>
  );
}