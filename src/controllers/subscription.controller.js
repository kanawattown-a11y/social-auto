const Subscription = require('../models/subscription.model');
const logger = require('../utils/logger');

exports.getSubscription = async (req, res) => {
    try {
        const subscription = await Subscription.findOne({ userId: req.user._id });

        if (!subscription) {
            // Create default subscription
            const newSub = await Subscription.create({ userId: req.user._id });
            return res.json(newSub);
        }

        res.json(subscription);
    } catch (error) {
        logger.error('Get subscription error:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.upgradePlan = async (req, res) => {
    try {
        const { plan } = req.body;

        const limits = {
            free: { facebookAccounts: 1, whatsappAccounts: 1, campaignsPerMonth: 10, messagesPerDay: 100, chatbotRules: 5 },
            basic: { facebookAccounts: 3, whatsappAccounts: 2, campaignsPerMonth: 50, messagesPerDay: 500, chatbotRules: 20 },
            pro: { facebookAccounts: 10, whatsappAccounts: 5, campaignsPerMonth: 200, messagesPerDay: 2000, chatbotRules: 100 },
            enterprise: { facebookAccounts: -1, whatsappAccounts: -1, campaignsPerMonth: -1, messagesPerDay: -1, chatbotRules: -1 },
        };

        const subscription = await Subscription.findOneAndUpdate(
            { userId: req.user._id },
            {
                plan,
                limits: limits[plan],
                status: 'active',
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            },
            { upsert: true, new: true }
        );

        logger.info(`User ${req.user._id} upgraded to ${plan}`);
        res.json(subscription);
    } catch (error) {
        logger.error('Upgrade plan error:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.checkLimit = async (req, res) => {
    try {
        const { action } = req.params;
        const subscription = await Subscription.findOne({ userId: req.user._id });

        if (!subscription) {
            return res.json({ allowed: false, message: 'No subscription found' });
        }

        const canPerform = subscription.canPerformAction(action);
        res.json({ allowed: canPerform, limits: subscription.limits, usage: subscription.usage });
    } catch (error) {
        logger.error('Check limit error:', error);
        res.status(500).json({ message: error.message });
    }
};
