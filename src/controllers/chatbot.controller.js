const ChatbotRule = require('../models/chatbotRule.model');

exports.createRule = async (req, res) => {
  try {
    const { accountId, accountModel, keyword, response } = req.body;

    const rule = await ChatbotRule.create({
      accountId,
      accountModel,
      keyword,
      response
    });

    res.status(201).json(rule);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getRules = async (req, res) => {
  try {
    const rules = await ChatbotRule.find({});
    res.json(rules);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteRule = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Deleting chatbot rule:', id);

    const result = await ChatbotRule.findByIdAndDelete(id);

    if (!result) {
      console.log('Rule not found:', id);
      return res.status(404).json({ message: 'Rule not found' });
    }

    console.log('Rule deleted successfully:', id);
    res.json({ message: 'Rule deleted successfully' });
  } catch (error) {
    console.error('Delete rule error:', error);
    res.status(500).json({ message: error.message });
  }
};
