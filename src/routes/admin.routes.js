const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const User = require('../models/user.model');
const Campaign = require('../models/campaign.model');
const PLAN_LIMITS = require('../config/plans');

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user || !user.isAdmin) {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }

        next();
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all users with pagination and filters
// @route   GET /api/admin/users
// @access  Private/Admin
router.get('/users', protect, isAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, search, plan, status } = req.query;

        const query = {};

        if (search) {
            query.$or = [
                { username: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }

        if (plan) {
            query['subscription.plan'] = plan;
        }

        if (status) {
            query['subscription.status'] = status;
        }

        const users = await User.find(query)
            .select('-password')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 });

        const count = await User.countDocuments(query);

        res.json({
            users,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            total: count,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get system-wide statistics
// @route   GET /api/admin/stats
// @access  Private/Admin
router.get('/stats', protect, isAdmin, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const freeUsers = await User.countDocuments({ 'subscription.plan': 'free' });
        const proUsers = await User.countDocuments({ 'subscription.plan': 'pro' });
        const enterpriseUsers = await User.countDocuments({ 'subscription.plan': 'enterprise' });

        const totalCampaigns = await Campaign.countDocuments();
        const activeCampaigns = await Campaign.countDocuments({ status: 'active' });

        // Calculate total messages sent (aggregate from all users)
        const usageStats = await User.aggregate([
            {
                $group: {
                    _id: null,
                    totalMessages: { $sum: '$usage.messagesSent' },
                    totalCampaigns: { $sum: '$usage.campaignsCreated' },
                    totalAccounts: { $sum: '$usage.accountsConnected' },
                },
            },
        ]);

        // Revenue calculation (simplified)
        const monthlyRevenue = (proUsers * 29) + (enterpriseUsers * 99);

        res.json({
            users: {
                total: totalUsers,
                free: freeUsers,
                pro: proUsers,
                enterprise: enterpriseUsers,
            },
            campaigns: {
                total: totalCampaigns,
                active: activeCampaigns,
            },
            usage: usageStats[0] || { totalMessages: 0, totalCampaigns: 0, totalAccounts: 0 },
            revenue: {
                monthly: monthlyRevenue,
                annual: monthlyRevenue * 12,
            },
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Update user subscription
// @route   PUT /api/admin/users/:id/subscription
// @access  Private/Admin
router.put('/users/:id/subscription', protect, isAdmin, async (req, res) => {
    try {
        const { plan, status } = req.body;

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (plan) {
            user.subscription.plan = plan;
        }

        if (status) {
            user.subscription.status = status;
        }

        await user.save();

        res.json({
            message: 'Subscription updated successfully',
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                subscription: user.subscription,
            },
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
router.delete('/users/:id', protect, isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        await user.deleteOne();

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get revenue analytics
// @route   GET /api/admin/revenue
// @access  Private/Admin
router.get('/revenue', protect, isAdmin, async (req, res) => {
    try {
        const { period = 'month' } = req.query;

        const proUsers = await User.countDocuments({ 'subscription.plan': 'pro', 'subscription.status': 'active' });
        const enterpriseUsers = await User.countDocuments({ 'subscription.plan': 'enterprise', 'subscription.status': 'active' });

        const monthlyRevenue = (proUsers * 29) + (enterpriseUsers * 99);

        res.json({
            period,
            revenue: {
                pro: proUsers * 29,
                enterprise: enterpriseUsers * 99,
                total: monthlyRevenue,
            },
            subscribers: {
                pro: proUsers,
                enterprise: enterpriseUsers,
                total: proUsers + enterpriseUsers,
            },
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
