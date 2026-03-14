// src/db.js
import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILES_FILE = path.join(__dirname, '../profiles.json');

// Read profiles.json
function readProfiles() {
  try {
    return JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf8'));
  } catch {
    return [];
  }
}

// Resolve profile → MongoDB connection URI
export function resolveDbUri(profileId) {
  const profiles = readProfiles();
  let profile = profiles.find(p => p.id === profileId);
  if (!profile) {
    // Default URI if no profile found
    return process.env.DATABASE_URL || 'mongodb+srv://<username>:<password>@cluster0.mongodb.net/nexuspos';
  }

  const visited = new Set();
  while (profile.linkedTo) {
    if (visited.has(profile.id)) break;
    visited.add(profile.id);
    const parent = profiles.find(p => p.id === profile.linkedTo);
    if (!parent) break;
    profile = parent;
  }

  return profile.mongoUri || process.env.DATABASE_URL;

}

// Cache for MongoClient instances
const clientCache = new Map();

// Get or create MongoClient for a profile
export async function getMongoClient(profileId) {
  const uri = resolveDbUri(profileId);
  if (clientCache.has(uri)) return clientCache.get(uri);

  const client = new MongoClient(uri);
  await client.connect();
  console.log(`✅ Connected to MongoDB → ${uri}`);
  clientCache.set(uri, client);
  return client;
}

// Middleware for Express
export async function mongoMiddleware(req, res, next) {
  const profileId = req.headers['x-profile-id'] || 'default';
  req.mongoClient = await getMongoClient(profileId);
  req.db = req.mongoClient.db(); // default DB from URI
  next();
}

