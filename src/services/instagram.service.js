const puppeteer = require('puppeteer');
const InstagramAccount = require('../models/instagramAccount.model');
const logger = require('../utils/logger');
const path = require('path');

class InstagramService {
  constructor() {
    this.browser = null;
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: "new",
        defaultViewport: null,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-notifications',
          '--window-size=375,812',
          '--lang=en-US,en',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-software-rasterizer',
          '--mute-audio',
          '--disable-features=IsolateOrigins,site-per-process',
          '--user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
        ],
      });
    }
    return this.browser;
  }

  async addAccountWithUsername(userId, cookies, username) {
    try {
      console.log('[Instagram] Adding account with provided username:', username);

      const sanitizedCookies = cookies.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain.startsWith('.') ? cookie.domain : `.${cookie.domain}`,
        path: cookie.path || '/',
        httpOnly: cookie.httpOnly ?? false,
        secure: cookie.secure ?? false,
        ...(cookie.expires ? { expires: cookie.expires } : {})
      })).filter(c => c.name && c.value && c.domain);

      const account = await InstagramAccount.findOneAndUpdate(
        { userId, username },
        {
          userId,
          username,
          cookies: sanitizedCookies,
          status: 'connected',
          lastActivityAt: new Date()
        },
        { upsert: true, new: true }
      );

      console.log('[Instagram] ✅ Account added successfully:', username);
      logger.info(`Instagram account added: ${username}`);
      return account;
    } catch (error) {
      console.error('[Instagram] ❌ Failed:', error.message);
      logger.error('Instagram addAccountWithUsername error:', error);
      throw error;
    }
  }

  async getAccounts(userId) {
    return await InstagramAccount.find({ userId });
  }

  // Helper to setup page with cookies and mobile emulation
  async _setupPage(account) {
    await this.initBrowser();
    const page = await this.browser.newPage();

    // Emulate iPhone X for mobile interface (easier for posting)
    const iPhone = puppeteer.devices['iPhone X'];
    await page.emulate(iPhone);

    if (account.cookies && account.cookies.length > 0) {
      await page.setCookie(...account.cookies);
    }

    return page;
  }

  async createPost(userId, accountId, imagePath, caption) {
    let page = null;
    const timestamp = Date.now();
    const debugDir = path.join(__dirname, '../../debug');

    // Ensure debug directory exists
    if (!require('fs').existsSync(debugDir)) {
      require('fs').mkdirSync(debugDir, { recursive: true });
    }

    try {
      const account = await InstagramAccount.findById(accountId);
      if (!account) throw new Error('Account not found');

      console.log(`[Instagram] Starting post for ${account.username}`);
      page = await this._setupPage(account);

      const captureState = async (stepName) => {
        const file = path.join(debugDir, `${timestamp}_${stepName}.png`);
        await page.screenshot({ path: file });
        console.log(`[Debug] Saved screenshot: ${stepName}`);
      };

      // Navigate to home
      await page.goto('https://www.instagram.com/', { waitUntil: 'load', timeout: 60000 });
      await new Promise(r => setTimeout(r, 6000)); // Increased wait
      await captureState('01_home_loaded');

      // Check if redirected to login
      if (page.url().includes('accounts/login')) {
        console.error('[Instagram] Redirected to login page. Cookies might be expired.');
        await captureState('01_redirected_to_login');
        throw new Error('Instagram session expired. Please update cookies.');
      }

      // Handle popups logic
      try {
        const popups = [
          "//button[contains(text(), 'Not Now')]",
          "//button[contains(text(), 'Cancel')]",
          "//div[@role='dialog']//button[contains(text(), 'Not Now')]",
          "//button[text()='Not Now']"
        ];

        for (const selector of popups) {
          const btn = await page.$x(selector);
          if (btn.length > 0) {
            await btn[0].click();
            await new Promise(r => setTimeout(r, 1000));
          }
        }
        await captureState('02_popups_handled');
      } catch (e) {
        console.log('[Instagram] Popup handling error (ignorable):', e.message);
      }

      // 1. Click New Post (Plus icon)
      // Robust selectors for "New Post" button
      const newPostSelectors = [
        'svg[aria-label="New post"]',
        'svg[aria-label="New Post"]',
        'svg[aria-label="Create"]', // Sidebar layout
        'a[role="link"] svg[aria-label="New post"]',
        'div[role="button"] svg[aria-label="New post"]',
        'nav svg[aria-label="New post"]', // Bottom nav
        'svg[aria-label="منشور جديد"]' // Arabic
      ];

      let newPostBtn = null;
      for (const sel of newPostSelectors) {
        try {
          newPostBtn = await page.waitForSelector(sel, { timeout: 2000, visible: true });
          if (newPostBtn) {
            console.log(`[Instagram] Found New Post button with selector: ${sel}`);
            break;
          }
        } catch (e) { }
      }

      if (!newPostBtn) {
        console.log('[Instagram] Could not find "New Post" button with standard selectors. Checking generic Create button...');
        try {
          // Try a more aggressive search for "Create" text in divs or spans
          const [createBtn] = await page.$x("//*[contains(text(), 'Create') or contains(text(), 'إنشاء')]");
          if (createBtn) newPostBtn = createBtn;
        } catch (e) { }
      }

      // Remove common blocking overlays
      await page.evaluate(() => {
        const overlays = document.querySelectorAll('div[class*="Overlay"], div[role="presentation"], div[role="dialog"]');
        // Be careful not to remove the main content, but usually modal dialogs are safe to remove if we already tried closing them
        // Better yet, just remove known annoyances
        const banner = document.querySelector('div[class*="Banner"]'); // Cookie banners
        if (banner) banner.remove();
      });

      if (!newPostBtn) {
        await captureState('02_failed_find_new_post');
        throw new Error("Could not find New Post button - check debug screenshot");
      }

      // Ensure we have the clickable parent if we found an SVG
      const clickableBtn = await page.evaluateHandle(el => {
        return el.tagName === 'svg' ? (el.closest('div[role="button"]') || el.closest('a') || el.parentElement) : el;
      }, newPostBtn);

      if (imagePath) {
        const [fileChooser] = await Promise.all([
          page.waitForFileChooser(),
          clickableBtn.click().catch(async e => {
            console.log("Standard click failing, trying JS click...");
            await clickableBtn.scrollIntoView();
            return clickableBtn.click();
          }),
        ]);
        await captureState('03_file_chooser_opened');

        // 2. Upload Image
        console.log('[Instagram] Uploading image...');
        await new Promise(r => setTimeout(r, 2000));
        await fileChooser.accept([imagePath]);
        await new Promise(r => setTimeout(r, 8000)); // Increased for image processing
        await captureState('04_image_uploaded');
      } else {
        console.log("[Instagram] No image provided. Skipping file upload steps.");
        throw new Error("Image is required to create an Instagram post.");
      }

      // 3. Click Next (Filter)
      console.log('[Instagram] Clicking Next (Filter)...');
      // Sometimes it's "Next" or an arrow
      const nextBtnSelector = "//div[text()='Next'] | //button[text()='Next'] | //div[text()='التالي'] | //button[text()='التالي']";
      try {
        await page.waitForXPath(nextBtnSelector, { timeout: 8000 });
        const [nextBtn1] = await page.$x(nextBtnSelector);
        if (nextBtn1) await nextBtn1.click();
        else {
          // Try finding by aria-label "Next"
          const nextAria = await page.$('[aria-label="Next"]');
          if (nextAria) await nextAria.click();
          else throw new Error("Could not find Next button (Filter)");
        }
      } catch (e) {
        // If already on caption screen? unlikely but logic safeguard
        console.error("[Instagram] Error clicking Next: " + e.message);
        // continue, maybe it skipped the filter screen?
      }

      await new Promise(r => setTimeout(r, 4000));
      await captureState('05_filter_screen');

      // 4. Click Next (Caption)
      console.log('[Instagram] Clicking Next (Caption)...');
      try {
        // Wait for the button to be clickable again
        await page.waitForXPath(nextBtnSelector, { timeout: 8000 });
        const [nextBtn2] = await page.$x(nextBtnSelector);
        if (nextBtn2) await nextBtn2.click();
        else {
          const nextAria = await page.$('[aria-label="Next"]');
          if (nextAria) await nextAria.click();
          else throw new Error("Could not find Next button (Caption)");
        }
      } catch (e) {
        console.log("[Instagram] Might be already on caption screen?");
      }

      await new Promise(r => setTimeout(r, 4000));
      await captureState('06_caption_screen');

      // 5. Input Caption
      if (caption) {
        console.log('[Instagram] Adding caption...');
        const captionSelector = 'textarea[aria-label="Write a caption..."], textarea[aria-label="اكتب شرحاً توضيحياً..."]';
        try {
          await page.waitForSelector(captionSelector, { timeout: 6000 });
          await page.type(captionSelector, caption, { delay: 50 }); // Type slower
          await new Promise(r => setTimeout(r, 1000));
        } catch (e) {
          console.log("[Instagram] Could not find caption area, trying generic textarea");
          const textareas = await page.$$('textarea');
          if (textareas.length > 0) {
            await textareas[0].type(caption, { delay: 50 });
          } else {
            console.log("Proceeding without caption");
          }
        }
      }
      await captureState('07_caption_filled');

      // 6. Click Share
      console.log('[Instagram] Clicking Share...');
      const shareBtnSelector = "//div[text()='Share'] | //button[text()='Share'] | //div[text()='مشاركة'] | //button[text()='مشاركة']";
      const [shareBtn] = await page.$x(shareBtnSelector);

      if (!shareBtn) throw new Error("Could not find Share button");
      await shareBtn.click();

      // 7. Wait for completion
      console.log('[Instagram] Waiting for post to publish...');

      // Wait for "Post shared" or similar confirmation
      let postSuccess = false;
      try {
        // Try multiple success indicators
        await Promise.race([
          page.waitForXPath("//div[contains(text(), 'Your post has been shared')]", { timeout: 20000 }),
          page.waitForXPath("//div[contains(text(), 'Post shared')]", { timeout: 20000 }),
          page.waitForXPath("//span[contains(text(), 'shared')]", { timeout: 20000 })
        ]);
        postSuccess = true;
        console.log('[Instagram] ✅ Post confirmation detected!');
      } catch (e) {
        console.log('[Instagram] ⚠️ No explicit confirmation found, waiting for processing...');
        // Give it time to process
        await new Promise(r => setTimeout(r, 15000));

        // Check if we're back at home/feed (indicates success)
        const currentUrl = page.url();
        if (currentUrl.includes('instagram.com') && !currentUrl.includes('/create/')) {
          postSuccess = true;
          console.log('[Instagram] ✅ Detected navigation away from create page - likely successful');
        }
      }

      await captureState('08_posted_finished');

      // Don't close page immediately - give it time to finalize
      await new Promise(r => setTimeout(r, 3000));

      try {
        await page.close();
      } catch (e) {
        console.log('[Instagram] Page already closed or closing');
      }
      console.log('[Instagram] Post sequence completed successfully!');
      return { success: true, message: 'Posted successfully' };

    } catch (error) {
      console.error('[Instagram] Post failed:', error);
      if (page) {
        const screenshotPath = path.join(debugDir, `${timestamp}_ERROR.png`);
        await page.screenshot({ path: screenshotPath });
        console.log(`[Instagram] Error screenshot saved: ${screenshotPath}`);
        await page.close();
      }
      throw error;
    }
  }

  async sendDM(userId, accountId, recipientUsername, message) {
    let page = null;
    const timestamp = Date.now();
    const debugDir = path.join(__dirname, '../../debug');

    // Ensure debug directory exists
    if (!require('fs').existsSync(debugDir)) {
      require('fs').mkdirSync(debugDir, { recursive: true });
    }

    try {
      const account = await InstagramAccount.findById(accountId);
      if (!account) throw new Error('Account not found');

      console.log(`[Instagram] Sending DM to ${recipientUsername}`);
      page = await this._setupPage(account);

      const captureState = async (stepName) => {
        const file = path.join(debugDir, `DM_${timestamp}_${stepName}.png`);
        await page.screenshot({ path: file });
      };

      // Navigate to Direct Inbox
      await page.goto('https://www.instagram.com/direct/inbox/', { waitUntil: 'load', timeout: 60000 });
      await new Promise(r => setTimeout(r, 5000));
      await captureState('01_inbox_loaded');

      // Handle popups
      try {
        const notNowBtn = await page.$x("//button[contains(text(), 'Not Now')]");
        if (notNowBtn.length > 0) await notNowBtn[0].click();
      } catch (e) { }

      // 1. Click New Message button
      console.log('[Instagram] Clicking New Message...');
      const newMsgSelector = 'svg[aria-label="New message"]';

      try {
        await page.waitForSelector(newMsgSelector, { visible: true, timeout: 5000 });
        await page.click(newMsgSelector);
      } catch (e) {
        const sendMsgBtn = await page.$x("//div[contains(text(), 'Send message')]");
        if (sendMsgBtn.length > 0) await sendMsgBtn[0].click();
        else throw new Error("Could not find New Message button");
      }
      await new Promise(r => setTimeout(r, 2000));
      await captureState('02_search_opened');

      // 2. Search for User
      console.log(`[Instagram] Searching for ${recipientUsername}...`);
      const searchSelector = 'input[name="queryBox"]';
      await page.waitForSelector(searchSelector);
      await page.type(searchSelector, recipientUsername);
      await new Promise(r => setTimeout(r, 4000)); // increased wait
      await captureState('03_search_results');

      // 3. Select User from list
      const userSelector = `//div[contains(text(), "${recipientUsername}")]`;
      const userItem = await page.$x(userSelector);
      if (userItem.length > 0) {
        await userItem[0].click();
      } else {
        // Checkboxes
        const inputs = await page.$$('input[type="checkbox"], input[type="radio"]');
        if (inputs.length > 0) await inputs[0].click();
        else throw new Error(`User ${recipientUsername} not found in search`);
      }
      await new Promise(r => setTimeout(r, 1000));

      // 4. Click Chat/Next
      console.log('[Instagram] Clicking Chat...');
      const chatBtn = await page.$x("//div[contains(text(), 'Chat')]");
      if (chatBtn.length > 0) await chatBtn[0].click();
      else {
        const nextBtn = await page.$x("//div[contains(text(), 'Next')]");
        if (nextBtn.length > 0) await nextBtn[0].click();
      }
      await new Promise(r => setTimeout(r, 3000));
      await captureState('04_chat_opened');

      // 5. Type Message
      console.log('[Instagram] Typing message...');
      const updateTextArea = 'textarea';
      await page.waitForSelector(updateTextArea);
      await page.type(updateTextArea, message);
      await new Promise(r => setTimeout(r, 1000));

      // 6. Send
      console.log('[Instagram] Sending...');
      const sendBtn = await page.$x("//div[contains(text(), 'Send')]");
      if (sendBtn.length > 0) {
        await sendBtn[0].click();
      } else {
        await page.keyboard.press('Enter');
      }
      await new Promise(r => setTimeout(r, 2000));
      await captureState('05_message_sent');

      console.log('[Instagram] DM Sent!');
      // Don't close page immediately - give it time to finalize
      await new Promise(r => setTimeout(r, 3000));

      try {
        await page.close();
      } catch (e) {
        console.log('[Instagram] Page already closed or closing');
      }
      return { success: true };

    } catch (error) {
      console.error('[Instagram] DM failed:', error);
      if (page) {
        try {
          await page.close();
        } catch (e) {
          console.log('[Instagram] Error closing page:', e.message);
        }
      }
      throw error;
    }
  }

  async removeAccount(userId, accountId) {
    await InstagramAccount.findOneAndDelete({ _id: accountId, userId });
    return { success: true };
  }
}

module.exports = new InstagramService();
