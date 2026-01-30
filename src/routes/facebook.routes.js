const express = require('express');
const router = express.Router();
const facebookController = require('../controllers/facebook.controller');
const { protect } = require('../middleware/auth.middleware');

// Account management
router.post('/accounts', protect, facebookController.addAccount);
router.get('/accounts', protect, facebookController.getAccounts);
router.delete('/accounts/:id', protect, facebookController.removeAccount);

// Scraping routes
router.post('/scrape-post', protect, facebookController.scrapePost);
router.post('/scrape-likes', protect, facebookController.scrapeLikes);
router.post('/scrape-members', protect, facebookController.scrapeMembers);
router.post('/extract-ads', protect, facebookController.extractAds);

module.exports = router;
