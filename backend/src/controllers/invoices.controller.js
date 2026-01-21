import invoicesService from '../services/invoices.service.js';
import { ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { uploadFile } from '../utils/storage.js';

/**
 * Invoices Controller
 * Handles HTTP requests for invoice operations
 */

class InvoicesController {
  /**
   * Get all invoices
   * GET /api/invoices
   */
  async getAllInvoices(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        search = '',
        type = '',
        status = '',
        startDate = '',
        endDate = '',
        companyId = '',
        transporterId = '',
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      const result = await invoicesService.getAllInvoices({
        page: parseInt(page),
        limit: parseInt(limit),
        search,
        type,
        status,
        startDate,
        endDate,
        companyId,
        transporterId,
        sortBy,
        sortOrder,
      });

      res.json({
        success: true,
        data: result.invoices,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Error fetching invoices:', error);
      next(error);
    }
  }

  /**
   * Get invoice by ID
   * GET /api/invoices/:id
   */
  async getInvoiceById(req, res, next) {
    try {
      const { id } = req.params;
      const invoice = await invoicesService.getInvoiceById(id);

      res.json({
        success: true,
        data: { invoice },
      });
    } catch (error) {
      logger.error('Error fetching invoice:', error);
      next(error);
    }
  }

  /**
   * Create invoice
   * POST /api/invoices
   */
  async createInvoice(req, res, next) {
    try {
      const invoice = await invoicesService.createInvoice(req.body);

      res.status(201).json({
        success: true,
        message: 'Invoice created successfully',
        data: { invoice },
      });
    } catch (error) {
      logger.error('Error creating invoice:', error);
      next(error);
    }
  }

  /**
   * Update invoice
   * PUT /api/invoices/:id
   */
  async updateInvoice(req, res, next) {
    try {
      const { id } = req.params;
      const invoice = await invoicesService.updateInvoice(id, req.body);

      res.json({
        success: true,
        message: 'Invoice updated successfully',
        data: { invoice },
      });
    } catch (error) {
      logger.error('Error updating invoice:', error);
      next(error);
    }
  }

  /**
   * Update invoice payment
   * PUT /api/invoices/:id/payment
   */
  async updatePayment(req, res, next) {
    try {
      const { id } = req.params;
      const { paymentReceived, paymentReceivedOn } = req.body;

      if (paymentReceived === undefined) {
        throw new ValidationError('Payment received amount is required');
      }

      const invoice = await invoicesService.updatePayment(id, {
        paymentReceived,
        paymentReceivedOn,
      });

      res.json({
        success: true,
        message: 'Payment updated successfully',
        data: { invoice },
      });
    } catch (error) {
      logger.error('Error updating payment:', error);
      next(error);
    }
  }

  /**
   * Delete invoice
   * DELETE /api/invoices/:id
   */
  async deleteInvoice(req, res, next) {
    try {
      const { id } = req.params;
      await invoicesService.deleteInvoice(id);

      res.json({
        success: true,
        message: 'Invoice deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting invoice:', error);
      next(error);
    }
  }

  /**
   * Get invoice statistics
   * GET /api/invoices/stats
   */
  async getStats(req, res, next) {
    try {
      const { type } = req.query;
      const stats = await invoicesService.getStats({ type });

      res.json({
        success: true,
        data: { stats },
      });
    } catch (error) {
      logger.error('Error fetching invoice stats:', error);
      next(error);
    }
  }

  /**
   * Upload invoice PDF to storage
   * POST /api/invoices/:id/upload
   */
  async uploadInvoice(req, res, next) {
    try {
      const { id } = req.params;
      const file = req.file;

      if (!file) {
        throw new ValidationError('No file uploaded');
      }

      const invoice = await invoicesService.getInvoiceById(id);
      const fileName = `invoices/${invoice.invoiceNo}_${Date.now()}.pdf`;

      const fileUrl = await uploadFile(file.buffer, fileName, file.mimetype);

      // Optionally update the invoice in DB with the URL if you add the field later
      // For now, we just return the URL
      res.json({
        success: true,
        message: 'Invoice uploaded successfully',
        data: {
          url: fileUrl,
          fileName: fileName
        },
      });
    } catch (error) {
      logger.error('Error uploading invoice:', error);
      next(error);
    }
  }
}

export default new InvoicesController();

