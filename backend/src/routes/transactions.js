// src/routes/transactions.js
import { Router } from 'express';
import { getAllTransactions, getTransaction, createTransaction, updateTransaction, deleteTransaction } from '../controllers/transactions.controller.js';

const router = Router();

router.get('/',       getAllTransactions);
router.get('/:id',    getTransaction);
router.post('/',      createTransaction);
router.put('/:id',    updateTransaction);
router.delete('/:id', deleteTransaction);

export default router;
