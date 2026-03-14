// src/routes/profiles.js - FIXED VERSION
import { Router } from 'express';
import {
  getProfiles,
  createProfile,
  updateProfile,      // ✅ Ensure this is imported
  deleteProfile,
  linkProfile,
  unlinkProfile,
  getActiveProfile,
  verifyProfilePassword,
} from '../controllers/profiles.controller.js';

const router = Router();

// ✅ All routes including PUT for update
router.get('/',              getProfiles);
router.get('/active',        getActiveProfile);
router.post('/',             createProfile);
router.put('/:id',           updateProfile);        // ✅ THIS WAS MISSING!
router.post('/:id/verify',   verifyProfilePassword);
router.post('/:id/link',     linkProfile);
router.delete('/:id/link',   unlinkProfile);
router.delete('/:id',        deleteProfile);

export default router;