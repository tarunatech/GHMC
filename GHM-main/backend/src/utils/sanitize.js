/**
 * Sanitize company data based on user role
 * Removes sensitive financial data (like rates) for non-admin users
 * @param {object} company - Company object
 * @param {string} userRole - User role
 * @returns {object} Sanitized company object
 */
export const sanitizeCompany = (company, userRole) => {
    if (['admin', 'superadmin'].includes(userRole)) {
        return company;
    }

    // Clone to avoid mutation
    const sanitized = { ...company };

    if (sanitized.materials) {
        sanitized.materials = sanitized.materials.map(material => {
            // eslint-disable-next-line no-unused-vars
            const { rate, ...rest } = material;
            return rest;
        });
    }

    return sanitized;
};

/**
 * Sanitize material data based on user role
 * @param {object} material - Material object
 * @param {string} userRole - User role
 * @returns {object} Sanitized material object
 */
export const sanitizeMaterial = (material, userRole) => {
    if (['admin', 'superadmin'].includes(userRole)) {
        return material;
    }

    // eslint-disable-next-line no-unused-vars
    const { rate, ...rest } = material;
    return rest;
};

/**
 * Sanitize list of companies
 * @param {Array} companies - List of companies
 * @param {string} userRole - User role
 * @returns {Array} Sanitized list of companies
 */
export const sanitizeCompanies = (companies, userRole) => {
    if (['admin', 'superadmin'].includes(userRole)) {
        return companies;
    }

    return companies.map(company => sanitizeCompany(company, userRole));
};
