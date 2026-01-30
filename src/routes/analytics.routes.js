const express = require('express');
const router = express.Router();
const { getDashboardStats, getCampaignReport, logEvent } = require('../controllers/analytics.controller');
const { protect } = require('../middleware/auth.middleware');
const PostAnalytics = require('../models/postAnalytics.model');
const ScheduledPost = require('../models/scheduledPost.model');

// Existing routes
router.get('/dashboard-old', protect, getDashboardStats);
router.get('/campaign/:campaignId', protect, getCampaignReport);
router.post('/log', protect, logEvent);

// New analytics routes
// @desc    Track post analytics
// @route   POST /api/analytics/track
router.post('/track', protect, async (req, res) => {
    try {
        const { postId, metrics, engagement } = req.body;
        let analytics = await PostAnalytics.findOne({ post: postId });

        if (analytics) {
            if (metrics) analytics.metrics = { ...analytics.metrics, ...metrics };
            if (engagement) analytics.engagement = { ...analytics.engagement, ...engagement };
            await analytics.save();
        } else {
            const post = await ScheduledPost.findById(postId);
            if (!post) return res.status(404).json({ message: 'Post not found' });

            analytics = await PostAnalytics.create({
                post: postId,
                user: req.user.id,
                platform: post.platform,
                metrics,
                engagement,
            });
        }
        res.json(analytics);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get dashboard overview
// @route   GET /api/analytics/dashboard
router.get('/dashboard', protect, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const query = { user: req.user.id };

        if (startDate && endDate) {
            query.timestamp = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        const analytics = await PostAnalytics.find(query);
        const totals = analytics.reduce(
            (acc, item) => ({
                sent: acc.sent + (item.metrics.sent || 0),
                delivered: acc.delivered + (item.metrics.delivered || 0),
                read: acc.read + (item.metrics.read || 0),
                replied: acc.replied + (item.metrics.replied || 0),
                failed: acc.failed + (item.metrics.failed || 0),
                clicks: acc.clicks + (item.engagement.clicks || 0),
                shares: acc.shares + (item.engagement.shares || 0),
                reactions: acc.reactions + (item.engagement.reactions || 0),
            }),
            { sent: 0, delivered: 0, read: 0, replied: 0, failed: 0, clicks: 0, shares: 0, reactions: 0 }
        );

        const deliveryRate = totals.sent > 0 ? (totals.delivered / totals.sent) * 100 : 0;
        const readRate = totals.delivered > 0 ? (totals.read / totals.delivered) * 100 : 0;
        const replyRate = totals.read > 0 ? (totals.replied / totals.read) * 100 : 0;

        const byPlatform = analytics.reduce((acc, item) => {
            if (!acc[item.platform]) acc[item.platform] = { sent: 0, delivered: 0, read: 0 };
            acc[item.platform].sent += item.metrics.sent || 0;
            acc[item.platform].delivered += item.metrics.delivered || 0;
            acc[item.platform].read += item.metrics.read || 0;
            return acc;
        }, {});

        res.json({
            totals,
            rates: { delivery: deliveryRate.toFixed(2), read: readRate.toFixed(2), reply: replyRate.toFixed(2) },
            byPlatform,
            totalPosts: analytics.length,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get top performing posts
// @route   GET /api/analytics/top-posts
router.get('/top-posts', protect, async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const topPosts = await PostAnalytics.find({ user: req.user.id })
            .populate('post')
            .sort({ 'metrics.read': -1 })
            .limit(parseInt(limit));
        res.json(topPosts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
