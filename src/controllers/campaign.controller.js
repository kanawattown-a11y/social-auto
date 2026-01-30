const Campaign = require('../models/campaign.model');
const cronService = require('../services/cron.service');

exports.createCampaign = async (req, res) => {
  try {
    const { name, type, targetGroup, message, schedule, delay } = req.body;

    const campaign = await Campaign.create({
      userId: req.user._id,
      name,
      type,
      targetGroup,
      message,
      schedule,
      delay
    });

    if (!schedule.isScheduled) {
      cronService.processCampaign(campaign);
    }

    res.status(201).json(campaign);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json(campaigns);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
