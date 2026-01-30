const express = require('express');
const router = express.Router();
const { createCampaign, getCampaigns } = require('../controllers/campaign.controller');
const { protect } = require('../middleware/auth.middleware');

router.post('/', protect, createCampaign);
router.get('/', protect, getCampaigns);

module.exports = router;
