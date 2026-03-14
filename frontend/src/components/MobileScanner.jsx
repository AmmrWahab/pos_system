// src/components/MobileScanner.jsx
import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import Icon from './Icon';
import toast from 'react-hot-toast';

export default function MobileScanner({ onScan, onClose }) {
  const scannerRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const html5QrCodeRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const startScanner = async () => {
      try {
        setScanning(true);
        
        // Check if camera permissions are available
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera not supported in this browser');
        }

        // Request camera permission first
        await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        
        // Initialize scanner
        const html5QrCode = new Html5Qrcode('reader');
        html5QrCodeRef.current = html5QrCode;

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          disableFlip: false,
          rememberLastUsedCamera: true,
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
        };

        await html5QrCode.start(
          { facingMode: 'environment' }, // Use back camera
          config,
          (decodedText) => {
            // ✅ Barcode successfully scanned
            console.log('📷 Barcode scanned:', decodedText);
            onScan?.(decodedText);
            stopScanner(); // Auto-close after successful scan
          },
          (errorMessage) => {
            // Ignore decode errors - they happen while scanning
            // console.log('Scan error (normal):', errorMessage);
          }
        );

        if (!isMounted) {
          html5QrCode.stop().catch(() => {});
        }
      } catch (err) {
        console.error('❌ Scanner error:', err);
        setError(err.message || 'Failed to start camera');
        
        if (err.name === 'NotAllowedError') {
          toast.error('Camera permission denied. Please allow camera access.');
        } else if (err.name === 'NotFoundError') {
          toast.error('No camera found on this device.');
        } else {
          toast.error('Camera error: ' + (err.message || 'Please try again'));
        }
        setScanning(false);
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [onScan]);

  const stopScanner = async () => {
    if (html5QrCodeRef.current?.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        await html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn('Cleanup error:', err);
      }
    }
    setScanning(false);
  };

  const handleManualClose = async () => {
    await stopScanner();
    onClose?.();
  };

  return (
    <div className="modal-overlay" onClick={handleManualClose}>
      <div className="modal-box" style={{ width: '95%', maxWidth: 400, padding: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 16px', background: 'var(--primary)', color: '#fff'
        }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>📷 Scan Barcode</span>
          <button className="icon-btn" onClick={handleManualClose} style={{ color: '#fff' }}>
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* Scanner Area */}
        <div style={{ position: 'relative', background: '#000' }}>
          <div id="reader" ref={scannerRef} style={{ width: '100%', minHeight: 300 }} />
          
          {/* Overlay guide */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            border: '3px solid rgba(255,255,255,0.5)', borderRadius: 8,
            pointerEvents: 'none', margin: 20
          }} />
          
          {/* Corner markers */}
          <div style={{
            position: 'absolute', top: 18, left: 18, width: 30, height: 30,
            borderLeft: '4px solid var(--primary)', borderTop: '4px solid var(--primary)',
            pointerEvents: 'none'
          }} />
          <div style={{
            position: 'absolute', top: 18, right: 18, width: 30, height: 30,
            borderRight: '4px solid var(--primary)', borderTop: '4px solid var(--primary)',
            pointerEvents: 'none'
          }} />
          <div style={{
            position: 'absolute', bottom: 18, left: 18, width: 30, height: 30,
            borderLeft: '4px solid var(--primary)', borderBottom: '4px solid var(--primary)',
            pointerEvents: 'none'
          }} />
          <div style={{
            position: 'absolute', bottom: 18, right: 18, width: 30, height: 30,
            borderRight: '4px solid var(--primary)', borderBottom: '4px solid var(--primary)',
            pointerEvents: 'none'
          }} />
        </div>

        {/* Instructions */}
        <div style={{ padding: '16px', textAlign: 'center', background: '#f8fafc' }}>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
            Point camera at barcode or QR code
          </p>
          
          {error && (
            <div style={{ 
              padding: '10px', background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: 8, color: '#dc2626', fontSize: 12, marginBottom: 12 
            }}>
              ⚠️ {error}
            </div>
          )}
          
          {/* Manual input fallback */}
          <details style={{ fontSize: 12, color: 'var(--muted)' }}>
            <summary style={{ cursor: 'pointer', marginBottom: 8 }}>
              Or enter code manually
            </summary>
            <input
              type="text"
              placeholder="Enter barcode/QR code"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1px solid var(--border)', fontSize: 14, marginBottom: 8
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                  onScan?.(e.target.value.trim());
                  handleManualClose();
                }
              }}
            />
          </details>
          
          <button 
            className="btn btn-outline" 
            onClick={handleManualClose}
            style={{ marginTop: 8 }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}