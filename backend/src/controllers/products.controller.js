// src/controllers/products.controller.js
import { ObjectId } from 'mongodb';
import Product from '../models/Product.js';

// ✅ HELPER: Safely convert string to ObjectId
const toObjectId = (id) => {
  if (!id) return null;
  if (id instanceof ObjectId) return id;
  if (typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)) {
    return new ObjectId(id);
  }
  return null; // Invalid format - prevents crash
};

// Add this helper at top of file:
const getBranchId = async (db, profileId) => {
  if (!profileId) return null;
  const profile = await db.collection('profiles').findOne({ _id: profileId });
  return profile?.branchId || null; // ✅ Returns immutable UUID
};

// Helper for search + category filtering
function buildFilter(query) {
  const { search, category } = query;
  const filter = {};

  if (search) {
    const regex = new RegExp(search, 'i');
    filter.$or = [
      { name: regex },
      { sku: regex },
      { barcode: regex },
    ];
  }

  if (category && category !== 'All') {
    filter.category = category;
  }

  return filter;
}

// Get Products - Query by UUID, but return profile name for UI
export const getAllProducts = async (req, res, next) => {
  try {
    const profileId = req.headers['x-profile-id'];
    const profiles = await req.db.collection('profiles').find({}).toArray();
    const profile = profiles.find(p => p._id === profileId);
    
    // ✅ Build query using IMMUTABLE branchId (UUID)
    const branchIds = [profile?.branchId];
    if (profile?.linkedTo) {
      const linked = profiles.find(p => p._id === profile.linkedTo);
      if (linked?.branchId) branchIds.push(linked.branchId);
    }
    
    const filter = { branchId: { $in: branchIds }, ...buildFilter(req.query) };
    
    const products = await req.db.collection('products')
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    // ✅ Enrich products with CURRENT profile name (for display)
    const productsWithMeta = products.map(p => ({
      ...p,
      margin: p.price ? Math.round(((p.price - p.cost) / p.price) * 100) : 0,
      // Optional: Add current profile name for UI (not stored in DB)
      profileName: profiles.find(pr => pr.branchId === p.branchId)?.name || 'Unknown'
    }));

    res.json(productsWithMeta);
  } catch (e) { next(e); }
};
// ── Get product by barcode ──────────────────────────────────────────────────
export const getProductByBarcode = async (req, res, next) => {
  try {
    const product = await req.db.collection('products').findOne({ barcode: req.params.barcode });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    res.json({
      ...product,
      margin: product.price ? Math.round(((product.price - product.cost) / product.price) * 100) : 0
    });
  } catch (e) { next(e); }
};

// ── Get product by ID ───────────────────────────────────────────────────────
export const getProduct = async (req, res, next) => {
  try {
    const objectId = toObjectId(req.params.id);
    if (!objectId) return res.status(400).json({ error: 'Invalid product ID format' });
    
    const product = await req.db.collection('products').findOne({ _id: objectId });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    res.json({
      ...product,
      margin: product.price ? Math.round(((product.price - product.cost) / product.price) * 100) : 0
    });
  } catch (e) { next(e); }
};

// ── Create new product ──────────────────────────────────────────────────────
export const createProduct = async (req, res, next) => {
  try {
    const { name, sku, barcode, category, cost, price, stock } = req.body;
    if (!name || !sku || !price) return res.status(400).json({ error: 'name, sku, and price are required' });

    const profileId = req.headers['x-profile-id'];
    const branchId = await getBranchId(req.db, profileId); // ✅ UUID
    if (!branchId) return res.status(400).json({ error: 'Invalid profile' });

    // Check uniqueness within same branch (by UUID)
    const existing = await req.db.collection('products').findOne({
      branchId,  // ✅ UUID-based query
      $or: [{ sku }, { barcode }]
    });
    if (existing) return res.status(409).json({ error: 'SKU or barcode already exists' });

    const product = {
      name, sku, barcode, category, 
      cost: Number(cost) || 0, 
      price: Number(price), 
      stock: Number(stock) || 0,
      branchId,              // ✅ Store immutable UUID
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await req.db.collection('products').insertOne(product);
    res.status(201).json({ 
      _id: result.insertedId, 
      ...product, 
      margin: product.price ? Math.round(((product.price - product.cost) / product.price) * 100) : 0 
    });
  } catch (e) { next(e); }
};


// ── Update product ──────────────────────────────────────────────────────────
export const updateProduct = async (req, res, next) => {
  try {
    const { name, sku, barcode, category, cost, price, stock } = req.body;
    const id = req.params.id;

    const objectId = toObjectId(id);
    if (!objectId) return res.status(400).json({ error: 'Invalid product ID format' });

    // Check if SKU/barcode conflicts with another product
    const conflict = await req.db.collection('products').findOne({
      _id: { $ne: objectId },
      $or: [{ sku }, { barcode }]
    });
    if (conflict) return res.status(409).json({ error: 'SKU or barcode already exists' });

    // ✅ FIX: Use compatible options for findOneAndUpdate
    const result = await req.db.collection('products').findOneAndUpdate(
      { _id: objectId },
      { $set: { 
          name, 
          sku, 
          barcode: barcode || null, 
          category, 
          cost: Number(cost) || 0, 
          price: Number(price), 
          stock: Number(stock) || 0 
        } 
      },
      { 
        // ✅ Compatible with both old & new MongoDB drivers:
        returnDocument: 'after',    // New driver (4.0+)
        returnOriginal: false,      // Old driver (<4.0) - fallback
        upsert: false               // Don't create if not found
      }
    );

    // ✅ Better handling: result could be { value: doc } OR just doc depending on driver
    const updatedProduct = result?.value || result;
    
    if (!updatedProduct) {
      console.error('❌ Update returned null:', { result, id });
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({
      ...updatedProduct,
      margin: updatedProduct.price ? Math.round(((updatedProduct.price - updatedProduct.cost) / updatedProduct.price) * 100) : 0
    });
  } catch (e) { 
    console.error('💥 updateProduct error:', e);
    next(e); 
  }
};

// ── Delete product ──────────────────────────────────────────────────────────
export const deleteProduct = async (req, res, next) => {
  try {
    const objectId = toObjectId(req.params.id);
    if (!objectId) return res.status(400).json({ error: 'Invalid product ID format' });
    
    const result = await req.db.collection('products').deleteOne({ _id: objectId });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (e) { next(e); }
};

// ── Adjust stock ───────────────────────────────────────────────────────────
export const adjustStock = async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (typeof amount !== 'number') return res.status(400).json({ error: 'Amount must be a number' });

    const objectId = toObjectId(req.params.id);
    if (!objectId) return res.status(400).json({ error: 'Invalid product ID format' });

    const result = await req.db.collection('products').findOneAndUpdate(
      { _id: objectId },
      { $inc: { stock: amount } },
      { 
        returnDocument: 'after',
        returnOriginal: false,
        upsert: false
      }
    );

    const updatedProduct = result?.value || result;
    if (!updatedProduct) return res.status(404).json({ error: 'Product not found' });

    res.json({
      ...updatedProduct,
      margin: updatedProduct.price ? Math.round(((updatedProduct.price - updatedProduct.cost) / updatedProduct.price) * 100) : 0
    });
  } catch (e) { next(e); }
};