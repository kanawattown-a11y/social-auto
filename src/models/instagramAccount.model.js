const mongoose = require('mongoose');

const instagramAccountSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    username: {
        type: String,
        required: true
    },
    password: { // Encrypted password stored here
        type: String,
        required: false, // Optional for backward compatibility
        select: false    // Don't return in queries by default for security
    },
    sessionData: { // Stores serialized instagram-private-api state
        type: Object,
        default: {}
    },
    status: {
        type: String,
        enum: ['connected', 'disconnected', 'error'],
        default: 'disconnected'
    },
    lastActivityAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('InstagramAccount', instagramAccountSchema);
