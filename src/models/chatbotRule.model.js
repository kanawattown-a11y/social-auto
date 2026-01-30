const mongoose = require('mongoose');

const ChatbotRuleSchema = new mongoose.Schema({
  // The account (FB or WA) this rule applies to
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    // This allows us to reference different models
    refPath: 'accountModel',
  },
  accountModel: {
    type: String,
    required: true,
    enum: ['FacebookAccount', 'WhatsappAccount'],
  },
  keyword: {
    type: String,
    required: true,
    lowercase: true,
  },
  response: {
    text: {
      type: String,
      required: true,
    },
    mediaUrl: {
      type: String,
    },
    // For future use with interactive messages
    buttons: {
      type: JSON,
    },
  },
  isEnabled: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

const ChatbotRule = mongoose.model('ChatbotRule', ChatbotRuleSchema);

module.exports = ChatbotRule;