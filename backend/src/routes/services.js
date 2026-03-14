// src/routes/services.js
import { Router } from 'express';
import { getAllServices, getService, createService, updateService, deleteService } from '../controllers/services.controller.js';

const router = Router();

router.get('/',       getAllServices);
router.get('/:id',    getService);
router.post('/',      createService);
router.put('/:id',    updateService);
router.delete('/:id', deleteService);

export default router;
