// src/pages/ServiceSales.jsx
import { useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '../components/Icon';
import Spinner from '../components/Spinner';
import { useFetch } from '../hooks/useApi';
import { getServices, createTransaction } from '../utils/api';
import { fmt } from '../utils/format';

export default function ServiceSales() {
  const [cart,        setCart]        = useState([]);
  const [payment,     setPayment]     = useState('Cash');
  const [placing,     setPlacing]     = useState(false);
  const [customName,  setCustomName]  = useState('');
  const [customPrice, setCustomPrice] = useState('');

  const { data: services, loading } = useFetch(getServices, []);

  const addService = (s) => {
    setCart(c => {
      const ex = c.find(x => x.id === s.id);
      if (ex) return c.map(x => x.id === s.id ? { ...x, qty: x.qty + 1 } : x);
      return [...c, { ...s, qty: 1 }];
    });
  };

  const removeItem = (id) => setCart(c => c.filter(x => x.id !== id));

  const addCustom = () => {
    if (!customName.trim() || !customPrice) return toast.error('Enter name and price');
    setCart(c => [...c, { id: `custom-${Date.now()}`, name: customName, price: Number(customPrice), qty: 1 }]);
    setCustomName(''); setCustomPrice('');
  };

  const total = cart.reduce((s, x) => s + x.price * x.qty, 0);

  const checkout = async () => {
    if (!cart.length) return;
    setPlacing(true);
    try {
      await createTransaction({
        type: 'Service',
        payment,
        items: cart.map(x => ({
          serviceId: x.id.startsWith('custom-') ? null : x.id,
          name: x.name, qty: x.qty, price: x.price,
        })),
      });
      toast.success('Service sale recorded! 🎉');
      setCart([]);
    } catch (e) {
      toast.error(e.response?.data?.error || e.message);
    } finally { setPlacing(false); }
  };

  return (
    <div>
      <h1 className="page-title">Service Sales</h1>
      <p className="page-sub">Record service transactions.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        <div>
          {/* Service catalog */}
          <div className="card">
            <h2 className="card-title">Available Services</h2>
            {loading ? <Spinner /> : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {(services || []).map(s => (
                  <div key={s.id} onClick={() => addService(s)} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', cursor: 'pointer', transition: 'all .15s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <div style={{ fontWeight: 600 }}>{s.name}</div>
                    <div style={{ color: 'var(--primary)', fontWeight: 700, marginTop: 4 }}>{fmt(s.price)}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.sku}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Custom service */}
          <div className="card">
            <h2 className="card-title">Add Custom Service</h2>
            <div className="form-row">
              <div><label>Service Name</label><input placeholder="e.g. Data Recovery" value={customName} onChange={e => setCustomName(e.target.value)} /></div>
              <div><label>Price (USh)</label><input type="number" placeholder="0" value={customPrice} onChange={e => setCustomPrice(e.target.value)} /></div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={addCustom}><Icon name="plus" size={13} /> Add to Cart</button>
          </div>
        </div>

        {/* Cart */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Service Cart</h3>
          {cart.length === 0
            ? <p style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: 30 }}>No services added yet</p>
            : (
              <>
                <div style={{ flex: 1 }}>
                  {cart.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{item.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--primary)' }}>{fmt(item.price)}</div>
                      </div>
                      <button className="icon-btn icon-btn-danger" onClick={() => removeItem(item.id)}><Icon name="trash" size={14} /></button>
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: 12 }}>
                    <span>Total</span>
                    <span style={{ color: 'var(--primary)' }}>{fmt(total)}</span>
                  </div>
                  <select style={{ marginBottom: 12 }} value={payment} onChange={e => setPayment(e.target.value)}>
                    <option>Cash</option><option>Mobile Money</option><option>Card</option>
                  </select>
                  <button className="btn btn-primary btn-full" onClick={checkout} disabled={placing}>
                    {placing ? 'Processing…' : 'Process'}
                  </button>
                </div>
              </>
            )}
        </div>
      </div>
    </div>
  );
}
