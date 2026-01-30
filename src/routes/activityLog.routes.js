const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const ActivityLog = require('../models/activityLog.model');

// @desc    Get user activity logs
// @route   GET /api/activity-logs
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const { action, resource, startDate, endDate, page = 1, limit = 50 } = req.query;

        const query = { user: req.user.id };

        if (action) query.action = action;
        if (resource) query.resource = resource;

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [logs, total] = await Promise.all([
            ActivityLog.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            ActivityLog.countDocuments(query),
        ]);

        res.json({
            logs,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / parseInt(limit)),
                limit: parseInt(limit),
            },
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get activity statistics
// @route   GET /api/activity-logs/stats
// @access  Private
router.get('/stats', protect, async (req, res) => {
    try {
        const { days = 30 } = req.query;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        const logs = await ActivityLog.find({
            user: req.user.id,
            createdAt: { $gte: startDate },
        });

        // Group by action
        const byAction = logs.reduce((acc, log) => {
            acc[log.action] = (acc[log.action] || 0) + 1;
            return acc;
        }, {});

        // Group by date
        const byDate = logs.reduce((acc, log) => {
            const date = log.createdAt.toISOString().split('T')[0];
            acc[date] = (acc[date] || 0) + 1;
            return acc;
        }, {});

        // Most active resources
        const byResource = logs.reduce((acc, log) => {
            if (log.resource) {
                acc[log.resource] = (acc[log.resource] || 0) + 1;
            }
            return acc;
        }, {});

        res.json({
            total: logs.length,
            byAction,
            byDate,
            byResource,
            period: `Last ${days} days`,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get admin activity logs (all users)
// @route   GET /api/activity-logs/admin
// @access  Private/Admin
router.get('/admin', protect, async (req, res) => {
    try {
        // Check if user is admin
        const User = require('../models/user.model');
        const user = await User.findById(req.user.id);

        if (!user.isAdmin) {
            return res.status(403).json({ message: 'Admin access required' });
        }

        const { userId, action, resource, page = 1, limit = 100 } = req.query;

        const query = {};
        if (userId) query.user = userId;
        if (action) query.action = action;
        if (resource) query.resource = resource;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [logs, total] = await Promise.all([
            ActivityLog.find(query)
                .populate('user', 'username email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            ActivityLog.countDocuments(query),
        ]);

        res.json({
            logs,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / parseInt(limit)),
                limit: parseInt(limit),
            },
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
