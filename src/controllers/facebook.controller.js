const FacebookAccount = require('../models/facebookAccount.model');
const puppeteerService = require('../services/puppeteer.service');
const logger = require('../utils/logger');

// Add Facebook account
exports.addAccount = async (req, res) => {
  try {
    const { cookies } = req.body;
    const userId = req.user._id;

    const account = await puppeteerService.verifyCookiesAndGetToken(userId, cookies);
    res.status(201).json(account);
  } catch (error) {
    logger.error('Add Facebook account error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get all Facebook accounts
exports.getAccounts = async (req, res) => {
  try {
    const accounts = await FacebookAccount.find({ userId: req.user._id });
    res.json(accounts);
  } catch (error) {
    logger.error('Get Facebook accounts error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Scrape post comments
exports.scrapePost = async (req, res) => {
  try {
    const { accountId, postUrl } = req.body;
    const account = await FacebookAccount.findOne({ _id: accountId, userId: req.user._id });

    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    logger.info(`Scraping comments from post: ${postUrl}`);
    const comments = await puppeteerService.scrapePostComments(account.cookies, postUrl);

    res.json({
      success: true,
      count: comments.length,
      comments: comments
    });
  } catch (error) {
    logger.error('Scrape post error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Scrape post likes
exports.scrapeLikes = async (req, res) => {
  try {
    const { accountId, postUrl } = req.body;
    const account = await FacebookAccount.findOne({ _id: accountId, userId: req.user._id });

    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    logger.info(`Scraping likes from post: ${postUrl}`);
    const likes = await puppeteerService.scrapePostLikes(account.cookies, postUrl);

    res.json({
      success: true,
      count: likes.length,
      likes: likes
    });
  } catch (error) {
    logger.error('Scrape likes error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Scrape group members
exports.scrapeMembers = async (req, res) => {
  try {
    const { accountId, groupUrl } = req.body;
    const account = await FacebookAccount.findOne({ _id: accountId, userId: req.user._id });

    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    logger.info(`Scraping members from group: ${groupUrl}`);
    const members = await puppeteerService.scrapeGroupMembers(account.cookies, groupUrl);

    res.json({
      success: true,
      count: members.length,
      members: members
    });
  } catch (error) {
    logger.error('Scrape members error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Extract ads data
exports.extractAds = async (req, res) => {
  try {
    const { accountId } = req.body;
    const account = await FacebookAccount.findOne({ _id: accountId, userId: req.user._id });

    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    const adsData = await puppeteerService.extractAdsData(account.cookies, accountId);
    res.json(adsData);
  } catch (error) {
    logger.error('Extract ads error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Remove Facebook account
exports.removeAccount = async (req, res) => {
  try {
    const account = await FacebookAccount.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    res.json({ message: 'Account removed successfully' });
  } catch (error) {
    logger.error('Remove Facebook account error:', error);
    res.status(500).json({ message: error.message });
  }
};
