import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.DATABASE_URL;

if (!MONGO_URI) {
    console.error('❌ DATABASE_URL is not set in environment variables');
    process.exit(1);
}

const clientCache = new Map();

export async function getMongoClient() {
    if (clientCache.has(MONGO_URI)) {
        return clientCache.get(MONGO_URI);
    }
    
    try {
        console.log('🔗 Connecting to MongoDB...');
        
        // ✅ Add SSL/TLS options for Atlas + Node.js v22
        const client = new MongoClient(MONGO_URI, {
            serverSelectionTimeoutMS: 15000,  // 15 seconds
            socketTimeoutMS: 45000,
            connectTimeoutMS: 15000,
            tls: true,
            tlsAllowInvalidCertificates: false,
            maxPoolSize: 10,
            minPoolSize: 5,
            retryWrites: true,
            retryReads: true,
        });
        
        await client.connect();
        
        // ✅ Test connection with ping
        await client.db().admin().ping();
        console.log('✅ MongoDB connected successfully');
        
        clientCache.set(MONGO_URI, client);
        return client;
    } catch (error) {
        console.error('❌ MongoDB connection failed:', {
            message: error.message,
            code: error.code,
            name: error.name
        });
        throw error;  // Re-throw so Render knows startup failed
    }
}

export async function mongoMiddleware(req, res, next) {
    try {
        const client = await getMongoClient();
        req.db = client.db();
        next();
    } catch (error) {
        console.error('❌ DB middleware error:', error.message);
        res.status(503).json({ 
            error: 'Database connection failed',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}