// src/controllers/transactions.controller.js
import { ObjectId } from 'mongodb';

// ✅ HELPER: Safely convert string to ObjectId
const toObjectId = (id) => {
  if (!id) return null;
  if (id instanceof ObjectId) return id;
  if (typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)) {
    return new ObjectId(id);
  }
  return null; // Invalid format - prevents crash
};

// Add this helper at top (same as products):
const getBranchId = async (db, profileId) => {
  if (!profileId) return 'default';
  const profile = await db.collection('profiles').findOne({ _id: profileId });
  return profile?.branchId || profile?.name?.toLowerCase().replace(/\s+/g, '-') || 'default';
};

// ── Get all transactions ───────────────────────────────
export const getAllTransactions = async (req, res, next) => {
  try {
    const { search, type, payment, limit = 100 } = req.query;
    const profileId = req.headers['x-profile-id'];
    
    // ✅ Build query: own branch + linked branch (if any)
    const profiles = await req.db.collection('profiles').find({}).toArray();
    const profile = profiles.find(p => p._id === profileId);
    const branchIds = [await getBranchId(req.db, profileId)];
    if (profile?.linkedTo) {
      const linkedBranch = await getBranchId(req.db, profile.linkedTo);
      branchIds.push(linkedBranch);
    }
    
    const query = { 
      branchId: { $in: branchIds },  // ✅ Cross-branch read
      ...(type && { type }),
      ...(payment && { payment }),
      ...(search && { _id: { $regex: search.toUpperCase() } })
    };

    const txs = await req.db.collection('transactions')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .toArray();

    res.json(txs);
  } catch (e) { next(e); }
};

// ── Get single transaction ────────────────────────────
export const getTransaction = async (req, res, next) => {
  try {
    // Transactions use string IDs, not ObjectId
    const tx = await req.db.collection('transactions').findOne({ _id: req.params.id });
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    res.json(tx);
  } catch (e) { next(e); }
};

// ── Create a transaction ──────────────────────────────
// Create Transaction - Use immutable branchId (UUID)
export const createTransaction = async (req, res, next) => {
  try {
    const { type = 'Product', payment = 'Cash', items } = req.body;
    if (!items?.length) return res.status(400).json({ error: 'items array is required' });

    const profileId = req.headers['x-profile-id'];
    const profiles = await req.db.collection('profiles').find({}).toArray();
    const profile = profiles.find(p => p._id === profileId);
    const branchId = profile?.branchId; // ✅ UUID
    if (!branchId) return res.status(400).json({ error: 'Invalid profile' });

    let total = items.reduce((s, i) => s + i.price * i.qty, 0);

    if (type === 'Product') {
      // Check stock in accessible branches (by UUID)
      const accessibleBranches = [branchId];
      if (profile?.linkedTo) {
        const linked = profiles.find(p => p._id === profile.linkedTo);
        if (linked?.branchId) accessibleBranches.push(linked.branchId);
      }

      for (const item of items) {
        if (item.productId) {
          const objectId = toObjectId(item.productId);
          if (!objectId) continue;
          
          const product = await req.db.collection('products').findOne({ 
            _id: objectId, 
            branchId: { $in: accessibleBranches }  // ✅ UUID-based query
          });
          if (!product) return res.status(404).json({ error: `Product ${item.productId} not found` });
          if (product.stock < item.qty) return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
        }
      }

      // Deduct stock (only from own branch by UUID)
      for (const item of items) {
        if (item.productId) {
          const objectId = toObjectId(item.productId);
          if (objectId) {
            await req.db.collection('products').updateOne(
              { _id: objectId, branchId },  // ✅ UUID-based update
              { $inc: { stock: -item.qty } }
            );
          }
        }
      }
    }

    const tx = {
      _id: String(new Date().getTime()) + Math.random().toString(36).slice(2, 6),
      type,
      payment,
      total,
      branchId,              // ✅ Store immutable UUID
      items: items.map(i => ({
        productId: i.productId || null,
        serviceId: i.serviceId || null,
        name: i.name,
        qty: i.qty,
        price: i.price
      })),
      createdAt: new Date(),
    };

    await req.db.collection('transactions').insertOne(tx);
    res.status(201).json({ ...tx, id: tx._id });
  } catch (e) { next(e); }
};

// ── Update a transaction ──────────────────────────────
export const updateTransaction = async (req, res, next) => {
  try {
    const { payment, type, items } = req.body;
    const id = req.params.id;

    // Transactions use string IDs, so no ObjectId conversion needed
    const existing = await req.db.collection('transactions').findOne({ _id: id });
    if (!existing) return res.status(404).json({ error: 'Transaction not found' });

    let newTotal = existing.total;
    if (items) newTotal = items.reduce((s, i) => s + Number(i.price) * Number(i.qty), 0);

    // Replace items if provided
    const updated = {
      ...(payment && { payment }),
      ...(type && { type }),
      total: newTotal,
      ...(items && { 
        items: items.map(i => ({
          productId: i.productId || null,
          serviceId: i.serviceId || null,
          name: i.name,
          qty: i.qty,
          price: i.price
        })) 
      })
    };

    const result = await req.db.collection('transactions').findOneAndUpdate(
      { _id: id },
      { $set: updated },
      { returnDocument: 'after' }
    );

    res.json(result.value);
  } catch (e) { next(e); }
};

// ── Delete a transaction ──────────────────────────────
export const deleteTransaction = async (req, res, next) => {
  try {
    // Transactions use string IDs, so no ObjectId conversion needed
    const result = await req.db.collection('transactions').deleteOne({ _id: req.params.id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Transaction not found' });
    res.json({ message: 'Transaction deleted' });
  } catch (e) { next(e); }
};