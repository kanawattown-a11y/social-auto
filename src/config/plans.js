// Plan limits configuration
const PLAN_LIMITS = {
    free: {
        name: 'Free',
        price: 0,
        limits: {
            messagesPerMonth: 100,
            campaignsTotal: 2,
            accountsPerPlatform: 1,
            chatbotRules: 5,
            scheduledPosts: 10,
        },
        features: {
            analytics: 'basic',
            support: 'community',
            api: false,
        },
    },
    pro: {
        name: 'Pro',
        price: 29,
        limits: {
            messagesPerMonth: 5000,
            campaignsTotal: 20,
            accountsPerPlatform: 5,
            chatbotRules: 50,
            scheduledPosts: 100,
        },
        features: {
            analytics: 'advanced',
            support: 'priority',
            api: true,
        },
    },
    enterprise: {
        name: 'Enterprise',
        price: 99,
        limits: {
            messagesPerMonth: -1, // unlimited
            campaignsTotal: -1,
            accountsPerPlatform: -1,
            chatbotRules: -1,
            scheduledPosts: -1,
        },
        features: {
            analytics: 'comprehensive',
            support: '24/7',
            api: true,
            customIntegration: true,
            dedicatedManager: true,
        },
    },
};

module.exports = PLAN_LIMITS;
