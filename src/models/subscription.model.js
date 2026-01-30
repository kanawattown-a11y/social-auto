const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
    },
    plan: {
        type: String,
        enum: ['free', 'basic', 'pro', 'enterprise'],
        default: 'free',
    },
    status: {
        type: String,
        enum: ['active', 'cancelled', 'expired', 'trial'],
        default: 'trial',
    },
    limits: {
        facebookAccounts: {
            type: Number,
            default: 1,
        },
        whatsappAccounts: {
            type: Number,
            default: 1,
        },
        campaignsPerMonth: {
            type: Number,
            default: 10,
        },
        messagesPerDay: {
            type: Number,
            default: 100,
        },
        chatbotRules: {
            type: Number,
            default: 5,
        },
    },
    usage: {
        campaignsThisMonth: {
            type: Number,
            default: 0,
        },
        messagesToday: {
            type: Number,
            default: 0,
        },
        lastReset: {
            type: Date,
            default: Date.now,
        },
    },
    stripeCustomerId: String,
    stripeSubscriptionId: String,
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    cancelAtPeriodEnd: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
});

// Method to check if user can perform action
SubscriptionSchema.methods.canPerformAction = function (action) {
    const now = new Date();

    // Reset daily/monthly counters if needed
    if (this.usage.lastReset.getDate() !== now.getDate()) {
        this.usage.messagesToday = 0;
    }

    if (this.usage.lastReset.getMonth() !== now.getMonth()) {
        this.usage.campaignsThisMonth = 0;
    }

    switch (action) {
        case 'send_message':
            return this.usage.messagesToday < this.limits.messagesPerDay;
        case 'create_campaign':
            return this.usage.campaignsThisMonth < this.limits.campaignsPerMonth;
        default:
            return true;
    }
};

const Subscription = mongoose.model('Subscription', SubscriptionSchema);

module.exports = Subscription;
