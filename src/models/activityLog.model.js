const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    action: {
        type: String,
        required: true,
        enum: [
            // Auth actions
            'login', 'logout', 'register', 'password_change',
            // Account actions
            'account_connected', 'account_disconnected', 'account_updated',
            // Campaign actions
            'campaign_created', 'campaign_updated', 'campaign_deleted', 'campaign_started', 'campaign_stopped',
            // Post actions
            'post_scheduled', 'post_sent', 'post_failed', 'post_deleted',
            // Draft actions
            'draft_created', 'draft_updated', 'draft_deleted',
            // Template actions
            'template_created', 'template_updated', 'template_deleted', 'template_used',
            // Subscription actions
            'subscription_upgraded', 'subscription_downgraded', 'subscription_cancelled',
            // Admin actions
            'user_banned', 'user_unbanned', 'payment_approved', 'payment_rejected',
            // Other
            'settings_updated', 'ai_content_generated', 'other',
        ],
    },
    resource: {
        type: String, // e.g., 'Campaign', 'Post', 'Account'
    },
    resourceId: {
        type: mongoose.Schema.Types.ObjectId,
    },
    details: {
        type: mongoose.Schema.Types.Mixed, // Flexible object for additional data
    },
    ipAddress: {
        type: String,
    },
    userAgent: {
        type: String,
    },
    status: {
        type: String,
        enum: ['success', 'failed', 'pending'],
        default: 'success',
    },
}, {
    timestamps: true,
});

// Indexes for efficient querying
ActivityLogSchema.index({ user: 1, createdAt: -1 });
ActivityLogSchema.index({ action: 1, createdAt: -1 });
ActivityLogSchema.index({ resource: 1, resourceId: 1 });

// TTL index to auto-delete logs older than 90 days
ActivityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
