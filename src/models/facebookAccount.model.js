const mongoose = require('mongoose');

const FacebookAccountSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  facebookId: {
    type: String,
  },
  name: {
    type: String,
  },
  // Storing cookies is sensitive. In a real-world app, this should be encrypted.
  cookies: {
    type: JSON,
    required: true,
  },
  accessToken: {
    type: {
      type: String,
      enum: ['lite', 'android', 'web'],
    },
    token: String,
    isValid: {
      type: Boolean,
      default: false,
    },
  },
  status: {
    type: String,
    enum: ['connected', 'disconnected', 'expired'],
    default: 'disconnected',
  }
}, {
  timestamps: true,
});

const FacebookAccount = mongoose.model('FacebookAccount', FacebookAccountSchema);

module.exports = FacebookAccount;