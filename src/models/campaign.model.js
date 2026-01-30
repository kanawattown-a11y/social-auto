const mongoose = require('mongoose');

const CampaignSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['whatsapp', 'facebook-retargeting'],
    required: true,
  },
  // Array of phone numbers or Facebook User IDs
  targetGroup: {
    type: [String],
    required: true,
  },
  message: {
    text: {
      type: String,
      required: true,
    },
    mediaUrl: {
      type: String,
    },
  },
  schedule: {
    isScheduled: {
      type: Boolean,
      default: false,
    },
    sendAt: {
      type: Date,
    },
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed', 'paused'],
    default: 'pending',
  },
  // Delay between messages in seconds to avoid getting banned
  delay: {
    min: {
      type: Number,
      default: 20,
    },
    max: {
      type: Number,
      default: 90,
    },
  },
}, {
  timestamps: true,
});

const Campaign = mongoose.model('Campaign', CampaignSchema);

module.exports = Campaign;