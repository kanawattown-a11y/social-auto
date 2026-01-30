const mongoose = require('mongoose');

const ReplyTemplateSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    content: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        enum: ['greeting', 'support', 'sales', 'followup', 'other'],
        default: 'other',
    },
    platform: {
        type: String,
        enum: ['whatsapp', 'telegram', 'instagram', 'facebook', 'all'],
        default: 'all',
    },
    variables: [{
        name: String,
        description: String,
        defaultValue: String,
    }],
    isAIGenerated: {
        type: Boolean,
        default: false,
    },
    usageCount: {
        type: Number,
        default: 0,
    },
    lastUsed: {
        type: Date,
    },
}, {
    timestamps: true,
});

// Index for faster queries
ReplyTemplateSchema.index({ user: 1, category: 1 });

module.exports = mongoose.model('ReplyTemplate', ReplyTemplateSchema);
