const mongoose = require('mongoose');

const PostAnalyticsSchema = new mongoose.Schema({
    post: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ScheduledPost',
        required: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    platform: {
        type: String,
        enum: ['whatsapp', 'telegram', 'instagram', 'facebook'],
        required: true,
    },
    metrics: {
        sent: {
            type: Number,
            default: 0,
        },
        delivered: {
            type: Number,
            default: 0,
        },
        read: {
            type: Number,
            default: 0,
        },
        replied: {
            type: Number,
            default: 0,
        },
        failed: {
            type: Number,
            default: 0,
        },
    },
    engagement: {
        clicks: {
            type: Number,
            default: 0,
        },
        shares: {
            type: Number,
            default: 0,
        },
        reactions: {
            type: Number,
            default: 0,
        },
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
});

// Index for faster queries
PostAnalyticsSchema.index({ user: 1, timestamp: -1 });
PostAnalyticsSchema.index({ post: 1 });

module.exports = mongoose.model('PostAnalytics', PostAnalyticsSchema);
