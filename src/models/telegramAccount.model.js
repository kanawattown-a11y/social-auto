const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
    id: { type: String, required: true },
    title: String,
    type: String,
    username: String
}, { _id: false });

const telegramAccountSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    botToken: {
        type: String,
        required: true,
        unique: true
    },
    botUsername: {
        type: String,
        required: true
    },
    botName: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'error'],
        default: 'active'
    },
    savedChats: {
        type: [chatSchema],
        default: []
    },
    lastActivityAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('TelegramAccount', telegramAccountSchema);
