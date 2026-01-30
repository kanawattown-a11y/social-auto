const PLAN_LIMITS = require('../config/plans');
const User = require('../models/user.model');
const logger = require('../utils/logger');

// Middleware to check usage quotas
const checkQuota = (resourceType) => {
    return async (req, res, next) => {
        try {
            const user = await User.findById(req.user.id);

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const userPlan = user.subscription?.plan || 'free';
            const planLimits = PLAN_LIMITS[userPlan];

            if (!planLimits) {
                return res.status(500).json({ message: 'Invalid subscription plan' });
            }

            // Check specific resource limits
            let limitExceeded = false;
            let limitMessage = '';

            switch (resourceType) {
                case 'message':
                    const messageLimit = planLimits.limits.messagesPerMonth;
                    if (messageLimit !== -1 && user.usage.messagesSent >= messageLimit) {
                        limitExceeded = true;
                        limitMessage = `لقد وصلت إلى الحد الأقصى للرسائل (${messageLimit} رسالة/شهر). يرجى الترقية لخطة أعلى.`;
                    }
                    break;

                case 'campaign':
                    const campaignLimit = planLimits.limits.campaignsTotal;
                    if (campaignLimit !== -1 && user.usage.campaignsCreated >= campaignLimit) {
                        limitExceeded = true;
                        limitMessage = `لقد وصلت إلى الحد الأقصى للحملات (${campaignLimit} حملة). يرجى الترقية لخطة أعلى.`;
                    }
                    break;

                case 'account':
                    const accountLimit = planLimits.limits.accountsPerPlatform;
                    if (accountLimit !== -1 && user.usage.accountsConnected >= accountLimit) {
                        limitExceeded = true;
                        limitMessage = `لقد وصلت إلى الحد الأقصى للحسابات (${accountLimit} حساب/منصة). يرجى الترقية لخطة أعلى.`;
                    }
                    break;

                case 'chatbot':
                    const chatbotLimit = planLimits.limits.chatbotRules;
                    const currentRules = user.usage.chatbotRulesCreated || 0;
                    if (chatbotLimit !== -1 && currentRules >= chatbotLimit) {
                        limitExceeded = true;
                        limitMessage = `لقد وصلت إلى الحد الأقصى لقواعد الشات بوت (${chatbotLimit} قاعدة). يرجى الترقية لخطة أعلى.`;
                    }
                    break;

                default:
                    logger.warn(`Unknown resource type for quota check: ${resourceType}`);
            }

            if (limitExceeded) {
                return res.status(403).json({
                    message: limitMessage,
                    quota: {
                        plan: userPlan,
                        limit: planLimits.limits,
                        current: user.usage,
                        upgradeRequired: true,
                    },
                });
            }

            // Attach plan info to request for later use
            req.userPlan = userPlan;
            req.planLimits = planLimits;

            next();
        } catch (error) {
            logger.error('Quota check error:', error);
            res.status(500).json({ message: 'Error checking quota' });
        }
    };
};

// Helper function to increment usage
const incrementUsage = async (userId, resourceType) => {
    try {
        const user = await User.findById(userId);

        if (!user) {
            logger.error(`User not found for usage increment: ${userId}`);
            return;
        }

        switch (resourceType) {
            case 'message':
                user.usage.messagesSent += 1;
                break;
            case 'campaign':
                user.usage.campaignsCreated += 1;
                break;
            case 'account':
                user.usage.accountsConnected += 1;
                break;
            case 'chatbot':
                user.usage.chatbotRulesCreated = (user.usage.chatbotRulesCreated || 0) + 1;
                break;
        }

        await user.save();
        logger.info(`Usage incremented for user ${userId}: ${resourceType}`);
    } catch (error) {
        logger.error('Error incrementing usage:', error);
    }
};

// Helper function to decrement usage (for deletions)
const decrementUsage = async (userId, resourceType) => {
    try {
        const user = await User.findById(userId);

        if (!user) {
            logger.error(`User not found for usage decrement: ${userId}`);
            return;
        }

        switch (resourceType) {
            case 'campaign':
                user.usage.campaignsCreated = Math.max(0, user.usage.campaignsCreated - 1);
                break;
            case 'account':
                user.usage.accountsConnected = Math.max(0, user.usage.accountsConnected - 1);
                break;
            case 'chatbot':
                user.usage.chatbotRulesCreated = Math.max(0, (user.usage.chatbotRulesCreated || 0) - 1);
                break;
        }

        await user.save();
        logger.info(`Usage decremented for user ${userId}: ${resourceType}`);
    } catch (error) {
        logger.error('Error decrementing usage:', error);
    }
};

// Reset monthly usage (to be called by a cron job)
const resetMonthlyUsage = async () => {
    try {
        await User.updateMany(
            {},
            {
                $set: {
                    'usage.messagesSent': 0,
                    'usage.messagesResetDate': new Date(),
                },
            }
        );
        logger.info('Monthly usage reset completed');
    } catch (error) {
        logger.error('Error resetting monthly usage:', error);
    }
};

module.exports = {
    checkQuota,
    incrementUsage,
    decrementUsage,
    resetMonthlyUsage,
};
