import prisma from '../config/database.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { roundValue } from '../utils/math.js';

/**
 * Inward Materials Service
 * Handles inward material (transporter record) business logic
 */

class InwardMaterialsService {
  /**
   * Get all inward materials with pagination and filters
   * @param {object} options - Query options
   * @returns {Promise<{materials: array, pagination: object}>}
   */
  async getAllMaterials(options = {}) {
    const {
      page = 1,
      limit = 20,
      inwardEntryId = '',
      search = '',
      sortBy = 'updatedAt',
      sortOrder = 'desc',
    } = options;

    const skip = (page - 1) * limit;
    const take = parseInt(limit);

    // Build where clause
    const where = {};

    if (inwardEntryId) {
      where.inwardEntryId = inwardEntryId;
    }

    if (search) {
      where.OR = [
        { manifestNo: { contains: search, mode: 'insensitive' } },
        { transporterName: { contains: search, mode: 'insensitive' } },
        { wasteName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get materials and total count
    const [materials, total] = await Promise.all([
      prisma.inwardMaterial.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        include: {
          inwardEntry: {
            select: {
              id: true,
              lotNo: true,
              manifestNo: true,
              month: true,
              company: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.inwardMaterial.count({ where }),
    ]);

    return {
      materials,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
        hasNext: page * take < total,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Get inward material by ID
   * @param {string} materialId - Material ID
   * @returns {Promise<object>} Material object
   */
  async getMaterialById(materialId) {
    const material = await prisma.inwardMaterial.findUnique({
      where: { id: materialId },
      include: {
        inwardEntry: {
          include: {
            company: true,
          },
        },
      },
    });

    if (!material) {
      throw new NotFoundError('Inward material');
    }

    return material;
  }

  /**
   * Create inward material record
   * @param {object} materialData - Material data
   * @returns {Promise<object>} Created material
   */
  async createMaterial(materialData) {
    const {
      inwardEntryId,
      date,
      lotNo,
      companyId,
      manifestNo,
      vehicleNo,
      wasteName,
      category,
      quantity,
      unit,
      transporterName,
      invoiceNo,
      vehicleCapacity,
      rate,
      amount,
      detCharges,
      gst,
      grossAmount,
      month,
      paidOn,
    } = materialData;

    logger.info('Creating inward material with data:', JSON.stringify({
      inwardEntryId,
      transporterName,
      quantity,
      rate,
      amount,
      grossAmount
    }));

    // Validate required fields
    if (!transporterName) {
      throw new ValidationError('Transporter name is required');
    }

    // If inwardEntryId provided, verify it exists
    if (inwardEntryId) {
      const entry = await prisma.inwardEntry.findUnique({
        where: { id: inwardEntryId },
      });

      if (!entry) {
        throw new NotFoundError('Inward entry');
      }
    }

    // Parse numeric fields safely with rounding
    const safeRate = roundValue(rate);
    const safeQuantity = roundValue(quantity);
    let safeAmount = roundValue(amount);
    const safeDetCharges = roundValue(detCharges);
    const safeGst = roundValue(gst);
    let safeGrossAmount = roundValue(grossAmount);

    // Parse Vehicle Capacity safely for calculation
    const safeVehicleCapacity = roundValue(vehicleCapacity);

    // Backend Failsafe: Calculate Amount if missing but Rate & Vehicle Capacity exist
    // Formula changed: Amount = Rate * Vehicle Capacity (was Quantity)
    if (safeAmount === null && safeRate !== null && safeVehicleCapacity !== null) {
      safeAmount = roundValue(safeRate * safeVehicleCapacity);
      logger.info(`Backend auto-calculated Amount: ${safeAmount} from Rate: ${safeRate} * VehCap: ${safeVehicleCapacity}`);
    }

    // Backend Failsafe: Calculate Gross Amount if missing but components exist
    // We calculate if we have at least an Amount (provided or calculated)
    if (safeGrossAmount === null) {
      const baseForGross = safeAmount || 0;
      const detForGross = safeDetCharges || 0;
      const gstForGross = safeGst || 0;
      // Only calculate if at least one component is non-zero/valid, to avoid auto-filling 0 on completely empty records unless intended
      if (safeAmount !== null || safeDetCharges !== null || safeGst !== null) {
        safeGrossAmount = roundValue(baseForGross + detForGross + gstForGross);
        logger.info(`Backend auto-calculated GrossAmount: ${safeGrossAmount}`);
      }
    }

    // Build safe data object
    const data = {
      inwardEntryId: inwardEntryId || null,
      srNo: materialData.srNo || null,
      date: date ? new Date(date) : null,
      lotNo: lotNo?.trim() || null,
      companyId: companyId || null,
      manifestNo: manifestNo?.trim() || null,
      vehicleNo: vehicleNo?.trim() || null,
      wasteName: wasteName?.trim() || null,
      category: category?.trim() || null,
      month: month?.trim() || null,
      quantity: safeQuantity,
      unit: unit?.trim() || null,
      transporterName: transporterName?.trim() || '',
      invoiceNo: invoiceNo?.trim() || null,
      vehicleCapacity: safeVehicleCapacity !== null ? String(safeVehicleCapacity) : null,
      rate: safeRate,
      amount: safeAmount,
      detCharges: safeDetCharges,
      gst: safeGst,
      grossAmount: safeGrossAmount,
      paidOn: paidOn ? new Date(paidOn) : null,
    };

    logger.info('Creating inward material with safe data:', JSON.stringify(data));

    // Create material
    const material = await prisma.inwardMaterial.create({
      data,
      include: {
        inwardEntry: {
          include: {
            company: true,
          },
        },
      },
    });

    return material;
  }

  /**
   * Update inward material
   * @param {string} materialId - Material ID
   * @param {object} updateData - Data to update
   * @returns {Promise<object>} Updated material
   */
  async updateMaterial(materialId, updateData) {
    // Prepare safe values with rounding
    let safeRate = undefined;
    if (updateData.rate !== undefined) safeRate = roundValue(updateData.rate);

    let safeQuantity = undefined;
    if (updateData.quantity !== undefined) safeQuantity = roundValue(updateData.quantity);

    let safeAmount = undefined;
    if (updateData.amount !== undefined) safeAmount = roundValue(updateData.amount);

    let safeDetCharges = undefined;
    if (updateData.detCharges !== undefined) safeDetCharges = roundValue(updateData.detCharges);

    let safeGst = undefined;
    if (updateData.gst !== undefined) safeGst = roundValue(updateData.gst);

    let safeGrossAmount = undefined;
    if (updateData.grossAmount !== undefined) safeGrossAmount = roundValue(updateData.grossAmount);

    // Failsafe Logic for Updates:
    // If we are updating Rate or Quantity, but NOT Amount, we should recalculate Amount based on new/existing values.
    // However, we don't know existing values here easily without fetching.
    // Since we called `getMaterialById` above, we actually DO have access to current state, but `getMaterialById` return value isn't captured in a variable in the original code.
    // Correct Fix: Capture existing material.
    const existingMaterial = await this.getMaterialById(materialId);

    const finalRate = safeRate !== undefined ? safeRate : Number(existingMaterial.rate);
    const finalVehicleCapacity = (updateData.vehicleCapacity !== undefined) ? roundValue(updateData.vehicleCapacity) : Number(existingMaterial.vehicleCapacity || 0);

    // Auto-calc Amount if:
    // 1. Amount is MISSING in update (undefined) - use calc
    // 2. OR Amount is explicitly set to NULL - use calc (assume user wants reset/recalc)
    // 3. BUT only if Rate and VehCap are valid numbers
    if ((safeAmount === undefined || safeAmount === null) && finalRate && finalVehicleCapacity) {
      // If amount was NOT sent, we check if Rate or VehCap changed. If yes, we SHOULD recalc.
      // If neither changed, we keep existing Amount.
      // If explicitly sent as NULL, we recalc.
      const shouldRecalc = safeAmount === null || safeRate !== undefined || updateData.vehicleCapacity !== undefined;

      if (shouldRecalc) {
        safeAmount = roundValue(finalRate * finalVehicleCapacity);
        logger.info(`Backend UPDATE auto-calculated Amount: ${safeAmount} from Rate: ${finalRate} * VehCap: ${finalVehicleCapacity}`);
      }
    }

    const finalAmount = safeAmount !== undefined ? safeAmount : Number(existingMaterial.amount);
    const finalDet = safeDetCharges !== undefined ? safeDetCharges : Number(existingMaterial.detCharges || 0);
    const finalGst = safeGst !== undefined ? safeGst : Number(existingMaterial.gst || 0);

    // Auto-calc Gross if:
    // 1. Gross is MISSING/NULL
    // 2. AND we have valid components (either new or existing)
    if ((safeGrossAmount === undefined || safeGrossAmount === null)) {
      const shouldRecalcGross = safeGrossAmount === null || safeAmount !== undefined || safeDetCharges !== undefined || safeGst !== undefined;

      if (shouldRecalcGross) {
        safeGrossAmount = roundValue((finalAmount || 0) + finalDet + finalGst);
        logger.info(`Backend UPDATE auto-calculated Gross: ${safeGrossAmount}`);
      }
    }

    const updateMap = {};
    if (updateData.inwardEntryId !== undefined) updateMap.inwardEntryId = updateData.inwardEntryId || null;
    if (updateData.date !== undefined) updateMap.date = updateData.date ? new Date(updateData.date) : null;
    if (updateData.lotNo !== undefined) updateMap.lotNo = updateData.lotNo?.trim() || null;
    if (updateData.manifestNo !== undefined) updateMap.manifestNo = updateData.manifestNo?.trim() || null;
    if (updateData.vehicleNo !== undefined) updateMap.vehicleNo = updateData.vehicleNo?.trim() || null;
    if (updateData.wasteName !== undefined) updateMap.wasteName = updateData.wasteName?.trim() || null;
    if (updateData.category !== undefined) updateMap.category = updateData.category?.trim() || null;
    if (updateData.month !== undefined) updateMap.month = updateData.month?.trim() || null;
    if (safeQuantity !== undefined) updateMap.quantity = safeQuantity;
    if (updateData.unit !== undefined) updateMap.unit = updateData.unit?.trim() || null;
    if (updateData.transporterName !== undefined) updateMap.transporterName = updateData.transporterName?.trim() || '';
    if (updateData.invoiceNo !== undefined) updateMap.invoiceNo = updateData.invoiceNo?.trim() || null;
    if (updateData.vehicleCapacity !== undefined) {
      const rounded = roundValue(updateData.vehicleCapacity);
      updateMap.vehicleCapacity = rounded !== null ? String(rounded) : null;
    }

    if (safeRate !== undefined) updateMap.rate = safeRate;
    if (safeAmount !== undefined) updateMap.amount = safeAmount;
    if (safeDetCharges !== undefined) updateMap.detCharges = safeDetCharges;
    if (safeGst !== undefined) updateMap.gst = safeGst;
    if (safeGrossAmount !== undefined) updateMap.grossAmount = safeGrossAmount;

    if (updateData.paidOn !== undefined) updateMap.paidOn = updateData.paidOn ? new Date(updateData.paidOn) : null;

    // Update material
    const updated = await prisma.inwardMaterial.update({
      where: { id: materialId },
      data: updateMap,
      include: {
        inwardEntry: {
          include: {
            company: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Delete inward material
   * @param {string} materialId - Material ID
   * @returns {Promise<void>}
   */
  async deleteMaterial(materialId) {
    await this.getMaterialById(materialId); // Check if exists

    await prisma.inwardMaterial.delete({
      where: { id: materialId },
    });
  }
}

export default new InwardMaterialsService();

