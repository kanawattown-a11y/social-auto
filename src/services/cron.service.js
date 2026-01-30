const cron = require('node-cron');
const Campaign = require('../models/campaign.model');
const whatsappService = require('./whatsapp.service');

class CronService {
  init() {
    cron.schedule('* * * * *', async () => {
      console.log('Running Campaign Scheduler...');
      try {
        const now = new Date();
        const pendingCampaigns = await Campaign.find({
          status: 'pending',
          'schedule.isScheduled': true,
          'schedule.sendAt': { $lte: now }
        });

        for (const campaign of pendingCampaigns) {
          this.processCampaign(campaign);
        }
      } catch (error) {
        console.error('Scheduler Error:', error);
      }
    });
  }

  async processCampaign(campaign) {
    console.log(`Starting campaign: ${campaign.name}`);
    campaign.status = 'running';
    await campaign.save();

    try {
      if (campaign.type === 'whatsapp') {
        const client = whatsappService.getClient(campaign.userId.toString());

        if (!client) {
          console.error(`Client not active for user ${campaign.userId}. Skipping campaign.`);
          campaign.status = 'failed';
          await campaign.save();
          return;
        }

        for (const number of campaign.targetGroup) {
          const currentCampaign = await Campaign.findById(campaign._id);
          if (currentCampaign.status !== 'running') break;

          await whatsappService.sendMessage(campaign.userId, number, campaign.message.text);

          const delay = Math.floor(Math.random() * (campaign.delay.max - campaign.delay.min + 1) + campaign.delay.min) * 1000;
          console.log(`Sent to ${number}, waiting ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
        }

        campaign.status = 'completed';
        await campaign.save();
      }
    } catch (error) {
      console.error(`Campaign ${campaign._id} failed:`, error);
      campaign.status = 'failed';
      await campaign.save();
    }
  }
}

module.exports = new CronService();
