const ActivityLog = require('../models/activityLog.model');
const logger = require('../utils/logger');

/**
 * Middleware to log user activities
 */
const logActivity = (action, resource = null) => {
    return async (req, res, next) => {
        // Store original send function
        const originalSend = res.send;

        // Override send function to log after response
        res.send = function (data) {
            // Call original send
            originalSend.call(this, data);

            // Log activity asynchronously (don't block response)
            if (req.user) {
                const logData = {
                    user: req.user.id,
                    action,
                    resource,
                    resourceId: req.params.id || req.body._id || null,
                    details: {
                        method: req.method,
                        path: req.path,
                        body: sanitizeBody(req.body),
                        query: req.query,
                    },
                    ipAddress: req.ip || req.connection.remoteAddress,
                    userAgent: req.get('user-agent'),
                    status: res.statusCode >= 200 && res.statusCode < 300 ? 'success' : 'failed',
                };

                ActivityLog.create(logData).catch(err => {
                    logger.error('Failed to log activity:', err);
                });
            }
        };

        next();
    };
};

/**
 * Manual activity logging function
 */
const createActivityLog = async (userId, action, options = {}) => {
    try {
        const logData = {
            user: userId,
            action,
            resource: options.resource || null,
            resourceId: options.resourceId || null,
            details: options.details || {},
            ipAddress: options.ipAddress || null,
            userAgent: options.userAgent || null,
            status: options.status || 'success',
        };

        await ActivityLog.create(logData);
    } catch (error) {
        logger.error('Failed to create activity log:', error);
    }
};

/**
 * Sanitize request body to remove sensitive data
 */
function sanitizeBody(body) {
    if (!body) return {};

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret'];

    sensitiveFields.forEach(field => {
        if (sanitized[field]) {
            sanitized[field] = '[REDACTED]';
        }
    });

    return sanitized;
}

module.exports = {
    logActivity,
    createActivityLog,
};
