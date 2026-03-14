import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  sku: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  barcode: {
    type: String,
    unique: true,
    sparse: true, // allows null/undefined
    trim: true
  },
  category: {
    type: String,
    default: 'Other'
  },
  cost: {
    type: Number,
    default: 0
  },
  price: {
    type: Number,
    required: true
  },
  stock: {
    type: Number,
    default: 0
  },
}, {
  timestamps: true, // createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual field for Margin
productSchema.virtual('margin').get(function() {
  if (!this.price || !this.cost) return 0;
  return Math.round(((this.price - this.cost) / this.price) * 100); // percentage
});

export default mongoose.model('Product', productSchema);
