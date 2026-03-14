// src/services/syncService.js
import { createTransaction as apiCreateTransaction } from '../utils/api';
import { 
  getPendingTransactions, 
  markAsSynced, 
  updateRetryCount,
  saveOfflineTransaction,
  getCachedProducts,  // ✅ ADD THIS
  cacheProducts       // ✅ ADD THIS
} from '../utils/offlineDB';
import toast from 'react-hot-toast';

const MAX_RETRIES = 5;
const SYNC_INTERVAL = 30000;

let syncInterval = null;
let isSyncing = false;

// ─────────────────────────────────────────────────────────────
// 🔍 DEBUG: Global sync state logger
// ─────────────────────────────────────────────────────────────
const log = (...args) => console.log('🔁 [SyncService]', ...args);
const warn = (...args) => console.warn('⚠️ [SyncService]', ...args);
const error = (...args) => console.error('❌ [SyncService]', ...args);

// ✅ Add this helper function at top of syncService.js:

// Helper: Deduct stock from cached products in IndexedDB
const deductLocalStock = async (items) => {
  try {
    const cached = await getCachedProducts();
    if (!cached.length) return;
    
    // Create map for quick lookup
    const productMap = new Map(cached.map(p => [p._id, p]));
    
    // Deduct stock for each item
    for (const item of items) {
      if (item.productId && productMap.has(item.productId)) {
        const product = productMap.get(item.productId);
        product.stock = Math.max(0, (product.stock || 0) - item.qty);
        product.updatedAt = new Date().toISOString();
      }
    }
    
    // Save updated cache back to IndexedDB
    await cacheProducts(Array.from(productMap.values()));
    
  } catch (error) {
    console.warn('⚠️ Failed to update local stock cache:', error);
  }
};

// ✅ Simple connectivity check with detailed logging
const verifyRealConnection = async () => {
  log('🔍 verifyRealConnection: Starting check...');
  log('   ├─ navigator.onLine:', navigator.onLine);
  
  if (!navigator.onLine) {
    log('   └─ ❌ Skipping: navigator.onLine = false');
    return false;
  }
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      log('   ├─ ⏱️  Fetch timeout triggered (2s)');
      controller.abort();
    }, 2000);
    
    const testUrl = '/api/products?limit=1';
    log('   ├─ 🌐 Fetching:', testUrl);
    log('   ├─ Headers:', {
      'x-profile-id': localStorage.getItem('nexus_active_profile') || 'default'
    });
    
    const response = await fetch(testUrl, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'x-profile-id': localStorage.getItem('nexus_active_profile') || 'default',
      },
    });
    
    clearTimeout(timeout);
    
    log('   ├─ ✅ Response received:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });
    
    const isWorking = response.status >= 200 && response.status < 500;
    log('   └─ 🎯 Connection check result:', isWorking ? 'PASS' : 'FAIL');
    
    return isWorking;
    
  } catch (fetchError) {
    warn('   └─ ❌ Fetch error:', {
      name: fetchError?.name,
      message: fetchError?.message,
      type: fetchError?.constructor?.name
    });
    return false;
  }
};

// ✅ Sync single transaction with logging
const syncTransaction = async (pendingTx) => {
  log('📤 syncTransaction: Starting for localId:', pendingTx?.localId);
  
  try {
    // Remove local-only fields
    const { localId, synced, createdAt, retryCount, lastAttempt, lastError, ...txPayload } = pendingTx;
    
    log('   ├─ Payload prepared:', {
      type: txPayload?.type,
      payment: txPayload?.payment,
      itemsCount: txPayload?.items?.length,
      hasProductId: txPayload?.items?.[0]?.productId ? 'YES' : 'NO/NULL'
    });
    
    const response = await apiCreateTransaction(txPayload);
    
    log('   ├─ ✅ API response:', {
      status: response?.status,
      hasData: !!response?.data,
      remoteId: response?.data?._id || response?.data?.id
    });
    
    await markAsSynced(pendingTx.localId);
    log('   ├─ ✅ Marked as synced + deleted from IndexedDB');
    
    log('   └─ 🎉 Transaction synced successfully');
    return { success: true, remoteId: response.data?._id || response.data?.id };
    
  } catch (syncError) {
    error('   └─ ❌ Sync failed:', {
      localId: pendingTx?.localId,
      errorMessage: syncError?.message,
      errorName: syncError?.name,
      responseData: syncError?.response?.data
    });
    
    await updateRetryCount(pendingTx.localId, syncError);
    
    if ((pendingTx.retryCount || 0) >= MAX_RETRIES) {
      toast.error(`Failed to sync #${pendingTx.localId} after ${MAX_RETRIES} attempts`);
    }
    return { success: false, error: syncError.message };
  }
};

// ✅ Main sync function - FULLY LOGGED
export const runSync = async () => {
  log('🚀 runSync: Called');
  log('   ├─ isSyncing:', isSyncing);
  log('   ├─ navigator.onLine:', navigator.onLine);
  
  if (isSyncing) {
    log('   └─ ⏭️  Already syncing, skipping');
    return;
  }
  
  // ✅ Quick check: only skip if definitely offline
  if (!navigator.onLine) {
    log('   └─ 📡 Offline detected, skipping sync');
    return;
  }
  
  isSyncing = true;
  log('   └─ ✅ Lock acquired, proceeding with sync');
  
  try {
    log('📦 Fetching pending transactions from IndexedDB...');
    const pending = await getPendingTransactions();
    
    log('   ├─ Found pending:', pending.length);
    if (pending.length > 0) {
      log('   ├─ Sample pending tx:', {
        localId: pending[0]?.localId,
        synced: pending[0]?.synced,
        itemsCount: pending[0]?.items?.length,
        firstItemProductId: pending[0]?.items?.[0]?.productId
      });
    }
    
    if (pending.length === 0) {
      log('   └─ ✅ No pending transactions, sync complete');
      return { synced: 0 };
    }
    
    log(`🔄 Starting batch sync: ${pending.length} pending transactions`);
    toast.loading(`Syncing ${pending.length}...`, { id: 'sync-toast', duration: Infinity });
    
    let successCount = 0;
    let failCount = 0;
    
    for (const [index, tx] of pending.entries()) {
      log(`\n📋 Processing transaction ${index + 1}/${pending.length}:`, {
        localId: tx.localId,
        retryCount: tx.retryCount || 0
      });
      
      // ✅ Try to sync each transaction individually
      try {
        const result = await syncTransaction(tx);
        if (result.success) {
          successCount++;
          log(`   ✅ Success (${successCount}/${pending.length})`);
        } else {
          failCount++;
          warn(`   ⚠️ Failed: ${result.error}`);
        }
      } catch (txError) {
        failCount++;
        warn(`   ❌ Exception: ${txError?.message}`);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 100));
    }
    
    log(`\n🏁 Batch sync complete: ${successCount} succeeded, ${failCount} failed`);
    
    toast.success(`✅ Synced ${successCount}/${pending.length}`, { 
      id: 'sync-toast', 
      duration: 3000 
    });
    
    return { synced: successCount, failed: failCount, total: pending.length };
    
  } catch (batchError) {
    error('💥 Batch sync error:', {
      message: batchError?.message,
      stack: batchError?.stack
    });
    toast.error('Sync failed, will retry', { id: 'sync-toast', duration: 3000 });
    return { error: batchError.message };
  } finally {
    isSyncing = false;
    log('🔓 Sync lock released');
  }
};

// ✅ Auto-sync starter with logging
export const startAutoSync = () => {
  log('🔄 startAutoSync: Initializing...');
  
  // Initial sync if online
  if (navigator.onLine) {
    log('   ├─ 🌐 Online detected, scheduling initial sync in 1s');
    setTimeout(() => {
      log('   └─ ⏰ Initial sync trigger fired');
      runSync().catch(err => error('Initial sync error:', err));
    }, 1000);
  } else {
    log('   ├─ 📡 Offline, waiting for online event');
  }
  
  // Periodic sync
  syncInterval = setInterval(() => {
    if (navigator.onLine) {
      log('⏰ Periodic sync trigger (navigator.onLine = true)');
      runSync().catch(err => error('Periodic sync error:', err));
    } else {
      log('⏰ Periodic sync skipped (navigator.onLine = false)');
    }
  }, SYNC_INTERVAL);
  
  // Listen for online events
  const onOnline = () => {
    log('🌐 "online" event detected');
    setTimeout(() => {
      log('   └─ ⏰ Online event sync trigger fired');
      runSync().catch(err => error('Online event sync error:', err));
    }, 2000);
  };
  
  window.addEventListener('online', onOnline);
  window.addEventListener('app:online', onOnline);
  
  log('✅ Auto-sync initialized, listeners attached');
  
  // Cleanup function
  return () => {
    log('🛑 Auto-sync cleanup: removing listeners');
    clearInterval(syncInterval);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('app:online', onOnline);
  };
};

// ✅ Smart save function with logging
export const saveTransactionSmart = async (txData) => {
  if (navigator.onLine) {
    try {
      const response = await apiCreateTransaction(txData);
      
      // Save local backup with remote ID
      await saveOfflineTransaction({ 
        ...txData, 
        remoteId: response.data?._id || response.data?.id, 
        synced: 1 
      });
      
      return { success: true, data: response.data, source: 'cloud' };
      
    } catch (error) {
      console.warn('☁️ Cloud save failed, saving offline:', error?.message);
      
      
      
      const local = await saveOfflineTransaction(txData);
      toast.error('Saved offline. Will sync when internet is stable.', { 
        duration: 4000,
        icon: '📦'
      });
      return { success: true, data: local, source: 'offline' };
    }
  } else {
  
  
  const local = await saveOfflineTransaction(txData);
  log('✅ Offline save successful', { localId: local?.localId });
  
  toast.success('Saved offline. Stock updated locally.', { 
    icon: '📦',
    duration: 3000 
  });
  
  // ✅ FIXED: Return 'data: local' to match online branch structure
  return { success: true, data: local, source: 'offline' };
}
};