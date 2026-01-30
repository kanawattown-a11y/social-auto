const Analytics = require('../models/analytics.model');
const Campaign = require('../models/campaign.model');
const logger = require('../utils/logger');

exports.getDashboardStats = async (req, res) => {
    try {
        const userId = req.user._id;

        // Get total campaigns
        const totalCampaigns = await Campaign.countDocuments({ userId });
        const completedCampaigns = await Campaign.countDocuments({ userId, status: 'completed' });
        const runningCampaigns = await Campaign.countDocuments({ userId, status: 'running' });
        const failedCampaigns = await Campaign.countDocuments({ userId, status: 'failed' });

        // Get analytics events
        const totalMessages = await Analytics.countDocuments({
            userId,
            type: { $in: ['campaign_sent', 'message_delivered'] }
        });

        const chatbotReplies = await Analytics.countDocuments({
            userId,
            type: 'chatbot_reply'
        });

        // Success rate
        const successRate = totalCampaigns > 0
            ? ((completedCampaigns / totalCampaigns) * 100).toFixed(2)
            : 0;

        // Recent activity (last 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentActivity = await Analytics.aggregate([
            {
                $match: {
                    userId,
                    timestamp: { $gte: sevenDaysAgo }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.json({
            campaigns: {
                total: totalCampaigns,
                completed: completedCampaigns,
                running: runningCampaigns,
                failed: failedCampaigns,
                successRate: `${successRate}%`,
            },
            messages: {
                total: totalMessages,
                chatbotReplies,
            },
            recentActivity,
        });
    } catch (error) {
        logger.error('Dashboard stats error:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.getCampaignReport = async (req, res) => {
    try {
        const { campaignId } = req.params;

        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).json({ message: 'Campaign not found' });
        }

        const events = await Analytics.find({ campaignId }).sort({ timestamp: -1 });

        const report = {
            campaign: {
                name: campaign.name,
                type: campaign.type,
                status: campaign.status,
                targetCount: campaign.targetGroup.length,
                createdAt: campaign.createdAt,
            },
            events: events.map(e => ({
                type: e.type,
                timestamp: e.timestamp,
                metadata: e.metadata,
            })),
            summary: {
                totalEvents: events.length,
                sent: events.filter(e => e.type === 'campaign_sent').length,
                failed: events.filter(e => e.type === 'campaign_failed').length,
            },
        };

        res.json(report);
    } catch (error) {
        logger.error('Campaign report error:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.logEvent = async (req, res) => {
    try {
        const { type, campaignId, metadata } = req.body;

        const event = await Analytics.create({
            userId: req.user._id,
            campaignId,
            type,
            metadata,
        });

        res.status(201).json(event);
    } catch (error) {
        logger.error('Log event error:', error);
        res.status(500).json({ message: error.message });
    }
};
