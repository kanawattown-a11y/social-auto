const mongoose = require('mongoose');

const WhatsappAccountSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  number: {
    type: String,
    required: true,
  },
  // Session data to avoid re-scanning QR code
  sessionData: {
    type: JSON,
  },
  status: {
    type: String,
    enum: ['connected', 'disconnected', 'pending_qr'],
    default: 'disconnected',
  },
}, {
  timestamps: true,
});

const WhatsappAccount = mongoose.model('WhatsappAccount', WhatsappAccountSchema);

module.exports = WhatsappAccount;