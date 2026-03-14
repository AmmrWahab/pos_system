// src/routes/reports.js
import { Router } from 'express';
import { getReports } from '../controllers/reports.controller.js';

const router = Router();
router.get('/:range', getReports); // daily | weekly | yearly
export default router;
