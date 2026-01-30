const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const PaymentRequest = require('../models/paymentRequest.model');
const User = require('../models/user.model');
const PLAN_LIMITS = require('../config/plans');

// @desc    Create payment request (user requests upgrade)
// @route   POST /api/payment/request
// @access  Private
router.post('/request', protect, async (req, res) => {
    try {
        const { requestedPlan } = req.body;

        const user = await User.findById(req.user.id);
        const currentPlan = user.subscription?.plan || 'free';

        if (currentPlan === requestedPlan) {
            return res.status(400).json({ message: 'أنت مشترك بالفعل في هذه الخطة' });
        }

        // Check if there's already a pending request
        const existingRequest = await PaymentRequest.findOne({
            user: req.user.id,
            status: 'pending',
        });

        if (existingRequest) {
            return res.status(400).json({
                message: 'لديك طلب ترقية قيد المراجعة بالفعل',
                request: existingRequest,
            });
        }

        const amount = PLAN_LIMITS[requestedPlan].price;

        const paymentRequest = await PaymentRequest.create({
            user: req.user.id,
            requestedPlan,
            currentPlan,
            amount,
        });

        res.status(201).json({
            message: 'تم إنشاء طلب الترقية بنجاح',
            request: paymentRequest,
            whatsappNumber: process.env.PAYMENT_WHATSAPP || '+963123456789',
            instructions: `يرجى تحويل مبلغ $${amount} وإرسال إثبات الدفع عبر واتساب`,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get user's payment requests
// @route   GET /api/payment/my-requests
// @access  Private
router.get('/my-requests', protect, async (req, res) => {
    try {
        const requests = await PaymentRequest.find({ user: req.user.id })
            .sort({ createdAt: -1 });

        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get all payment requests (Admin)
// @route   GET /api/payment/requests
// @access  Private/Admin
router.get('/requests', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user.isAdmin) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const { status } = req.query;
        const query = status ? { status } : {};

        const requests = await PaymentRequest.find(query)
            .populate('user', 'username email')
            .populate('approvedBy', 'username')
            .sort({ createdAt: -1 });

        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Approve payment request (Admin)
// @route   PUT /api/payment/approve/:id
// @access  Private/Admin
router.put('/approve/:id', protect, async (req, res) => {
    try {
        const adminUser = await User.findById(req.user.id);

        if (!adminUser.isAdmin) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const paymentRequest = await PaymentRequest.findById(req.params.id);

        if (!paymentRequest) {
            return res.status(404).json({ message: 'Payment request not found' });
        }

        if (paymentRequest.status !== 'pending') {
            return res.status(400).json({ message: 'هذا الطلب تمت معالجته بالفعل' });
        }

        // Update user subscription
        const user = await User.findById(paymentRequest.user);
        user.subscription.plan = paymentRequest.requestedPlan;
        user.subscription.status = 'active';
        user.subscription.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        await user.save();

        // Update payment request
        paymentRequest.status = 'approved';
        paymentRequest.approvedBy = req.user.id;
        paymentRequest.approvedAt = new Date();
        await paymentRequest.save();

        res.json({
            message: 'تم تفعيل الاشتراك بنجاح',
            request: paymentRequest,
            user: {
                _id: user._id,
                username: user.username,
                subscription: user.subscription,
            },
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Reject payment request (Admin)
// @route   PUT /api/payment/reject/:id
// @access  Private/Admin
router.put('/reject/:id', protect, async (req, res) => {
    try {
        const adminUser = await User.findById(req.user.id);

        if (!adminUser.isAdmin) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const { notes } = req.body;

        const paymentRequest = await PaymentRequest.findById(req.params.id);

        if (!paymentRequest) {
            return res.status(404).json({ message: 'Payment request not found' });
        }

        paymentRequest.status = 'rejected';
        paymentRequest.notes = notes;
        paymentRequest.approvedBy = req.user.id;
        paymentRequest.approvedAt = new Date();
        await paymentRequest.save();

        res.json({
            message: 'تم رفض الطلب',
            request: paymentRequest,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
