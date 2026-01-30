const mongoose = require('mongoose');

const PaymentRequestSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    requestedPlan: {
        type: String,
        enum: ['pro', 'enterprise'],
        required: true,
    },
    currentPlan: {
        type: String,
        enum: ['free', 'pro', 'enterprise'],
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
    },
    paymentProof: {
        type: String, // URL or description of payment proof
        default: null,
    },
    notes: {
        type: String,
        default: null,
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    approvedAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('PaymentRequest', PaymentRequestSchema);
