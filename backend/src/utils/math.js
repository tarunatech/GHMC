/**
 * Math utilities for backend
 */

/**
 * Round a number to a specified number of decimal places
 * @param {number|string} value - Value to round
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {number|null} Rounded number or null if invalid
 */
export const roundValue = (value, decimals = 2) => {
    if (value === undefined || value === null || value === '') return null;
    const num = parseFloat(value);
    if (isNaN(num)) return null;
    const factor = Math.pow(10, decimals);
    return Math.round((num + Number.EPSILON) * factor) / factor;
};
