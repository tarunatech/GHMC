import express from 'express';
import invoicesController from '../controllers/invoices.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/role.middleware.js';
import { validate, createInvoiceSchema, updateInvoiceSchema, updateInvoicePaymentSchema } from '../utils/validators.js';
import multer from 'multer';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Invoices Routes
 * All routes require authentication
 */

// Get all invoices
router.get('/', authenticate, authorize(['superadmin', 'admin']), invoicesController.getAllInvoices.bind(invoicesController));

// Get invoice statistics
router.get('/stats', authenticate, authorize(['superadmin', 'admin']), invoicesController.getStats.bind(invoicesController));

// Get invoice by ID
router.get('/:id', authenticate, authorize(['superadmin', 'admin']), invoicesController.getInvoiceById.bind(invoicesController));

// Create invoice
router.post(
  '/',
  authenticate,
  authorize(['superadmin']),
  validate(createInvoiceSchema),
  invoicesController.createInvoice.bind(invoicesController)
);

// Update invoice
router.put(
  '/:id',
  authenticate,
  authorize(['superadmin']),
  validate(updateInvoiceSchema),
  invoicesController.updateInvoice.bind(invoicesController)
);

// Update invoice payment
router.put(
  '/:id/payment',
  authenticate,
  authorize(['superadmin']),
  validate(updateInvoicePaymentSchema),
  invoicesController.updatePayment.bind(invoicesController)
);

// Delete invoice
router.delete('/:id', authenticate, authorize(['superadmin']), invoicesController.deleteInvoice.bind(invoicesController));

// Upload invoice PDF to R2
router.post(
  '/:id/upload',
  authenticate,
  authorize(['superadmin', 'admin']),
  upload.single('invoice'),
  invoicesController.uploadInvoice.bind(invoicesController)
);

export default router;

