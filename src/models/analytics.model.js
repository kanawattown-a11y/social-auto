const mongoose = require('mongoose');

const AnalyticsSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    campaignId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Campaign',
    },
    type: {
        type: String,
        enum: ['campaign_sent', 'campaign_failed', 'message_delivered', 'message_failed', 'chatbot_reply', 'scrape_completed', 'message'],
        required: true,
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
});

// Index for faster queries
AnalyticsSchema.index({ userId: 1, timestamp: -1 });
AnalyticsSchema.index({ campaignId: 1 });

const Analytics = mongoose.model('Analytics', AnalyticsSchema);

module.exports = Analytics;
