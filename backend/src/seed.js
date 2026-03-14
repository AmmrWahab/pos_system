// backend/mongoSeed.js
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const client = new MongoClient(process.env.DATABASE_URL);

async function main() {
  await client.connect();
  const db = client.db();

  // Clear old data
  await db.collection('transactions').deleteMany({});
  await db.collection('products').deleteMany({});
  await db.collection('services').deleteMany({});

  // Products
  const charger = { name: 'Charger', sku: 'ALCD11', category: 'Electronics', price: 3000, stock: 20 };
  const cable   = { name: 'Cables C-type', sku: 'ALLD2', category: 'Electronics', price: 650, stock: 50 };
  const mouse   = { name: 'Wireless Mouse', sku: 'ALLD3', category: 'Electronics', price: 2000, stock: 30 };
  const products = [charger, cable, mouse];
  await db.collection('products').insertMany(products);

  // Services
  const services = [
    { name: 'Phone Repair', sku: 'SRV01', category: 'Repair', price: 15000 },
    { name: 'Screen Replacement', sku: 'SRV02', category: 'Repair', price: 45000 },
    { name: 'Software Install', sku: 'SRV03', category: 'Software', price: 5000 },
  ];
  await db.collection('services').insertMany(services);

  console.log('✅ MongoDB seed complete!');
  await client.close();
}

main().catch(console.error);
