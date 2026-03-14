// src/utils/api.js
import axios from 'axios';


const api = axios.create({ baseURL: '/api' });

// Attach active profile ID to every request
api.interceptors.request.use(cfg => {
  const profileId = localStorage.getItem('nexus_active_profile') || 'default';
  cfg.headers['x-profile-id'] = profileId;
  return cfg;
});

// Products

export const getProducts       = (p)    => api.get('/products', { params: p });
export const getProductByBarcode = (bc) => api.get(`/products/barcode/${encodeURIComponent(bc)}`);
export const getProduct        = (id)   => api.get(`/products/${id}`);
export const createProduct     = (d)    => api.post('/products', d);
export const updateProduct     = (id,d) => api.put(`/products/${id}`, d);
export const deleteProduct     = (id)   => api.delete(`/products/${id}`);
export const adjustStock       = (id,a) => api.patch(`/products/${id}/stock`, { amount: a });

// Services
export const getServices   = ()      => api.get('/services');
export const createService = (d)     => api.post('/services', d);
export const updateService = (id,d)  => api.put(`/services/${id}`, d);
export const deleteService = (id)    => api.delete(`/services/${id}`);

// Transactions
export const getTransactions    = (p)    => api.get('/transactions', { params: p });
export const getTransaction     = (id)   => api.get(`/transactions/${id}`);
export const createTransaction  = (d)    => api.post('/transactions', d);
export const updateTransaction  = (id,d) => api.put(`/transactions/${id}`, d);
export const deleteTransaction  = (id)   => api.delete(`/transactions/${id}`);

// Dashboard & Reports
export const getDashboardStats  = ()  => api.get('/dashboard/stats');
export const getReports         = (r) => api.get(`/reports/${r}`);

// Profiles
export const getProfiles    = ()      => api.get('/profiles');
export const createProfile  = (d)     => api.post('/profiles', d);
export const updateProfile  = (id,d)  => api.put(`/profiles/${id}`, d);
export const deleteProfile  = (id)    => api.delete(`/profiles/${id}`);
export const linkProfile    = (id,tId)=> api.post(`/profiles/${id}/link`, { targetId: tId });
export const unlinkProfile  = (id)    => api.delete(`/profiles/${id}/link`);
export const getProfileProducts = (id) =>
  api.get(`/profiles/${id}/products`);  // ✅ Use 'api' instance for baseURL + headers

// Add these new exports at the end of src/utils/api.js

// Profile Authentication
export const verifyProfilePassword = (profileId, password) => 
  api.post(`/profiles/${profileId}/verify`, { password });

export const logoutProfile = () => {
  localStorage.removeItem('nexus_active_profile');
  localStorage.removeItem('nexus_active_profile_name');
  localStorage.removeItem('nexus_active_profile_color');
  // Optional: Clear any cached data
  window.location.reload();
};

// Helper: Get current active profile ID
export const getActiveProfileId = () => 
  localStorage.getItem('nexus_active_profile') || 'default';