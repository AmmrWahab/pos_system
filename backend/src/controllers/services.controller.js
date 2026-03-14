// src/controllers/services.controller.js
import { ObjectId } from 'mongodb';

// ── Get all services ───────────────────────────────────
export const getAllServices = async (req, res, next) => {
  try {
    const services = await req.db.collection('services')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    res.json(services);
  } catch (e) { next(e); }
};

// ── Get service by ID ─────────────────────────────────
export const getService = async (req, res, next) => {
  try {
    const s = await req.db.collection('services').findOne({ _id: req.params.id });
    if (!s) return res.status(404).json({ error: 'Service not found' });
    res.json(s);
  } catch (e) { next(e); }
};

// ── Create a service ──────────────────────────────────
export const createService = async (req, res, next) => {
  try {
    const { name, sku, category, price } = req.body;
    if (!name || !sku || !price) return res.status(400).json({ error: 'name, sku, price required' });

    // Check for duplicate SKU
    const exists = await req.db.collection('services').findOne({ sku });
    if (exists) return res.status(409).json({ error: 'SKU already exists' });

    const service = {
      _id: String(new Date().getTime()) + Math.random().toString(36).slice(2,6), // simple unique ID
      name,
      sku,
      category: category || 'Other',
      price: Number(price),
      createdAt: new Date(),
    };

    await req.db.collection('services').insertOne(service);
    res.status(201).json(service);
  } catch (e) { next(e); }
};

// ── Update service ───────────────────────────────────
export const updateService = async (req, res, next) => {
  try {
    const { name, sku, category, price } = req.body;

    // Check if service exists
    const s = await req.db.collection('services').findOne({ _id: req.params.id });
    if (!s) return res.status(404).json({ error: 'Service not found' });

    // Check SKU conflict
    if (sku && sku !== s.sku) {
      const conflict = await req.db.collection('services').findOne({ sku });
      if (conflict) return res.status(409).json({ error: 'SKU already exists' });
    }

    const updated = await req.db.collection('services').findOneAndUpdate(
      { _id: req.params.id },
      { $set: { name, sku, category, price: Number(price) } },
      { returnDocument: 'after' }
    );

    res.json(updated.value);
  } catch (e) { next(e); }
};

// ── Delete service ───────────────────────────────────
export const deleteService = async (req, res, next) => {
  try {
    const result = await req.db.collection('services').deleteOne({ _id: req.params.id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Service not found' });
    res.json({ message: 'Service deleted' });
  } catch (e) { next(e); }
};
