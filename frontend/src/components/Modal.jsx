// src/components/Modal.jsx
import Icon from './Icon';
import { useEffect } from 'react';

export default function Modal({ 
  title, 
  onClose, 
  children, 
  width = 460,
  hideClose = false,     // ✅ Optional: Hide close button
  fullHeight = false,    // ✅ Optional: Force full-height modal
  ...props 
}) {
  
  // ✅ Lock body scroll when modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // ✅ Close on ESC key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div 
      className="modal-overlay" 
      onClick={e => {
        // Only close if clicking the overlay, not the modal content
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div 
        className="modal-box" 
        style={{ 
          width: width,
          maxWidth: '90vw',  // ✅ Prevent overflow on small screens
        }}
        onClick={e => e.stopPropagation()}  // ✅ Prevent clicks inside from closing
      >
        {/* Header */}
        <div className="modal-header">
          <span className="modal-title" id="modal-title">{title}</span>
          {!hideClose && (
            <button 
              className="icon-btn" 
              onClick={onClose}
              aria-label="Close modal"
              title="Close"
            >
              <Icon name="x" size={18} />
            </button>
          )}
        </div>

        {/* Content - Scrollable on mobile */}
        <div className="modal-content" style={{ 
          overflowY: 'auto',
          flex: 1,
          minHeight: 0,  // ✅ Fix flex scroll issue
          paddingRight: '4px'  // ✅ Space for scrollbar
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}