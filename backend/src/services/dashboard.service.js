import prisma from '../config/database.js';

/**
 * Dashboard Service
 * Handles all dashboard-related business logic and statistics
 */

class DashboardService {
  /**
   * Get dashboard statistics
   * @returns {Promise<object>} Dashboard stats
   */
  async getStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Get current month inward stats
    const [currentMonthInward, currentMonthOutward, totalInvoices, monthRevenue, allTimeRevenueStats] = await Promise.all([
      prisma.inwardEntry.aggregate({
        where: {
          date: {
            gte: startOfMonth,
          },
        },
        _count: true,
        _sum: {
          quantity: true,
        },
      }),
      prisma.outwardEntry.aggregate({
        where: {
          date: {
            gte: startOfMonth,
          },
        },
        _count: true,
        _sum: {
          quantity: true,
        },
      }),
      prisma.invoice.count({
        where: {
          type: 'Inward',
          date: {
            gte: startOfMonth,
          },
        },
      }),
      prisma.invoice.aggregate({
        where: {
          type: 'Inward',
          date: {
            gte: startOfMonth,
          },
        },
        _sum: {
          grandTotal: true,
          paymentReceived: true,
        },
      }),
      prisma.invoice.aggregate({
        where: {
          type: 'Inward',
        },
        _sum: {
          grandTotal: true,
          paymentReceived: true,
        },
      }),
    ]);

    // Get all-time totals for comparison
    const [allTimeInward, allTimeOutward] = await Promise.all([
      prisma.inwardEntry.aggregate({
        _count: true,
        _sum: {
          quantity: true,
        },
      }),
      prisma.outwardEntry.aggregate({
        _count: true,
        _sum: {
          quantity: true,
        },
      }),
    ]);

    const totalInwardQuantity = parseFloat(currentMonthInward._sum.quantity || 0);
    const totalOutwardQuantity = parseFloat(currentMonthOutward._sum.quantity || 0);

    // Monthly stats
    const revenueTotal = parseFloat(monthRevenue._sum.grandTotal || 0);
    const revenuePaid = parseFloat(monthRevenue._sum.paymentReceived || 0);
    const revenuePending = revenueTotal - revenuePaid;

    // All-time stats
    const allTimeTotal = parseFloat(allTimeRevenueStats._sum.grandTotal || 0);
    const allTimePaid = parseFloat(allTimeRevenueStats._sum.paymentReceived || 0);
    const allTimePending = allTimeTotal - allTimePaid;

    return {
      inward: {
        entries: currentMonthInward._count,
        quantity: totalInwardQuantity,
        allTimeEntries: allTimeInward._count,
        allTimeQuantity: parseFloat(allTimeInward._sum.quantity || 0),
      },
      outward: {
        entries: currentMonthOutward._count,
        quantity: totalOutwardQuantity,
        allTimeEntries: allTimeOutward._count,
        allTimeQuantity: parseFloat(allTimeOutward._sum.quantity || 0),
      },
      invoices: {
        thisMonth: totalInvoices,
      },
      revenue: {
        thisMonth: revenueTotal,
        thisMonthPaid: revenuePaid,
        thisMonthPending: revenuePending,
        allTime: allTimeTotal,
        allTimePaid: allTimePaid,
        allTimePending: allTimePending,
      },
    };
  }

  /**
   * Get revenue chart data (monthly)
   * @param {number} year - Year to filter (default: current year)
   * @returns {Promise<array>} Monthly revenue data
   */
  async getRevenueChartData(year = null) {
    const targetYear = year || new Date().getFullYear();
    const startOfYear = new Date(targetYear, 0, 1);
    const endOfYear = new Date(targetYear, 11, 31, 23, 59, 59);

    // Get all invoices for the year
    const invoices = await prisma.invoice.findMany({
      where: {
        type: 'Inward',
        date: {
          gte: startOfYear,
          lte: endOfYear,
        },
      },
      select: {
        date: true,
        grandTotal: true,
        paymentReceived: true,
      },
    });

    // Group by month
    const monthlyData = {};
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    // Initialize all months
    for (let i = 0; i < 12; i++) {
      monthlyData[i] = {
        month: monthNames[i],
        revenue: 0,
        paid: 0,
        pending: 0,
      };
    }

    // Aggregate data
    invoices.forEach((invoice) => {
      const month = new Date(invoice.date).getMonth();
      const revenue = parseFloat(invoice.grandTotal);
      const paid = parseFloat(invoice.paymentReceived);

      monthlyData[month].revenue += revenue;
      monthlyData[month].paid += paid;
      monthlyData[month].pending += (revenue - paid);
    });

    return Object.values(monthlyData);
  }

  /**
   * Get payment status breakdown
   * @returns {Promise<object>} Payment status data
   */
  async getPaymentStatus() {
    // Get all inward invoices (all time)
    const invoices = await prisma.invoice.aggregate({
      where: {
        type: 'Inward',
      },
      _sum: {
        grandTotal: true,
        paymentReceived: true,
      },
    });

    const totalInvoiced = parseFloat(invoices._sum.grandTotal || 0);
    const totalReceived = parseFloat(invoices._sum.paymentReceived || 0);
    const totalPending = totalInvoiced - totalReceived;

    return {
      total: totalInvoiced,
      received: totalReceived,
      pending: totalPending,
    };
  }

  /**
   * Get recent activity
   * @param {number} limit - Number of items to return (default: 10)
   * @returns {Promise<object>} Recent activity data
   */
  async getRecentActivity(limit = 10) {
    const [recentInward, recentOutward, recentInvoices, recentPayments] = await Promise.all([
      prisma.inwardEntry.findMany({
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          date: true,
          manifestNo: true,
          wasteName: true,
          quantity: true,
          unit: true,
          company: {
            select: {
              name: true,
            },
          },
          createdAt: true,
        },
      }),
      prisma.outwardEntry.findMany({
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          date: true,
          manifestNo: true,
          cementCompany: true,
          quantity: true,
          unit: true,
          transporter: {
            select: {
              name: true,
            },
          },
          createdAt: true,
        },
      }),
      prisma.invoice.findMany({
        where: {
          type: 'Inward',
        },
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          invoiceNo: true,
          type: true,
          date: true,
          customerName: true,
          grandTotal: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.invoice.findMany({
        where: {
          type: 'Inward',
          paymentReceived: {
            gt: 0,
          },
          paymentReceivedOn: {
            not: null,
          },
        },
        take: limit,
        orderBy: {
          paymentReceivedOn: 'desc',
        },
        select: {
          id: true,
          invoiceNo: true,
          customerName: true,
          paymentReceived: true,
          paymentReceivedOn: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      inward: recentInward.map((entry) => ({
        id: entry.id,
        type: 'inward',
        date: entry.date,
        description: `${entry.company.name} - ${entry.manifestNo}`,
        details: `${entry.quantity} ${entry.unit} of ${entry.wasteName}`,
        createdAt: entry.createdAt,
      })),
      outward: recentOutward.map((entry) => ({
        id: entry.id,
        type: 'outward',
        date: entry.date,
        description: `${entry.cementCompany} - ${entry.manifestNo}`,
        details: `${entry.quantity} ${entry.unit}${entry.transporter ? ` via ${entry.transporter.name}` : ''}`,
        createdAt: entry.createdAt,
      })),
      invoices: recentInvoices.map((invoice) => ({
        id: invoice.id,
        type: 'invoice',
        date: invoice.date,
        description: `Invoice ${invoice.invoiceNo}`,
        details: `${invoice.customerName || 'N/A'} - ₹${Number(invoice.grandTotal).toLocaleString()}`,
        status: invoice.status,
        createdAt: invoice.createdAt,
      })),
      payments: recentPayments.map((invoice) => ({
        id: invoice.id,
        type: 'payment',
        date: invoice.paymentReceivedOn,
        description: `Payment for Invoice ${invoice.invoiceNo}`,
        details: `${invoice.customerName || 'N/A'} - ₹${Number(invoice.paymentReceived).toLocaleString()}`,
        createdAt: invoice.createdAt,
      })),
    };
  }

  /**
   * Get waste flow chart data (monthly inward vs outward)
   * @param {number} year - Year to filter (default: current year)
   * @returns {Promise<array>} Monthly waste flow data
   */
  async getWasteFlowData(year = null) {
    const targetYear = year || new Date().getFullYear();
    const startOfYear = new Date(targetYear, 0, 1);
    const endOfYear = new Date(targetYear, 11, 31, 23, 59, 59);

    // Get inward entries for the year
    const inwardEntries = await prisma.inwardEntry.findMany({
      where: {
        date: {
          gte: startOfYear,
          lte: endOfYear,
        },
      },
      select: {
        date: true,
        quantity: true,
        unit: true,
      },
    });

    // Get outward entries for the year
    const outwardEntries = await prisma.outwardEntry.findMany({
      where: {
        date: {
          gte: startOfYear,
          lte: endOfYear,
        },
      },
      select: {
        date: true,
        quantity: true,
        unit: true,
      },
    });

    // Helper function to convert to MT
    const toMT = (quantity, unit) => {
      if (unit === 'MT') return parseFloat(quantity);
      if (unit === 'Kg') return parseFloat(quantity) / 1000;
      if (unit === 'KL') return parseFloat(quantity); // Assuming KL ≈ MT for now
      return 0;
    };

    // Group by month
    const monthlyData = {};
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    // Initialize all months
    for (let i = 0; i < 12; i++) {
      monthlyData[i] = {
        month: monthNames[i],
        inward: 0,
        outward: 0,
      };
    }

    // Aggregate inward data
    inwardEntries.forEach((entry) => {
      const month = new Date(entry.date).getMonth();
      monthlyData[month].inward += toMT(entry.quantity, entry.unit);
    });

    // Aggregate outward data
    outwardEntries.forEach((entry) => {
      const month = new Date(entry.date).getMonth();
      monthlyData[month].outward += toMT(entry.quantity, entry.unit);
    });

    return Object.values(monthlyData);
  }
}

export default new DashboardService();

