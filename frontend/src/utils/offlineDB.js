// src/utils/offlineDB.js

const DB_NAME = 'NexusPOS_Offline';
const STORE_NAME = 'pending_transactions';
const PRODUCTS_STORE = 'products_cache';
const DB_VERSION = 2;  // ✅ Incremented: v1→v2 to add products_cache store

let db = null;

/**
 * Open or create IndexedDB database
 * Triggers onupgradeneeded only when version increases
 */
export const openDB = () => {
  return new Promise((resolve, reject) => {
    // Return cached instance if already open
    if (db) return resolve(db);
    
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    // ✅ Runs only when DB is created OR version is incremented
    request.onupgradeneeded = (e) => {
      const database = e.target.result;
      
      // ── Store 1: pending_transactions (for offline sales) ──
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { 
          keyPath: 'localId', 
          autoIncrement: true 
        });
        store.createIndex('synced', 'synced', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
      
      // ── Store 2: products_cache (for offline product list) ──
      if (!database.objectStoreNames.contains(PRODUCTS_STORE)) {
        database.createObjectStore(PRODUCTS_STORE, { keyPath: '_id' });
      }
    };
    
    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
    
    request.onerror = (e) => {
      console.error('IndexedDB open error:', e.target.error);
      reject(e.target.error);
    };
  });
};

// ─────────────────────────────────────────────────────────────
// 📦 PRODUCTS CACHE FUNCTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Cache products list for offline use
 * @param {Array} products - Array of product objects from API
 */
export const cacheProducts = async (products) => {
  if (!Array.isArray(products)) return false;
  
  await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PRODUCTS_STORE], 'readwrite');
    const store = transaction.objectStore(PRODUCTS_STORE);
    
    // ✅ Instead of clear + add, update existing or add new
    let completed = 0;
    const total = products.length;
    
    if (total === 0) {
      resolve(true);
      return;
    }
    
    products.forEach(product => {
      if (!product._id) return; // Skip invalid
      
      const putRequest = store.put({ 
        ...product, 
        cachedAt: new Date().toISOString(),
        updatedAt: product.updatedAt || new Date().toISOString()
      });
      
      putRequest.onsuccess = () => {
        completed++;
        if (completed === total) resolve(true);
      };
      putRequest.onerror = () => {
        completed++;
        if (completed === total) resolve(true); // Continue even if one fails
      };
    });
  });
};

/**
 * Retrieve cached products from IndexedDB
 * @returns {Promise<Array>} Array of cached products
 */
export const getCachedProducts = async () => {
  await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PRODUCTS_STORE], 'readonly');
    const store = transaction.objectStore(PRODUCTS_STORE);
    const request = store.getAll();
    
    request.onsuccess = () => {
      const products = request.result || [];
      resolve(products);
    };
    
    request.onerror = () => {
      console.error('Get cached products error:', request.error);
      reject(request.error);
    };
  });
};

/**
 * Check if cached products are fresh (< 5 minutes old)
 * @param {Array} products - Products array to check
 * @returns {boolean} True if cache is fresh
 */
export const isCacheFresh = (products) => {
  if (!products || products.length === 0) return false;
  
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  
  // Check if ANY product was cached recently
  return products.some(p => {
    const cachedTime = new Date(p.cachedAt || 0).getTime();
    return (now - cachedTime) < fiveMinutes;
  });
};

// ─────────────────────────────────────────────────────────────
// 🔄 TRANSACTION SYNC FUNCTIONS (Offline → Online)
// ─────────────────────────────────────────────────────────────

/**
 * Save a transaction locally when offline
 * @param {Object} txData - Transaction payload
 * @returns {Promise<Object>} Saved record with localId
 */
export const saveOfflineTransaction = async (txData) => {
  await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const record = {
      ...txData,
      synced: 0,  // ✅ Numeric: 0=pending, 1=synced (avoids boolean key issues)
      createdAt: new Date().toISOString(),
      retryCount: 0,
      lastAttempt: null,
      lastError: null,
    };
    
    const request = store.add(record);
    
    request.onsuccess = () => {
      resolve({ localId: request.result, ...record });
    };
    
    request.onerror = () => {
      console.error('Save offline transaction error:', request.error);
      reject(request.error);
    };
  });
};

/**
 * Get all pending (unsynced) transactions
 * Uses cursor iteration for compatibility (avoids IDBKeyRange boolean issue)
 * @returns {Promise<Array>} Array of pending transaction records
 */
export const getPendingTransactions = async () => {
  await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.openCursor();
    const results = [];
    
    request.onsuccess = (e) => {
      const cursor = e.target.result;
      
      if (cursor) {
        // ✅ Filter using numeric comparison (0 = pending)
        if (cursor.value.synced === 0) {
          results.push(cursor.value);
        }
        cursor.continue();
      } else {
        // Cursor finished iterating
        resolve(results);
      }
    };
    
    request.onerror = () => {
      console.error('Get pending transactions error:', request.error);
      reject(request.error);
    };
  });
};

/**
 * Mark a transaction as synced and remove from IndexedDB
 * @param {number} localId - The localId of the record to mark
 * @returns {Promise<boolean>} True if successfully marked/deleted
 */
export const markAsSynced = async (localId) => {
  await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // Direct delete is sufficient (no need to update first)
    const request = store.delete(localId);
    
    request.onsuccess = () => resolve(true);
    
    request.onerror = () => {
      console.error('Mark as synced error:', request.error);
      reject(request.error);
    };
  });
};

/**
 * Update retry count for a failed sync attempt
 * @param {number} localId - The localId of the record
 * @param {Error|string} error - Error message or object
 * @returns {Promise<Object|null>} Updated record or null if not found
 */
export const updateRetryCount = async (localId, error) => {
  await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const getRequest = store.get(localId);
    
    getRequest.onsuccess = () => {
      const record = getRequest.result;
      
      if (record) {
        record.retryCount = (record.retryCount || 0) + 1;
        record.lastAttempt = new Date().toISOString();
        record.lastError = error?.message || String(error);
        
        const updateRequest = store.put(record);
        
        updateRequest.onsuccess = () => resolve(record);
        updateRequest.onerror = () => reject(updateRequest.error);
      } else {
        resolve(null); // Record not found
      }
    };
    
    getRequest.onerror = () => reject(getRequest.error);
  });
};

/**
 * Clean up successfully synced records (optional maintenance)
 * Uses cursor to avoid IDBKeyRange boolean key issues
 * @returns {Promise<number>} Number of records cleaned
 */
export const cleanupSynced = async () => {
  await openDB();
  return new Promise((resolve) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.openCursor();
    let cleaned = 0;
    
    request.onsuccess = (e) => {
      const cursor = e.target.result;
      
      if (cursor) {
        // ✅ Delete if synced === 1 (numeric)
        if (cursor.value.synced === 1) {
          store.delete(cursor.primaryKey);
          cleaned++;
        }
        cursor.continue();
      } else {
        resolve(cleaned);
      }
    };
    
    request.onerror = () => {
      console.warn('Cleanup synced error:', request.error);
      resolve(0); // Don't fail the app, just return 0
    };
  });
};

// ─────────────────────────────────────────────────────────────
// 🧹 UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Clear all data from a specific store (use with caution!)
 * @param {string} storeName - Name of store to clear
 * @returns {Promise<boolean>} True if cleared successfully
 */
export const clearStore = async (storeName) => {
  await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();
    
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Get stats about offline data (for debugging/UI)
 * @returns {Promise<Object>} Stats object
 */
export const getOfflineStats = async () => {
  await openDB();
  
  const [pending, cached] = await Promise.all([
    getPendingTransactions(),
    getCachedProducts()
  ]);
  
  return {
    pendingTransactions: pending.length,
    cachedProducts: cached.length,
    lastProductCache: cached.length > 0 
      ? Math.max(...cached.map(p => new Date(p.cachedAt || 0).getTime()))
      : null,
    isOnline: navigator.onLine,
  };
};

/**
 * Reset entire database (development/debugging only!)
 * ⚠️ This will delete ALL offline data
 */
export const resetDatabase = async () => {
  return new Promise((resolve, reject) => {
    // Close existing connection first
    if (db) {
      db.close();
      db = null;
    }
    
    const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
    
    deleteRequest.onsuccess = () => {
      console.log('✅ Database reset complete');
      resolve(true);
    };
    
    deleteRequest.onerror = () => reject(deleteRequest.error);
    deleteRequest.onblocked = () => {
      console.warn('⚠️ Database reset blocked - close all tabs using this app');
      reject(new Error('Database reset blocked'));
    };
  });
};