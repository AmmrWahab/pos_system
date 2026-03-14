// src/controllers/profiles.controller.js
import { v4 as uuid } from 'uuid';

// ── Helpers ─────────────────────────────────────────────

/**
 * Resolve the effective database URI for a profile
 * Follows linkedTo chain to find the root profile's dbUri
 * @param {Object} profile - The profile to resolve
 * @param {Array} allProfiles - All profiles for lookup
 * @returns {string|null} The resolved dbUri or null
 */
function resolveDb(profile, allProfiles) {
  if (!profile?.linkedTo) {
    return profile?.dbUri || null;
  }
  
  // Find the linked profile (handle both string and ObjectId _id)
  const parent = allProfiles.find(p => {
    const pid = p._id?.toString?.() || p._id;
    const linked = profile.linkedTo.toString?.() || profile.linkedTo;
    return pid === linked;
  });
  
  if (parent) {
    return resolveDb(parent, allProfiles);
  }
  
  // Fallback to own dbUri if linked profile not found
  return profile.dbUri || null;
}

/**
 * Normalize profile for API response
 * Ensures consistent field names and adds resolvedDb
 * @param {Object} profile - Raw profile from DB
 * @param {Array} allProfiles - All profiles for resolveDb
 * @returns {Object} Normalized profile for frontend
 */
function normalizeProfile(profile, allProfiles) {
  if (!profile) return null;
  
  return {
    ...profile,
    // Ensure both id formats for frontend compatibility
    id: profile._id,
    _id: profile._id,
    // Add resolved database URI
    resolvedDb: resolveDb(profile, allProfiles || [])
  };
}

// ── Get all profiles ─────────────────────────────────────
export const getProfiles = async (req, res, next) => {
  try {
    const profiles = await req.db.collection('profiles').find({}).toArray();
    
    // Normalize all profiles with resolvedDb
    const normalized = profiles.map(p => normalizeProfile(p, profiles));
    
    res.json(normalized);
  } catch (e) {
    console.error('❌ getProfiles error:', e);
    next(e);
  }
};

// ── Create profile ───────────────────────────────────────
export const createProfile = async (req, res, next) => {
  try {
    const { name, storeName, currency = 'USh', color = '#16a34a', dbUri, password } = req.body;
    
    // Validation
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Profile name is required' });
    }
    if (!password || password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    // ✅ Generate IMMUTABLE branchId (UUID) - never changes even if name changes
    const branchId = uuid();
    
    // Simple password hashing (replace with bcrypt in production)
    const passwordHash = Buffer.from(password).toString('base64');

    const newProfile = {
      _id: uuid(),              // Profile's unique ID
      branchId,                 // ✅ IMMUTABLE: Used in products/transactions
      name: name.trim(),        // ✅ MUTABLE: Can be changed later
      storeName: storeName?.trim() || name.trim(),
      currency,
      color,
      dbUri: dbUri || process.env.DATABASE_URL,
      linkedTo: null,
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await req.db.collection('profiles').insertOne(newProfile);
    
    // Return normalized profile (simple resolvedDb for create)
    res.status(201).json({
      ...newProfile,
      id: newProfile._id,  // Frontend compatibility
      resolvedDb: newProfile.dbUri  // Simple, no complex lookup needed
    });
    
  } catch (e) {
    console.error('❌ createProfile error:', e);
    
    // Handle duplicate key errors
    if (e.code === 11000) {
      return res.status(409).json({ error: 'Profile with this name already exists' });
    }
    
    next(e);
  }
};

// ── Verify profile password ──────────────────────────────
export const verifyProfilePassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    const profileId = req.params.id;
    
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    
    // Find profile (handle both UUID string and ObjectId)
    const profile = await req.db.collection('profiles').findOne({ _id: profileId });
    
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    // Simple password check (replace with bcrypt.compare in production)
    const inputHash = Buffer.from(password).toString('base64');
    const isValid = inputHash === profile.passwordHash;
    
    res.json({ 
      success: true, 
      valid: isValid,
      profile: {
        id: profile._id,
        name: profile.name,
        storeName: profile.storeName,
        color: profile.color
      }
    });
    
  } catch (e) {
    console.error('❌ verifyProfilePassword error:', e);
    next(e);
  }
};

// ── Update profile ───────────────────────────────────────
export const updateProfile = async (req, res, next) => {
  try {
    const { name, storeName, currency, color, dbUri, password } = req.body;
    const profileId = req.params.id;
    
    console.log('🔍 updateProfile request:', { 
      profileId, 
      updates: { name, storeName, currency, color, hasPassword: !!password } 
    });

    // ✅ Build update object (only include fields that are provided & valid)
    const updateFields = {};
    if (name !== undefined && name.trim() !== '') updateFields.name = name.trim();
    if (storeName !== undefined) updateFields.storeName = storeName?.trim() ?? storeName;
    if (currency !== undefined) updateFields.currency = currency;
    if (color !== undefined) updateFields.color = color;
    if (dbUri !== undefined) updateFields.dbUri = dbUri;
    
    // ✅ Handle password update (only if new password provided)
    if (password && password.trim() !== '') {
      if (password.length < 4) {
        return res.status(400).json({ error: 'Password must be at least 4 characters' });
      }
      updateFields.passwordHash = Buffer.from(password).toString('base64');
    }
    
    // ✅ Handle updatedAt
    updateFields.updatedAt = new Date();

    // ✅ Find and update profile
    // Support both new & old MongoDB driver response formats
    const result = await req.db.collection('profiles').findOneAndUpdate(
      { _id: profileId },
      { $set: updateFields },
      { 
        returnDocument: 'after',    // MongoDB Driver 4.0+
        returnOriginal: false,      // MongoDB Driver <4.0 fallback
        upsert: false 
      }
    );

    // ✅ Handle BOTH driver response formats:
    // New driver (4.0+): { value: doc, lastErrorObject: {...} }
    // Old driver (<4.0): doc (returned directly)
    const updatedProfile = result?.value || result;
    
    if (!updatedProfile) {
      console.warn('⚠️ Profile not found for update:', profileId);
      return res.status(404).json({ error: 'Profile not found' });
    }

    console.log('✅ Profile updated successfully:', {
      id: updatedProfile._id,
      name: updatedProfile.name,
      branchId: updatedProfile.branchId  // Should remain unchanged
    });

    // ✅ FIXED: Return simple response WITHOUT complex resolveDb
    // Frontend already has full profiles list, it can compute resolvedDb if needed
    // This avoids crashes when resolveDb is called with partial data
    res.json({
      ...updatedProfile,
      id: updatedProfile._id,  // Frontend compatibility
      // Simple resolvedDb - no dependency on allProfiles array
      resolvedDb: updatedProfile.dbUri || process.env.DATABASE_URL
    });
    
  } catch (e) {
    console.error('💥 updateProfile error:', e);
    
    // Handle duplicate key errors (if name uniqueness enforced)
    if (e.code === 11000) {
      return res.status(409).json({ error: 'Profile name already exists' });
    }
    
    next(e);
  }
};

// ── Link profile ─────────────────────────────────────────
export const linkProfile = async (req, res, next) => {
  try {
    const { targetId } = req.body;
    const profileId = req.params.id;
    
    if (!targetId) {
      return res.status(400).json({ error: 'targetId is required' });
    }
    if (targetId === profileId) {
      return res.status(400).json({ error: 'Cannot link profile to itself' });
    }

    // Fetch all profiles for validation and circular check
    const allProfiles = await req.db.collection('profiles').find({}).toArray();
    
    // Find current and target profiles (handle both string and ObjectId)
    const profile = allProfiles.find(p => {
      const pid = p._id?.toString?.() || p._id;
      const searchId = profileId.toString?.() || profileId;
      return pid === searchId;
    });
    
    const target = allProfiles.find(p => {
      const pid = p._id?.toString?.() || p._id;
      const searchId = targetId.toString?.() || targetId;
      return pid === searchId;
    });

    if (!profile) {
      return res.status(404).json({ error: 'Source profile not found' });
    }
    if (!target) {
      return res.status(404).json({ error: 'Target profile not found' });
    }

    // ✅ Circular link detection: ensure target doesn't already link back to source
    let check = target;
    const visited = new Set();
    
    while (check?.linkedTo) {
      // Prevent infinite loops
      if (visited.has(check._id?.toString?.() || check._id)) {
        break;
      }
      visited.add(check._id?.toString?.() || check._id);
      
      const linkedId = check.linkedTo.toString?.() || check.linkedTo;
      if (linkedId === profileId) {
        return res.status(400).json({ error: 'Circular link detected: cannot create loop' });
      }
      
      check = allProfiles.find(p => {
        const pid = p._id?.toString?.() || p._id;
        return pid === linkedId;
      });
    }

    // Perform the link update
    await req.db.collection('profiles').updateOne(
      { _id: profileId },
      { 
        $set: { 
          linkedTo: targetId,
          updatedAt: new Date()
        } 
      }
    );

    // Return updated profile with simple resolvedDb
    const updatedProfile = { ...profile, linkedTo: targetId, updatedAt: new Date() };
    
    res.json({
      ...updatedProfile,
      id: updatedProfile._id,
      resolvedDb: resolveDb(updatedProfile, allProfiles)
    });
    
  } catch (e) {
    console.error('❌ linkProfile error:', e);
    next(e);
  }
};

// ── Unlink profile ───────────────────────────────────────
export const unlinkProfile = async (req, res, next) => {
  try {
    const profileId = req.params.id;
    
    const result = await req.db.collection('profiles').findOneAndUpdate(
      { _id: profileId },
      { 
        $set: { 
          linkedTo: null,
          updatedAt: new Date()
        } 
      },
      { 
        returnDocument: 'after',
        returnOriginal: false
      }
    );

    // Handle both driver formats
    const updatedProfile = result?.value || result;
    
    if (!updatedProfile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({
      ...updatedProfile,
      id: updatedProfile._id,
      resolvedDb: updatedProfile.dbUri  // After unlink, uses own dbUri
    });
    
  } catch (e) {
    console.error('❌ unlinkProfile error:', e);
    next(e);
  }
};

// ── Delete profile ───────────────────────────────────────
export const deleteProfile = async (req, res, next) => {
  try {
    const profileId = req.params.id;
    
    // ✅ First: Unlink any profiles that were linked TO this profile
    await req.db.collection('profiles').updateMany(
      { linkedTo: profileId },
      { 
        $set: { 
          linkedTo: null,
          updatedAt: new Date()
        } 
      }
    );

    // ✅ Then: Delete the profile itself
    const result = await req.db.collection('profiles').deleteOne({ _id: profileId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // ✅ Optional: Log deletion for audit
    console.log('🗑 Profile deleted:', { profileId, linkedProfilesUnlinked: result.modifiedCount });
    
    res.json({ 
      success: true, 
      message: 'Profile deleted successfully',
      deletedId: profileId
    });
    
  } catch (e) {
    console.error('❌ deleteProfile error:', e);
    next(e);
  }
};

// ── Get active profile from headers ──────────────────────
export const getActiveProfile = async (req, res, next) => {
  try {
    const profileId = req.headers['x-profile-id'];
    
    if (!profileId) {
      return res.status(400).json({ error: 'No active profile specified in headers' });
    }

    // Find the active profile
    const profile = await req.db.collection('profiles').findOne({ _id: profileId });
    
    if (!profile) {
      return res.status(404).json({ error: 'Active profile not found' });
    }

    // Fetch all profiles for resolveDb calculation
    const allProfiles = await req.db.collection('profiles').find({}).toArray();
    
    // Return normalized profile with resolvedDb
    res.json(normalizeProfile(profile, allProfiles));
    
  } catch (e) {
    console.error('❌ getActiveProfile error:', e);
    next(e);
  }
};