const mongoose = require('mongoose');

const scheduledPostSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    platform: {
        type: String,
        required: true,
        enum: ['instagram', 'facebook', 'telegram', 'whatsapp'],
        index: true
    },
    accountId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    targetId: {
        type: String, // Chat ID for Telegram, Group ID for FB, Number for WhatsApp
        required: false
    },
    postType: {
        type: String,
        required: true,
        enum: ['image', 'video', 'text'],
        default: 'image'
    },
    content: {
        caption: {
            type: String,
            default: ''
        },
        mediaPath: {
            type: String
        },
        mediaUrl: {
            type: String
        }
    },
    scheduledTime: {
        type: Date,
        required: true,
        index: true
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'posted', 'failed', 'cancelled'],
        default: 'pending',
        index: true
    },
    postedAt: {
        type: Date
    },
    errorMessage: {
        type: String
    },
    retryCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Index for scheduler query
scheduledPostSchema.index({ status: 1, scheduledTime: 1 });

module.exports = mongoose.model('ScheduledPost', scheduledPostSchema);
