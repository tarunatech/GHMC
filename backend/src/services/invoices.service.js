import prisma from '../config/database.js';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors.js';

/**
 * Invoices Service
 * Handles all invoice-related business logic
 */

class InvoicesService {
  /**
   * Generate invoice number
   * Format: INV-YY-YY-XXXX (Financial Year format)
   * Example: FY 2026-27 -> INV-26-27-0001
   * @param {Date|string} date - Invoice date to determine FY
   * @param {object} tx - Prisma transaction object (optional)
   * @returns {Promise<string>} Invoice number
   */
  async generateInvoiceNo(date = new Date(), tx = prisma) {
    const invoiceDate = new Date(date);
    // Transition strictly from April 1st, 2026
    const transitionDate = new Date('2026-04-01');
    let prefix;

    if (invoiceDate < transitionDate) {
      // Maintain legacy format until April 1st, 2026
      // In the legacy system, the prefix was typically 'INV-YYYYMM' literally from settings
      const setting = await tx.setting.findUnique({
        where: { key: 'invoice_number_format' },
      });
      const year = invoiceDate.getFullYear();
      const month = String(invoiceDate.getMonth() + 1).padStart(2, '0');
      prefix = setting?.value || `INV-${year}${month}`;
    } else {
      // Apply new Financial Year format from April 1st, 2026
      const month = invoiceDate.getMonth(); // 0-11
      const year = invoiceDate.getFullYear();

      let startYear, endYear;
      if (month < 3) { // Jan, Feb, Mar (0, 1, 2)
        startYear = year - 1;
        endYear = year;
      } else { // Apr to Dec (3-11)
        startYear = year;
        endYear = year + 1;
      }

      const fyDisplay = `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
      prefix = `INV-${fyDisplay}`;
    }

    // Find last invoice with the determined prefix to maintain sequence continuity
    const lastInvoice = await tx.invoice.findFirst({
      where: {
        invoiceNo: {
          startsWith: prefix,
        },
      },
      orderBy: { invoiceNo: 'desc' },
      select: { invoiceNo: true },
    });

    let nextNum = 1;
    if (lastInvoice?.invoiceNo) {
      const parts = lastInvoice.invoiceNo.split('-');
      const lastNumStr = parts[parts.length - 1];
      const lastNum = parseInt(lastNumStr) || 0;
      nextNum = lastNum + 1;
    }

    return `${prefix}-${String(nextNum).padStart(4, '0')}`;
  }

  /**
   * Get GST rates from settings
   * @returns {Promise<{cgst: number, sgst: number}>}
   */
  async getGSTRates() {
    const [cgstSetting, sgstSetting] = await Promise.all([
      prisma.setting.findUnique({ where: { key: 'cgst_rate' } }),
      prisma.setting.findUnique({ where: { key: 'sgst_rate' } }),
    ]);

    return {
      cgst: cgstSetting?.value ? parseFloat(cgstSetting.value) : 9, // Default 9%
      sgst: sgstSetting?.value ? parseFloat(sgstSetting.value) : 9, // Default 9%
    };
  }

  /**
   * Validate that inward entries are not already linked to another invoice
   * @param {string[]} entryIds - Array of entry IDs to check
   * @param {string} [currentInvoiceId] - Optional current invoice ID (for updates)
   * @throws {ConflictError} If any entry is already linked
   */
  async _validateInwardEntries(entryIds, currentInvoiceId = null) {
    if (!entryIds || entryIds.length === 0) return;

    const entries = await prisma.inwardEntry.findMany({
      where: {
        id: { in: entryIds },
        invoiceId: { not: null },
      },
      select: {
        id: true,
        manifestNo: true,
        invoice: {
          select: {
            id: true,
            invoiceNo: true,
          }
        }
      }
    });

    for (const entry of entries) {
      // If currentInvoiceId is provided, allow linking to THIS invoice (it's an update)
      // If not provided (create), ANY link is invalid
      if (currentInvoiceId && entry.invoice.id === currentInvoiceId) {
        continue;
      }

      throw new ConflictError(
        `Manifest ${entry.manifestNo} is already linked to invoice ${entry.invoice.invoiceNo}`
      );
    }
  }

  /**
   * Calculate invoice totals
   * @param {number} subtotal - Subtotal amount
   * @param {object} options - Options for calculation
   * @returns {Promise<{cgst: number, sgst: number, grandTotal: number}>}
   */
  async calculateTotals(subtotal, options = {}) {
    const { cgstRate, sgstRate, additionalCharges = 0 } = options;

    let cgst = 0;
    let sgst = 0;

    const baseForTax = subtotal + additionalCharges;

    if (cgstRate !== undefined && sgstRate !== undefined) {
      cgst = (baseForTax * cgstRate) / 100;
      sgst = (baseForTax * sgstRate) / 100;
    } else {
      const rates = await this.getGSTRates();
      cgst = (baseForTax * rates.cgst) / 100;
      sgst = (baseForTax * rates.sgst) / 100;
    }

    const roundedCgst = Math.round(cgst);
    const roundedSgst = Math.round(sgst);
    const grandTotal = baseForTax + roundedCgst + roundedSgst;

    return {
      cgst: roundedCgst,
      sgst: roundedSgst,
      grandTotal: parseFloat(grandTotal.toFixed(2)),
    };
  }

  /**
   * Determine invoice status based on payment
   * @param {number} paymentReceived - Payment received
   * @param {number} grandTotal - Grand total
   * @returns {string} Status: 'paid', 'partial', or 'pending'
   */
  getStatus(paymentReceived, grandTotal) {
    // Use partial tolerance for float precision issues
    const epsilon = 0.01;
    if (paymentReceived >= grandTotal - epsilon) return 'paid';
    if (paymentReceived > 0) return 'partial';
    return 'pending';
  }

  /**
   * Get all invoices with pagination, search, and filters
   * @param {object} options - Query options
   * @returns {Promise<{invoices: array, pagination: object}>}
   */
  async getAllInvoices(options = {}) {
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
    } = options;

    const skip = (page - 1) * limit;
    const take = parseInt(limit);

    // Build where clause
    const where = {};

    if (search) {
      where.OR = [
        { invoiceNo: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (type) {
      where.type = type;
    }

    if (status) {
      if (status.includes(',')) {
        where.status = {
          in: status.split(',').map(s => s.trim())
        };
      } else {
        where.status = status;
      }
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    if (companyId) {
      where.companyId = companyId;
    }

    if (transporterId) {
      where.transporterId = transporterId;
    }

    // Get invoices and total count
    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              gstNumber: true,
            },
          },
          transporter: {
            select: {
              id: true,
              name: true,
              gstNumber: true,
            },
          },
          invoiceManifests: {
            select: {
              manifestNo: true,
            },
          },
          invoiceMaterials: {
            select: {
              id: true,
              materialName: true,
              rate: true,
              unit: true,
              quantity: true,
              amount: true,
              manifestNo: true,
              isAdditionalCharge: true,
            },
          },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    return {
      invoices,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  /**
   * Get invoice by ID
   * @param {string} invoiceId - Invoice ID
   * @returns {Promise<object>} Invoice
   */
  async getInvoiceById(invoiceId) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            contact: true,
            email: true,
            gstNumber: true,
          },
        },
        transporter: {
          select: {
            id: true,
            transporterId: true,
            name: true,
            contact: true,
            address: true,
            email: true,
            gstNumber: true,
          },
        },
        invoiceManifests: {
          select: {
            id: true,
            manifestNo: true,
          },
        },
        invoiceMaterials: {
          select: {
            id: true,
            materialName: true,
            rate: true,
            unit: true,
            quantity: true,
            amount: true,
            manifestNo: true,
            description: true,
            isAdditionalCharge: true,
          },
        },
        inwardEntries: {
          select: {
            id: true,
            srNo: true,
            date: true,
            lotNo: true,
            manifestNo: true,
            wasteName: true,
            quantity: true,
            unit: true,
          },
        },
        outwardEntries: {
          select: {
            id: true,
            srNo: true,
            date: true,
            manifestNo: true,
            cementCompany: true,
            quantity: true,
            unit: true,
          },
        },
      },
    });

    if (invoice) {
      console.log('DEBUG: getInvoiceById retrieved:', {
        id: invoice.id,
        additionalChargesQuantity: invoice.additionalChargesQuantity,
        additionalChargesRate: invoice.additionalChargesRate,
        additionalChargesUnit: invoice.additionalChargesUnit
      });
    }

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    return invoice;
  }

  /**
   * Create invoice
   * @param {object} invoiceData - Invoice data
   * @returns {Promise<object>} Created invoice
   */
  async createInvoice(invoiceData) {
    const {
      type,
      date = new Date(),
      companyId,
      transporterId,
      customerName,
      invoiceNo: explicitInvoiceNo,
      materials = [],
      manifestNos = [],
      inwardEntryIds = [],
      outwardEntryIds = [],
      subtotal,
      cgstRate,
      sgstRate,
      gstNo,
      billedTo,
      shippedTo,
      description,
      additionalCharges,
      additionalChargesDescription,
      additionalChargesQuantity,
      additionalChargesRate,
      additionalChargesUnit,
      paymentReceived,
      paymentReceivedOn,
      additionalChargesList = [],
      poNo,
      poDate,
      vehicleNo,
      customKey,
      customValue,
    } = invoiceData;

    // Validate type
    if (!['Inward', 'Outward', 'Transporter'].includes(type)) {
      throw new ValidationError('Invalid invoice type. Must be Inward, Outward, or Transporter');
    }

    // Validate company or transporter
    if (type === 'Inward' && !companyId) {
      throw new ValidationError('Company ID is required for Inward invoices');
    }

    if ((type === 'Outward' || type === 'Transporter') && !transporterId) {
      throw new ValidationError('Transporter ID is required for Outward/Transporter invoices');
    }

    // Validate inward entries are not already linked
    if (inwardEntryIds.length > 0) {
      await this._validateInwardEntries(inwardEntryIds);
    }

    // Attempt to create the invoice with thread-safe number generation
    let attempts = 0;
    const maxAttempts = 5;
    let lastError = null;

    while (attempts < maxAttempts) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          // 1. Generate or use explicit invoice number
          let finalInvoiceNo = explicitInvoiceNo;

          if (explicitInvoiceNo) {
            const existing = await tx.invoice.findUnique({
              where: { invoiceNo: explicitInvoiceNo },
              select: { id: true },
            });
            if (existing) {
              // Link entries to existing invoice and return it
              if (inwardEntryIds.length > 0) {
                await tx.inwardEntry.updateMany({
                  where: { id: { in: inwardEntryIds } },
                  data: { invoiceId: existing.id },
                });
              }
              if (outwardEntryIds.length > 0) {
                await tx.outwardEntry.updateMany({
                  where: { id: { in: outwardEntryIds } },
                  data: { invoiceId: existing.id },
                });
              }
              return { id: existing.id };
            }
          } else {
            // Generate next available number for the given date's financial year
            finalInvoiceNo = await this.generateInvoiceNo(date, tx);
          }

          // 2. Calculate totals
          const calculatedSubtotal = subtotal || materials.reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);
          const initialAdditionalCharges = additionalChargesList.length > 0
            ? additionalChargesList.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0)
            : (additionalCharges ? parseFloat(additionalCharges) : 0);

          const rates = await this.getGSTRates();
          const activeCgstRate = cgstRate !== undefined ? cgstRate : rates.cgst;
          const activeSgstRate = sgstRate !== undefined ? sgstRate : rates.sgst;

          const baseForTax = calculatedSubtotal + initialAdditionalCharges;
          const cgst = Math.round((baseForTax * activeCgstRate) / 100);
          const sgst = Math.round((baseForTax * activeSgstRate) / 100);
          const grandTotal = parseFloat((baseForTax + cgst + sgst).toFixed(2));

          // 3. Determine status
          const initialPayment = paymentReceived ? parseFloat(paymentReceived) : 0;
          const status = this.getStatus(initialPayment, grandTotal);

          // 4. Get customer name if not provided
          let finalCustomerName = customerName;
          if (!finalCustomerName) {
            if (companyId) {
              const company = await tx.company.findUnique({
                where: { id: companyId },
                select: { name: true },
              });
              finalCustomerName = company?.name;
            } else if (transporterId) {
              const transporter = await tx.transporter.findUnique({
                where: { id: transporterId },
                select: { name: true },
              });
              finalCustomerName = transporter?.name;
            }
          }

          // 5. Create invoice
          const createdInvoice = await tx.invoice.create({
            data: {
              invoiceNo: finalInvoiceNo,
              type,
              date: new Date(date),
              companyId: companyId || null,
              transporterId: transporterId || null,
              customerName: finalCustomerName,
              subtotal: calculatedSubtotal,
              cgst: cgst,
              sgst: sgst,
              grandTotal: grandTotal,
              paymentReceived: initialPayment,
              paymentReceivedOn: paymentReceivedOn ? new Date(paymentReceivedOn) : null,
              status,
              gstNo: gstNo || null,
              billedTo: billedTo || null,
              shippedTo: shippedTo || null,
              description: description || null,
              additionalCharges: initialAdditionalCharges,
              additionalChargesDescription: additionalChargesDescription || null,
              additionalChargesQuantity: additionalChargesQuantity ? parseFloat(additionalChargesQuantity) : 0,
              additionalChargesRate: additionalChargesRate ? parseFloat(additionalChargesRate) : 0,
              additionalChargesUnit: additionalChargesUnit || null,
              poNo: poNo || null,
              poDate: poDate ? new Date(poDate) : null,
              vehicleNo: vehicleNo || null,
              customKey: customKey || null,
              customValue: customValue || null,
              invoiceManifests: {
                create: manifestNos.map((manifestNo) => ({
                  manifestNo,
                })),
              },
              invoiceMaterials: {
                create: [
                  ...materials.map((material) => ({
                    materialName: material.materialName,
                    rate: material.rate ? parseFloat(material.rate) : null,
                    unit: material.unit || null,
                    quantity: material.quantity ? parseFloat(material.quantity) : null,
                    amount: material.amount ? parseFloat(material.amount) : null,
                    manifestNo: material.manifestNo || null,
                    description: material.description || null,
                    isAdditionalCharge: false,
                  })),
                  ...additionalChargesList.map((charge) => ({
                    materialName: charge.description || 'Additional Charge',
                    rate: charge.rate ? parseFloat(charge.rate) : null,
                    unit: charge.unit || null,
                    quantity: charge.quantity ? parseFloat(charge.quantity) : null,
                    amount: charge.amount ? parseFloat(charge.amount) : null,
                    description: charge.description || null,
                    isAdditionalCharge: true,
                  })),
                ],
              },
            },
          });

          // 6. Update related entries with invoice ID
          if (inwardEntryIds.length > 0) {
            await tx.inwardEntry.updateMany({
              where: { id: { in: inwardEntryIds } },
              data: { invoiceId: createdInvoice.id },
            });
          }

          if (outwardEntryIds.length > 0) {
            await tx.outwardEntry.updateMany({
              where: { id: { in: outwardEntryIds } },
              data: { invoiceId: createdInvoice.id },
            });
          }

          return { id: createdInvoice.id };
        }, {
          isolationLevel: 'Serializable'
        });

        // Fetch and return the fully populated invoice
        return this.getInvoiceById(result.id);
      } catch (error) {
        // Handle unique constraint violation for invoiceNo (P2002)
        if (error.code === 'P2002' && error.meta?.target?.includes('invoice_no')) {
          attempts++;
          lastError = error;
          await new Promise(resolve => setTimeout(resolve, 50 * attempts));
          continue;
        }
        throw error;
      }
    }

    throw lastError || new Error('Failed to create invoice after multiple attempts due to numbering conflicts');
  }

  /**
   * Ensure an invoice exists for outward entries by a given invoice number.
   * If exists, links outward entries; if not, creates a new invoice using provided data.
   */
  async ensureInvoiceForOutward({
    invoiceNo,
    date,
    transporterId,
    customerName,
    materials = [],
    manifestNos = [],
    outwardEntryIds = [],
    subtotal,
    cgstRate,
    sgstRate,
    paymentReceived,
    paymentReceivedOn,
    gstNo,
    billedTo,
    shippedTo,
    description,
  }) {
    if (!invoiceNo) {
      throw new ValidationError('Invoice number is required');
    }
    // Reuse createInvoice with explicit invoiceNo override and type Outward
    return this.createInvoice({
      type: 'Outward',
      date,
      transporterId,
      customerName,
      invoiceNo,
      materials,
      manifestNos,
      outwardEntryIds,
      subtotal,
      cgstRate,
      sgstRate,
      paymentReceived,
      paymentReceivedOn,
      gstNo,
      billedTo,
      shippedTo,
      description,
    });
  }

  /**
   * Update invoice
   * @param {string} invoiceId - Invoice ID
   * @param {object} updateData - Update data
   * @returns {Promise<object>} Updated invoice
   */
  async updateInvoice(invoiceId, updateData) {
    const invoice = await this.getInvoiceById(invoiceId);

    const {
      date,
      customerName,
      materials = null,
      manifestNos = null,
      subtotal,
      cgstRate,
      sgstRate,
      paymentReceived,
      paymentReceivedOn,
      gstNo,
      billedTo,
      shippedTo,
      description,
      additionalCharges,
      additionalChargesDescription,
      additionalChargesQuantity,
      additionalChargesRate,
      additionalChargesUnit,
      inwardEntryIds,
      additionalChargesList = null,
      poNo,
      poDate,
      vehicleNo,
      customKey,
      customValue,
    } = updateData;


    // Validate inward entries if they are being updated
    if (inwardEntryIds && inwardEntryIds.length > 0) {
      await this._validateInwardEntries(inwardEntryIds, invoiceId);
    }

    // Calculate new totals if subtotal changed
    let totals = {
      cgst: invoice.cgst,
      sgst: invoice.sgst,
      grandTotal: invoice.grandTotal,
    };

    const newSubtotal = subtotal !== undefined
      ? subtotal
      : materials?.reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0) || invoice.subtotal;

    const newAdditionalCharges = additionalChargesList !== null
      ? additionalChargesList.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0)
      : (additionalCharges !== undefined ? parseFloat(additionalCharges) : parseFloat(invoice.additionalCharges || 0));

    totals = await this.calculateTotals(newSubtotal, {
      cgstRate,
      sgstRate,
      additionalCharges: newAdditionalCharges
    });

    // Update status based on payment
    const status = this.getStatus(
      paymentReceived !== undefined ? parseFloat(paymentReceived) : parseFloat(invoice.paymentReceived),
      totals.grandTotal
    );

    // Prepare update data
    const data = {
      date: date ? new Date(date) : undefined,
      customerName,
      subtotal: subtotal !== undefined ? subtotal : undefined,
      cgst: totals.cgst,
      sgst: totals.sgst,
      grandTotal: totals.grandTotal,
      paymentReceived: paymentReceived !== undefined ? parseFloat(paymentReceived) : undefined,
      paymentReceivedOn: paymentReceivedOn !== undefined ? (paymentReceivedOn ? new Date(paymentReceivedOn) : null) : undefined,
      status,
      gstNo,
      billedTo,
      shippedTo,
      description,
      additionalCharges: additionalCharges !== undefined ? parseFloat(additionalCharges) : undefined,
      additionalChargesDescription,
      additionalChargesQuantity: additionalChargesQuantity !== undefined ? parseFloat(additionalChargesQuantity) : undefined,
      additionalChargesRate: additionalChargesRate !== undefined ? parseFloat(additionalChargesRate) : undefined,
      additionalChargesUnit,
      poNo,
      poDate: poDate !== undefined ? (poDate ? new Date(poDate) : null) : undefined,
      vehicleNo,
      customKey,
      customValue,
    };

    // Remove undefined values
    Object.keys(data).forEach((key) => {
      if (data[key] === undefined) delete data[key];
    });

    // Update invoice
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data,
      include: {
        company: true,
        transporter: true,
        invoiceManifests: true,
        invoiceMaterials: true,
      },
    });

    // Update materials and additional charges if provided
    if (materials !== null || additionalChargesList !== null) {
      // Delete existing entries (both materials and charges)
      await prisma.invoiceMaterial.deleteMany({
        where: { invoiceId },
      });

      const finalMaterials = materials || invoice.invoiceMaterials?.filter(m => !m.isAdditionalCharge) || [];
      const finalCharges = additionalChargesList || invoice.invoiceMaterials?.filter(m => m.isAdditionalCharge) || [];

      // Create new items
      const createData = [
        ...finalMaterials.map((m) => ({
          invoiceId,
          materialName: m.materialName,
          rate: m.rate ? parseFloat(m.rate) : null,
          unit: m.unit || null,
          quantity: m.quantity ? parseFloat(m.quantity) : null,
          amount: m.amount ? parseFloat(m.amount) : null,
          manifestNo: m.manifestNo || null,
          description: m.description || null,
          isAdditionalCharge: false,
        })),
        ...finalCharges.map((c) => ({
          invoiceId,
          materialName: c.materialName || c.description || 'Additional Charge',
          rate: c.rate ? parseFloat(c.rate) : null,
          unit: c.unit || null,
          quantity: c.quantity ? parseFloat(c.quantity) : null,
          amount: c.amount ? parseFloat(c.amount) : null,
          description: c.description || null,
          isAdditionalCharge: true,
        })),
      ];

      if (createData.length > 0) {
        await prisma.invoiceMaterial.createMany({
          data: createData,
        });
      }
    }

    // Update manifests if provided
    if (manifestNos !== null) {
      // Delete existing manifests
      await prisma.invoiceManifest.deleteMany({
        where: { invoiceId },
      });

      // Create new manifests
      if (manifestNos.length > 0) {
        await prisma.invoiceManifest.createMany({
          data: manifestNos.map((manifestNo) => ({
            invoiceId,
            manifestNo,
          })),
        });
      }
    }

    // Update related inward entries if provided (Append/Consolidate Logic)
    if (updateData.inwardEntryIds) {
      // 1. Unlink all current entries for this invoice first to ensure a clean state
      await prisma.inwardEntry.updateMany({
        where: { invoiceId },
        data: { invoiceId: null },
      });

      // 2. Link only the provided entries
      if (updateData.inwardEntryIds.length > 0) {
        await prisma.inwardEntry.updateMany({
          where: {
            id: { in: updateData.inwardEntryIds },
          },
          data: {
            invoiceId,
          },
        });
      }
    }

    return this.getInvoiceById(invoiceId);
  }

  /**
   * Update invoice payment
   * @param {string} invoiceId - Invoice ID
   * @param {object} paymentData - Payment data
   * @returns {Promise<object>} Updated invoice
   */
  async updatePayment(invoiceId, paymentData) {
    const invoice = await this.getInvoiceById(invoiceId);

    if (invoice.status === 'cancelled') {
      throw new ValidationError('Cannot record payment for a cancelled invoice');
    }

    const { paymentReceived, paymentReceivedOn } = paymentData;

    const newPaymentReceived = parseFloat(paymentReceived) || 0;
    const status = this.getStatus(newPaymentReceived, parseFloat(invoice.grandTotal));

    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        paymentReceived: newPaymentReceived,
        paymentReceivedOn: paymentReceivedOn ? new Date(paymentReceivedOn) : null,
        status,
      },
      include: {
        company: true,
        transporter: true,
      },
    });

    return updatedInvoice;
  }

  /**
   * Cancel invoice
   * @param {string} invoiceId - Invoice ID
   * @param {object} options - Cancellation options ({ cancellationReason, userId })
   * @returns {Promise<object>} Cancelled invoice
   */
  async cancelInvoice(invoiceId, options = {}) {
    const { cancellationReason, userId } = options;

    if (!cancellationReason || !cancellationReason.trim()) {
      throw new ValidationError('Cancellation reason is required');
    }

    const invoice = await this.getInvoiceById(invoiceId);
    if (!invoice) {
      throw new NotFoundError('Invoice');
    }

    if (invoice.status === 'cancelled') {
      throw new ConflictError('Invoice is already cancelled');
    }

    const cancelledInvoice = await prisma.$transaction(async (tx) => {
      // 1. Soft cancel invoice with metadata
      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancellationReason: cancellationReason.trim(),
          cancelledBy: userId || null,
        },
        include: {
          company: true,
          transporter: true,
          invoiceManifests: true,
          invoiceMaterials: true,
          inwardEntries: true,
          outwardEntries: true,
        },
      });

      // 2. Safe Entry Release Logic for Inward Entries:
      // An inward entry is only released (invoiceId = null) if it is NOT referenced/claimed
      // by any other active (status !== 'cancelled') invoice.
      const linkedInwardEntries = await tx.inwardEntry.findMany({
        where: { invoiceId },
        select: { id: true, manifestNo: true },
      });

      const inwardToReleaseIds = [];
      for (const entry of linkedInwardEntries) {
        let isClaimedByOtherActive = false;
        if (entry.manifestNo) {
          const activeManifestMatch = await tx.invoiceManifest.findFirst({
            where: {
              manifestNo: entry.manifestNo,
              invoiceId: { not: invoiceId },
              invoice: { status: { not: 'cancelled' } },
            },
          });
          if (activeManifestMatch) {
            isClaimedByOtherActive = true;
          } else {
            const activeMaterialMatch = await tx.invoiceMaterial.findFirst({
              where: {
                manifestNo: entry.manifestNo,
                invoiceId: { not: invoiceId },
                invoice: { status: { not: 'cancelled' } },
              },
            });
            if (activeMaterialMatch) {
              isClaimedByOtherActive = true;
            }
          }
        }

        if (!isClaimedByOtherActive) {
          inwardToReleaseIds.push(entry.id);
        }
      }

      if (inwardToReleaseIds.length > 0) {
        await tx.inwardEntry.updateMany({
          where: { id: { in: inwardToReleaseIds } },
          data: { invoiceId: null },
        });
      }

      // 3. Safe Entry Release Logic for Outward Entries:
      const linkedOutwardEntries = await tx.outwardEntry.findMany({
        where: { invoiceId },
        select: { id: true, manifestNo: true },
      });

      const outwardToReleaseIds = [];
      for (const entry of linkedOutwardEntries) {
        let isClaimedByOtherActive = false;
        if (entry.manifestNo) {
          const activeManifestMatch = await tx.invoiceManifest.findFirst({
            where: {
              manifestNo: entry.manifestNo,
              invoiceId: { not: invoiceId },
              invoice: { status: { not: 'cancelled' } },
            },
          });
          if (activeManifestMatch) {
            isClaimedByOtherActive = true;
          } else {
            const activeMaterialMatch = await tx.invoiceMaterial.findFirst({
              where: {
                manifestNo: entry.manifestNo,
                invoiceId: { not: invoiceId },
                invoice: { status: { not: 'cancelled' } },
              },
            });
            if (activeMaterialMatch) {
              isClaimedByOtherActive = true;
            }
          }
        }

        if (!isClaimedByOtherActive) {
          outwardToReleaseIds.push(entry.id);
        }
      }

      if (outwardToReleaseIds.length > 0) {
        await tx.outwardEntry.updateMany({
          where: { id: { in: outwardToReleaseIds } },
          data: { invoiceId: null },
        });
      }

      return updated;
    });

    return cancelledInvoice;
  }

  /**
   * Delete invoice
   * @param {string} invoiceId - Invoice ID
   * @returns {Promise<void>}
   */
  async deleteInvoice(invoiceId) {
    const invoice = await this.getInvoiceById(invoiceId);

    // Unlink from entries
    await Promise.all([
      prisma.inwardEntry.updateMany({
        where: { invoiceId },
        data: { invoiceId: null },
      }),
      prisma.outwardEntry.updateMany({
        where: { invoiceId },
        data: { invoiceId: null },
      }),
    ]);

    // Delete invoice (cascade will delete materials and manifests)
    await prisma.invoice.delete({
      where: { id: invoiceId },
    });
  }

  /**
   * Get invoice statistics
   * @param {object} filter - Optional filter options
   * @returns {Promise<object>} Statistics
   */
  async getStats(filter = {}) {
    const { type } = filter;
    const where = {};
    if (type) {
      where.type = type;
    }

    const whereActive = {
      ...where,
      status: { not: 'cancelled' },
    };

    const [
      totalInvoices,
      totalInvoiced,
      totalReceived,
      byType,
      byStatus,
    ] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.aggregate({
        where: whereActive,
        _sum: { grandTotal: true },
      }),
      prisma.invoice.aggregate({
        where: whereActive,
        _sum: { paymentReceived: true },
      }),
      prisma.invoice.groupBy({
        where: whereActive,
        by: ['type'],
        _sum: {
          grandTotal: true,
          paymentReceived: true,
        },
        _count: true,
      }),
      prisma.invoice.groupBy({
        where,
        by: ['status'],
        _sum: {
          grandTotal: true,
          paymentReceived: true,
        },
        _count: true,
      }),
    ]);

    const totalPending = parseFloat(totalInvoiced._sum.grandTotal || 0) - parseFloat(totalReceived._sum.paymentReceived || 0);

    return {
      totalInvoices,
      totalInvoiced: parseFloat(totalInvoiced._sum.grandTotal || 0),
      totalReceived: parseFloat(totalReceived._sum.paymentReceived || 0),
      totalPending,
      byType: byType.map((item) => ({
        type: item.type,
        count: item._count,
        totalInvoiced: parseFloat(item._sum.grandTotal || 0),
        totalReceived: parseFloat(item._sum.paymentReceived || 0),
      })),
      byStatus: byStatus.map((item) => ({
        status: item.status,
        count: item._count,
        totalInvoiced: parseFloat(item._sum.grandTotal || 0),
        totalReceived: parseFloat(item._sum.paymentReceived || 0),
      })),
    };
  }
}

export default new InvoicesService();

