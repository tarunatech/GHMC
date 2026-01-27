/**
 * Error Handling Utilities
 * Provides consistent error message formatting across the application
 */

/**
 * Extract a user-friendly error message from an API error response
 * @param error - The error object from axios or other sources
 * @param fallbackMessage - Default message if error parsing fails
 * @returns A formatted error message string
 */
export const getErrorMessage = (error: any, fallbackMessage: string = 'An error occurred'): string => {
    // Check for network errors (e.g. backend server down)
    if (error?.code === 'ERR_NETWORK') {
        return 'Network Error: Cannot connect to server. Please check your internet or if the server is running.';
    }

    // Check for timeout
    if (error?.code === 'ECONNABORTED' || error?.code === 'ERR_CANCELED') {
        return 'Request timed out. Please try again.';
    }

    // Check for axios response error structure
    if (error?.response?.data?.error) {
        const errorData = error.response.data.error;

        // If there are validation details, format them nicely
        if (errorData.details && Array.isArray(errorData.details)) {
            const detailMessages = errorData.details
                .map((detail: any, index: number) => {
                    const field = detail.field ? `[${formatFieldName(detail.field)}] ` : '';
                    const msg = detail.message || String(detail);
                    return `${index + 1}. ${field}${msg}`;
                })
                .join('\n');

            return `${errorData.message || 'Validation failed'}:\n${detailMessages}`;
        }

        // Just the message plus code if useful
        if (errorData.message) {
            if (errorData.code && errorData.code !== 'INTERNAL_SERVER_ERROR' && errorData.code !== 'VALIDATION_ERROR') {
                return `${errorData.message} (${errorData.code})`;
            }
            return errorData.message;
        }
    }

    // Check for direct message in response
    if (error?.response?.data?.message) {
        return error.response.data.message;
    }

    // Check for standard error message
    if (error?.message) {
        return error.message;
    }

    return fallbackMessage;
};

/**
 * Format field names for display (convert camelCase to Title Case with spaces)
 * @param fieldName - The field name to format
 * @returns Formatted field name
 */
export const formatFieldName = (fieldName: string): string => {
    // Handle nested field names (e.g., "materials.0.rate")
    const parts = fieldName.split('.');
    const lastPart = parts[parts.length - 1];

    // Convert camelCase to Title Case with spaces
    return lastPart
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();
};

/**
 * Get a short error message suitable for toast notifications
 * @param error - The error object
 * @param fallbackMessage - Default message if error parsing fails
 * @returns A short error message string
 */
export const getShortErrorMessage = (error: any, fallbackMessage: string = 'An error occurred'): string => {
    if (error?.code === 'ERR_NETWORK') {
        return 'Network error: Cannot connect to server';
    }

    // Check for axios response error structure
    if (error?.response?.data?.error) {
        const errorData = error.response.data.error;

        // If there are validation details, show count
        if (errorData.details && Array.isArray(errorData.details) && errorData.details.length > 0) {
            const count = errorData.details.length;
            const firstDetail = errorData.details[0];
            const field = firstDetail.field ? `${formatFieldName(firstDetail.field)}: ` : '';
            const firstMessage = firstDetail.message || String(firstDetail);

            if (count === 1) {
                return `${errorData.message || 'Validation failed'}: ${field}${firstMessage}`;
            }
            return `${errorData.message || 'Validation failed'}: ${field}${firstMessage} (+${count - 1} more)`;
        }

        if (errorData.message) {
            return errorData.message;
        }
    }

    if (error?.response?.data?.message) {
        return error.response.data.message;
    }

    if (error?.message) {
        return error.message;
    }

    return fallbackMessage;
};

/**
 * Log detailed error information to console for debugging
 * @param context - Where the error occurred (e.g., "Creating company")
 * @param error - The error object
 */
export const logError = (context: string, error: any): void => {
    console.error(`[Error] ${context}:`, {
        message: error?.message,
        code: error?.code,
        response: error?.response?.data,
        status: error?.response?.status,
        stack: error?.stack,
    });
};
