const mongoose = require('mongoose');

const DraftSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    title: {
        type: String,
        default: 'Untitled Draft',
    },
    platform: {
        type: String,
        enum: ['whatsapp', 'telegram', 'instagram', 'facebook'],
        required: true,
    },
    account: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'accountModel',
    },
    accountModel: {
        type: String,
        enum: ['WhatsappAccount', 'TelegramAccount', 'InstagramAccount', 'FacebookAccount'],
    },
    content: {
        text: {
            type: String,
            default: '',
        },
        media: [{
            type: String,
            url: String,
            mediaType: {
                type: String,
                enum: ['image', 'video', 'document'],
            },
        }],
        links: [{
            type: String,
        }],
    },
    metadata: {
        hashtags: [{
            type: String,
        }],
        mentions: [{
            type: String,
        }],
        characterCount: {
            type: Number,
            default: 0,
        },
    },
    lastEdited: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
});

// Update lastEdited on save
DraftSchema.pre('save', function (next) {
    this.lastEdited = new Date();
    if (this.content.text) {
        this.metadata.characterCount = this.content.text.length;
    }
    next();
});

module.exports = mongoose.model('Draft', DraftSchema);
