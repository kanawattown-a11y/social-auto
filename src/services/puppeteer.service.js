// Optional dependency - only load if available
let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (e) {
  console.warn('Puppeteer not installed - Facebook automation disabled');
}

const FacebookAccount = require('../models/facebookAccount.model');
const logger = require('../utils/logger');
const Analytics = require('../models/analytics.model');

class PuppeteerService {
  constructor() {
    this.browser = null;
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: "new",
        defaultViewport: null,
        ignoreHTTPSErrors: true,
        // pipe: true, // Removed pipe as it might cause stability issues
        protocolTimeout: 180000, // 3 minutes timeout
        dumpio: false, // Less noise
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-notifications',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-software-rasterizer',
          '--mute-audio',
          '--disable-features=IsolateOrigins,site-per-process',
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ],
      });
    }
    return this.browser;
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async verifyCookiesAndGetToken(userId, cookies) {
    let page = null;
    try {
      console.log('Initializing browser...');
      await this.initBrowser();
      console.log('Browser initialized. Opening new page...');
      page = await this.browser.newPage();

      if (typeof cookies === 'string') {
        cookies = JSON.parse(cookies);
      }

      // Strict cookie sanitization - remove ALL non-standard fields
      const sanitizedCookies = cookies.map(cookie => {
        const clean = {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain.startsWith('.') ? cookie.domain : `.${cookie.domain}`,
          path: cookie.path || '/',
          httpOnly: cookie.httpOnly ?? false,
          secure: cookie.secure ?? false
        };

        // Only add expires if it's a valid number
        if (cookie.expires && typeof cookie.expires === 'number' && cookie.expires > 0) {
          clean.expires = cookie.expires;
        }

        return clean;
      });

      // Filter out invalid cookies
      const validCookies = sanitizedCookies.filter(c => c.name && c.value && c.domain);
      console.log(`Setting ${validCookies.length} cookies...`);

      await page.setCookie(...validCookies);

      console.log('Navigating to Facebook Ads Manager...');
      // Changed to domcontentloaded to avoid hanging on network requests
      await page.goto('https://adsmanager.facebook.com/adsmanager/manage/campaigns', { waitUntil: 'domcontentloaded', timeout: 60000 });

      console.log('Checking for login redirection...');
      if (page.url().includes('login')) {
        throw new Error('Cookies invalid or expired - Redirected to login');
      }

      console.log('Waiting for content...');
      // Wait for a bit to ensure some content loads
      await new Promise(r => setTimeout(r, 5000));

      const content = await page.content();
      const tokenMatch = content.match(/EAAB[a-zA-Z0-9]+/);

      if (!tokenMatch) {
        console.log('Token not found in page content');
        throw new Error('Could not extract access token');
      }

      console.log('Token extracted successfully');
      const accessToken = tokenMatch[0];
      const name = "Facebook User";

      const account = await FacebookAccount.findOneAndUpdate(
        { userId: userId, facebookId: 'unknown' },
        {
          userId,
          cookies,
          accessToken: { token: accessToken, isValid: true, type: 'web' },
          status: 'connected',
          name
        },
        { upsert: true, new: true }
      );

      await page.close();
      return account;

    } catch (error) {
      console.error('Puppeteer Error Details:', error);
      if (page) await page.close();
      throw error;
    }
  }

  async scrapePostComments(cookies, postUrl) {
    let page = null;
    try {
      await this.initBrowser();
      page = await this.browser.newPage();

      if (typeof cookies === 'string') {
        cookies = JSON.parse(cookies);
      }
      await page.setCookie(...cookies);

      logger.info(`Navigating to post: ${postUrl}`);
      await page.goto(postUrl, { waitUntil: 'networkidle2', timeout: 60000 });

      // Scroll to load comments
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise(r => setTimeout(r, 2000));
      }

      const comments = await page.evaluate(() => {
        const commentElements = document.querySelectorAll('div[role="article"]');
        const results = [];

        commentElements.forEach(el => {
          const userEl = el.querySelector('span > a');
          const textEl = el.querySelector('div[dir="auto"]');
          const linkEl = el.querySelector('a[href*="/comment/"]');

          if (userEl && textEl) {
            results.push({
              author: userEl.innerText,
              text: textEl.innerText,
              link: linkEl ? linkEl.href : null,
              timestamp: new Date().toISOString()
            });
          }
        });
        return results;
      });

      logger.info(`Scraped ${comments.length} comments`);
      await page.close();
      return comments;

    } catch (error) {
      if (page) await page.close();
      logger.error('Scrape comments error:', error);
      throw error;
    }
  }

  async scrapePostLikes(cookies, postUrl) {
    let page = null;
    try {
      await this.initBrowser();
      page = await this.browser.newPage();

      if (typeof cookies === 'string') {
        cookies = JSON.parse(cookies);
      }

      // Sanitize cookies to remove unsupported fields
      const sanitizedCookies = cookies.map(cookie => {
        const clean = {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain.startsWith('.') ? cookie.domain : `.${cookie.domain}`,
          path: cookie.path || '/',
          httpOnly: cookie.httpOnly || false,
          secure: cookie.secure || false
        };
        if (cookie.sameSite) clean.sameSite = cookie.sameSite;
        if (cookie.expires && cookie.expires > 0) clean.expires = cookie.expires;
        return clean;
      });

      await page.setCookie(...sanitizedCookies);

      logger.info(`Navigating to post for likes: ${postUrl}`);
      await page.goto(postUrl, { waitUntil: 'networkidle2', timeout: 60000 });

      // Click on reactions/likes count to open modal
      try {
        await page.waitForSelector('[aria-label*="reactions"]', { timeout: 5000 });
        await page.click('[aria-label*="reactions"]');
        await new Promise(r => setTimeout(r, 3000));
      } catch (e) {
        logger.warn('Could not find reactions button');
      }

      // Scroll in modal to load more likes
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => {
          const modal = document.querySelector('div[role="dialog"]');
          if (modal) {
            modal.scrollTop = modal.scrollHeight;
          }
        });
        await new Promise(r => setTimeout(r, 2000));
      }

      const likes = await page.evaluate(() => {
        const likeElements = document.querySelectorAll('div[role="dialog"] a[role="link"]');
        const results = [];
        const seen = new Set();

        likeElements.forEach(el => {
          const name = el.innerText;
          const link = el.href;

          if (name && link && !seen.has(link)) {
            seen.add(link);
            results.push({
              name: name,
              link: link
            });
          }
        });
        return results;
      });

      logger.info(`Scraped ${likes.length} likes`);
      await page.close();
      return likes;

    } catch (error) {
      if (page) await page.close();
      logger.error('Scrape likes error:', error);
      throw error;
    }
  }

  async scrapeGroupMembers(cookies, groupUrl) {
    let page = null;
    try {
      await this.initBrowser();
      page = await this.browser.newPage();

      if (typeof cookies === 'string') {
        cookies = JSON.parse(cookies);
      }

      // Sanitize cookies to remove unsupported fields
      const sanitizedCookies = cookies.map(cookie => {
        const clean = {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain.startsWith('.') ? cookie.domain : `.${cookie.domain}`,
          path: cookie.path || '/',
          httpOnly: cookie.httpOnly || false,
          secure: cookie.secure || false
        };
        if (cookie.sameSite) clean.sameSite = cookie.sameSite;
        if (cookie.expires && cookie.expires > 0) clean.expires = cookie.expires;
        return clean;
      });

      await page.setCookie(...sanitizedCookies);

      // Navigate to members page
      const membersUrl = groupUrl.replace(/\/$/, '') + '/members';
      logger.info(`Navigating to group members: ${membersUrl}`);
      await page.goto(membersUrl, { waitUntil: 'networkidle2', timeout: 60000 });

      // Scroll to load more members
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise(r => setTimeout(r, 2000));
      }

      const members = await page.evaluate(() => {
        const memberElements = document.querySelectorAll('div[role="list"] a[role="link"]');
        const results = [];
        const seen = new Set();

        memberElements.forEach(el => {
          const name = el.getAttribute('aria-label') || el.innerText;
          const link = el.href;

          if (name && link && link.includes('facebook.com') && !seen.has(link)) {
            seen.add(link);
            results.push({
              name: name,
              link: link
            });
          }
        });
        return results;
      });

      logger.info(`Scraped ${members.length} members`);
      await page.close();
      return members;

    } catch (error) {
      if (page) await page.close();
      logger.error('Scrape members error:', error);
      throw error;
    }
  }

  // Extract Facebook Ads data
  async extractAdsData(cookies, accountId) {
    let page = null;
    try {
      await this.initBrowser();
      page = await this.browser.newPage();

      if (typeof cookies === 'string') {
        cookies = JSON.parse(cookies);
      }
      await page.setCookie(...cookies);

      await page.goto('https://adsmanager.facebook.com/adsmanager/manage/campaigns', { waitUntil: 'networkidle2' });

      // Wait for ads table to load
      await page.waitForSelector('div[role="table"]', { timeout: 10000 });

      const adsData = await page.evaluate(() => {
        const rows = document.querySelectorAll('div[role="row"]');
        const ads = [];

        rows.forEach((row, index) => {
          if (index === 0) return; // Skip header
          const cells = row.querySelectorAll('div[role="cell"]');
          if (cells.length > 0) {
            ads.push({
              name: cells[0]?.innerText || '',
              status: cells[1]?.innerText || '',
              results: cells[2]?.innerText || '',
              reach: cells[3]?.innerText || '',
              impressions: cells[4]?.innerText || '',
              cost: cells[5]?.innerText || '',
            });
          }
        });
        return ads;
      });

      await page.close();
      logger.info(`Extracted ${adsData.length} ads for account ${accountId}`);
      return adsData;

    } catch (error) {
      if (page) await page.close();
      logger.error('Ads extraction error:', error);
      throw error;
    }
  }

  // Send message via Facebook Messenger
  async sendMessengerMessage(cookies, recipientId, message) {
    let page = null;
    try {
      await this.initBrowser();
      page = await this.browser.newPage();

      if (typeof cookies === 'string') {
        cookies = JSON.parse(cookies);
      }
      await page.setCookie(...cookies);

      await page.goto(`https://www.facebook.com/messages/t/${recipientId}`, { waitUntil: 'networkidle2' });

      // Wait for message input
      await page.waitForSelector('div[contenteditable="true"]', { timeout: 10000 });

      // Type message
      await page.type('div[contenteditable="true"]', message);

      // Press Enter to send
      await page.keyboard.press('Enter');

      await new Promise(r => setTimeout(r, 2000));
      await page.close();

      logger.info(`Sent Messenger message to ${recipientId}`);
      return { success: true, recipientId, message };

    } catch (error) {
      if (page) await page.close();
      logger.error('Messenger send error:', error);
      throw error;
    }
  }

  // Auto-like a post
  async likePost(cookies, postUrl) {
    let page = null;
    try {
      await this.initBrowser();
      page = await this.browser.newPage();

      if (typeof cookies === 'string') {
        cookies = JSON.parse(cookies);
      }
      await page.setCookie(...cookies);

      await page.goto(postUrl, { waitUntil: 'networkidle2' });

      // Find and click like button
      const likeButton = await page.$('div[aria-label="Like"]');
      if (likeButton) {
        await likeButton.click();
        await new Promise(r => setTimeout(r, 1000));
        await page.close();
        logger.info(`Liked post: ${postUrl}`);
        return { success: true, postUrl };
      } else {
        throw new Error('Like button not found');
      }

    } catch (error) {
      if (page) await page.close();
      logger.error('Auto-like error:', error);
      throw error;
    }
  }

  // Auto-comment on a post
  async commentOnPost(cookies, postUrl, commentText) {
    let page = null;
    try {
      await this.initBrowser();
      page = await this.browser.newPage();

      if (typeof cookies === 'string') {
        cookies = JSON.parse(cookies);
      }
      await page.setCookie(...cookies);

      await page.goto(postUrl, { waitUntil: 'networkidle2' });

      // Find comment box
      await page.waitForSelector('div[contenteditable="true"][aria-label*="comment"]', { timeout: 10000 });

      // Click to focus
      await page.click('div[contenteditable="true"][aria-label*="comment"]');

      // Type comment
      await page.type('div[contenteditable="true"][aria-label*="comment"]', commentText);

      // Press Enter to post
      await page.keyboard.press('Enter');

      await new Promise(r => setTimeout(r, 2000));
      await page.close();

      logger.info(`Commented on post: ${postUrl}`);
      return { success: true, postUrl, comment: commentText };

    } catch (error) {
      if (page) await page.close();
      logger.error('Auto-comment error:', error);
      throw error;
    }
  }

  // Extract Page insights
  async extractPageInsights(cookies, pageId) {
    let page = null;
    try {
      await this.initBrowser();
      page = await this.browser.newPage();

      if (typeof cookies === 'string') {
        cookies = JSON.parse(cookies);
      }
      await page.setCookie(...cookies);

      await page.goto(`https://www.facebook.com/${pageId}/insights`, { waitUntil: 'networkidle2' });

      // Wait for insights to load
      await new Promise(r => setTimeout(r, 5000));

      const insights = await page.evaluate(() => {
        const data = {};

        // Try to extract metrics (selectors may vary)
        const metrics = document.querySelectorAll('div[data-testid="insights-metric"]');
        metrics.forEach(metric => {
          const label = metric.querySelector('span')?.innerText;
          const value = metric.querySelector('strong')?.innerText;
          if (label && value) {
            data[label] = value;
          }
        });

        return data;
      });

      await page.close();
      logger.info(`Extracted insights for page ${pageId}`);
      return insights;

    } catch (error) {
      if (page) await page.close();
      logger.error('Page insights error:', error);
      throw error;
    }
  }

  async scrapePostComments(cookies, postUrl) {
    let page = null;
    try {
      await this.initBrowser();
      page = await this.browser.newPage();

      const sanitizedCookies = cookies.map(cookie => {
        const clean = {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain.startsWith('.') ? cookie.domain : `.${cookie.domain}`,
          path: cookie.path || '/',
          httpOnly: cookie.httpOnly ?? false,
          secure: cookie.secure ?? false
        };
        if (cookie.expires && typeof cookie.expires === 'number' && cookie.expires > 0) {
          clean.expires = cookie.expires;
        }
        return clean;
      });

      await page.setCookie(...sanitizedCookies.filter(c => c.name && c.value && c.domain));
      await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

      // Wait for comments to load
      await new Promise(r => setTimeout(r, 5000));

      const comments = await page.evaluate(() => {
        const commentElements = document.querySelectorAll('[role="article"]');
        const results = [];
        const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

        commentElements.forEach(el => {
          const text = el.innerText || '';
          const username = el.querySelector('a[role="link"]')?.innerText || 'Unknown';
          const phones = text.match(phoneRegex);

          results.push({
            username,
            text,
            phone: phones ? phones[0] : null
          });
        });

        return results;
      });

      await page.close();
      logger.info(`Scraped ${comments.length} comments from post`);
      return comments;

    } catch (error) {
      if (page) await page.close();
      logger.error('Scrape comments error:', error);
      throw error;
    }
  }

  async likePost(cookies, postUrl) {
    let page = null;
    try {
      await this.initBrowser();
      page = await this.browser.newPage();

      const sanitizedCookies = cookies.map(cookie => {
        const clean = {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain.startsWith('.') ? cookie.domain : `.${cookie.domain}`,
          path: cookie.path || '/',
          httpOnly: cookie.httpOnly ?? false,
          secure: cookie.secure ?? false
        };
        if (cookie.expires && typeof cookie.expires === 'number' && cookie.expires > 0) {
          clean.expires = cookie.expires;
        }
        return clean;
      });

      await page.setCookie(...sanitizedCookies.filter(c => c.name && c.value && c.domain));
      await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

      // Wait for page to load
      await new Promise(r => setTimeout(r, 3000));

      // Try to find and click like button
      const liked = await page.evaluate(() => {
        const likeButton = document.querySelector('[aria-label="Like"]') ||
          document.querySelector('[aria-label="أعجبني"]') ||
          document.querySelector('[data-testid="fb-ufi-likelink"]');

        if (likeButton) {
          likeButton.click();
          return true;
        }
        return false;
      });

      await new Promise(r => setTimeout(r, 3000));

      try {
        await page.close();
      } catch (e) {
        console.log('[Facebook] Page already closed or closing');
      }

      if (!liked) {
        throw new Error('Could not find like button');
      }

      logger.info('Post liked successfully');
      return { success: true, message: 'Post liked successfully' };

    } catch (error) {
      if (page) {
        try {
          await page.close();
        } catch (e) {
          console.log('[Facebook] Error closing page:', e.message);
        }
      }
      logger.error('Like post error:', error);
      throw error;
    }
  }

  async commentOnPost(cookies, postUrl, commentText) {
    let page = null;
    try {
      await this.initBrowser();
      page = await this.browser.newPage();

      const sanitizedCookies = cookies.map(cookie => {
        const clean = {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain.startsWith('.') ? cookie.domain : `.${cookie.domain}`,
          path: cookie.path || '/',
          httpOnly: cookie.httpOnly ?? false,
          secure: cookie.secure ?? false
        };
        if (cookie.expires && typeof cookie.expires === 'number' && cookie.expires > 0) {
          clean.expires = cookie.expires;
        }
        return clean;
      });

      await page.setCookie(...sanitizedCookies.filter(c => c.name && c.value && c.domain));
      await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

      // Wait for page to load
      await new Promise(r => setTimeout(r, 3000));

      // Try to find comment box and post comment
      const commented = await page.evaluate((text) => {
        const commentBox = document.querySelector('[aria-label="Write a comment..."]') ||
          document.querySelector('[aria-label="اكتب تعليقاً..."]') ||
          document.querySelector('[contenteditable="true"]');

        if (commentBox) {
          commentBox.focus();
          commentBox.innerText = text;

          // Trigger input event
          const event = new Event('input', { bubbles: true });
          commentBox.dispatchEvent(event);

          // Find and click submit button
          setTimeout(() => {
            const submitButton = document.querySelector('[data-testid="UFI2CommentSubmit/root"]') ||
              document.querySelector('[type="submit"]');
            if (submitButton) {
              submitButton.click();
            }
          }, 1000);

          return true;
        }
        return false;
      }, commentText);

      await new Promise(r => setTimeout(r, 4000)); // Wait for comment to post

      try {
        await page.close();
      } catch (e) {
        console.log('[Facebook] Page already closed or closing');
      }

      if (!commented) {
        throw new Error('Could not find comment box');
      }

      logger.info('Comment posted successfully');
      return { success: true, message: 'Comment posted successfully' };

    } catch (error) {
      if (page) {
        try {
          await page.close();
        } catch (e) {
          console.log('[Facebook] Error closing page:', e.message);
        }
      }
      logger.error('Comment post error:', error);
      throw error;
    }
  }

  async sendMessengerMessage(cookies, recipientId, message) {
    let page = null;
    try {
      await this.initBrowser();
      page = await this.browser.newPage();

      const sanitizedCookies = cookies.map(cookie => {
        const clean = {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain.startsWith('.') ? cookie.domain : `.${cookie.domain}`,
          path: cookie.path || '/',
          httpOnly: cookie.httpOnly ?? false,
          secure: cookie.secure ?? false
        };
        if (cookie.expires && typeof cookie.expires === 'number' && cookie.expires > 0) {
          clean.expires = cookie.expires;
        }
        return clean;
      });

      await page.setCookie(...sanitizedCookies.filter(c => c.name && c.value && c.domain));
      await page.goto(`https://www.facebook.com/messages/t/${recipientId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });

      // Wait for messenger to load
      await new Promise(r => setTimeout(r, 5000));

      // Try to find message box and send message
      const sent = await page.evaluate((msg) => {
        const messageBox = document.querySelector('[aria-label="Message"]') ||
          document.querySelector('[aria-label="رسالة"]') ||
          document.querySelector('[contenteditable="true"]');

        if (messageBox) {
          messageBox.focus();
          messageBox.innerText = msg;

          // Trigger input event
          const event = new Event('input', { bubbles: true });
          messageBox.dispatchEvent(event);

          // Find and click send button
          setTimeout(() => {
            const sendButton = document.querySelector('[aria-label="Press enter to send"]') ||
              document.querySelector('[aria-label="Send"]');
            if (sendButton) {
              sendButton.click();
            }
          }, 1000);

          return true;
        }
        return false;
      }, message);

      await new Promise(r => setTimeout(r, 3000));
      await page.close();

      if (!sent) {
        throw new Error('Could not find message box');
      }

      logger.info('Messenger message sent successfully');
      return { success: true, message: 'Message sent successfully' };

    } catch (error) {
      if (page) await page.close();
      logger.error('Send messenger message error:', error);
      throw error;
    }
  }

  // Auto-post to Facebook
  async createPost(cookies, post) {
    let page = null;
    try {
      if (!cookies || !post) throw new Error('Cookies and post data are required');

      const { text, mediaPath, mediaType } = post; // text, mediaPath, mediaType ('image'|'video')

      console.log('Initializing browser for Facebook posting...');
      await this.initBrowser();
      page = await this.browser.newPage();

      // Mobile emulation for easier posting? 
      // Actually desktop site often has "Photo/Video" button readily available on feed.
      // Let's try desktop first, if complex, switch to mobile. 
      // Mobile m.facebook.com/composer/mbasic sometimes works but is limited.
      // Let's stick to standard desktop but maybe mobile viewport.

      const sanitizedCookies = cookies.map(cookie => {
        const clean = {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain.startsWith('.') ? cookie.domain : `.${cookie.domain}`,
          path: cookie.path || '/',
          httpOnly: cookie.httpOnly ?? false,
          secure: cookie.secure ?? false
        };
        if (cookie.expires && typeof cookie.expires === 'number' && cookie.expires > 0) {
          clean.expires = cookie.expires;
        }
        return clean;
      });

      await page.setCookie(...sanitizedCookies.filter(c => c.name && c.value && c.domain));

      console.log('Navigating to Facebook Home...');
      await page.goto('https://www.facebook.com/', { waitUntil: 'load', timeout: 60000 });
      await new Promise(r => setTimeout(r, 5000));

      // 1. Click "What's on your mind?"
      // Selectors for create post area
      const createPostAreaSelectors = [
        'div[aria-label="What\'s on your mind, ' + (await this.getProfileName(page) || '') + '?" ]', // too specific
        'div[aria-label^="What\'s on your mind"]',
        'div[aria-label^="بم تفكر"]', // Arabic
        'div[role="button"] span[style*="webkit-box-orient: vertical"]'
      ];

      // Usually triggering the composer is just clicking the first big input-like div in the feed
      const composerTriggered = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('div[role="button"], div[role="textbox"]'));
        const createTrigger = inputs.find(el => {
          const txt = el.innerText || '';
          return txt.includes("What's on your mind") || txt.includes("بم تفكر");
        });
        if (createTrigger) {
          createTrigger.click();
          return true;
        }
        return false;
      });

      if (!composerTriggered) {
        // Try clicking the generic "Write something..." area by position if text fails?
        // Or search for "Photo/Video" button directly
        console.log("Could not find 'What's on your mind', trying Photo/Video button directly");
        const photoBtn = await page.$x("//div[contains(text(), 'Photo/video') or contains(text(), 'صورة/فيديو')]");
        if (photoBtn.length > 0) {
          await photoBtn[0].click();
        } else {
          throw new Error("Could not find Create Post area");
        }
      }

      await new Promise(r => setTimeout(r, 3000));

      // Composer should be open now.

      // 2. Upload Media (if any)
      if (mediaPath) {
        console.log('Uploading media...');
        // Find file input. It's usually hidden.
        // In the composer, there is an entry point for "Photo/Video".
        // Often clicking the green photo icon opens file chooser.

        const [fileChooser] = await Promise.all([
          page.waitForFileChooser(),
          page.evaluate(() => {
            // Find the input[type=file] inside the dialog
            const inputs = document.querySelectorAll('div[role="dialog"] input[type="file"]');
            if (inputs.length > 0) {
              // It might not be clickable directly if hidden, but usually the parent button is.
              // React Dropzone typically validation.
              // Let's try to click the "Photo/Video" button inside the dialog if file input is not visible.

              const dialog = document.querySelector('div[role="dialog"]');
              if (!dialog) return false;

              const photoIcon = Array.from(dialog.querySelectorAll('div[aria-label]')).find(el =>
                el.getAttribute('aria-label').includes('Photo/video') ||
                el.getAttribute('aria-label').includes('صورة/فيديو')
              );

              if (photoIcon) {
                photoIcon.click();
                return true;
              }
            }
            return false;
          })
        ]);

        if (!fileChooser) {
          // Fallback: Sometimes just searching for any file input works if the "Photo/video" button was clicked initially
          // If we failed to click the button inside dialog, maybe we simply attach to the input?
          // Facebook inputs are often complex.
          // Strategy: Click "Photo/Video" in the initial feed step OFTEN opens file chooser immediately on SOME layouts.
          console.log("File chooser did not open automatically. Checking for inputs...");
        }

        // If we have a file chooser, use it
        if (fileChooser) {
          await fileChooser.accept([mediaPath]);
          await new Promise(r => setTimeout(r, 5000)); // wait for upload
        } else {
          // Try appending an input if none exists (advanced, might fail on React apps)
          // Better: fail gracefully.
          throw new Error("Failed to trigger photo upload");
        }
      }

      // 3. Add Text
      if (text) {
        console.log('Adding text...');
        await page.evaluate((txt) => {
          const activeEl = document.activeElement;
          if (activeEl && activeEl.getAttribute('contenteditable') === 'true') {
            activeEl.innerText = txt;
            const event = new Event('input', { bubbles: true });
            activeEl.dispatchEvent(event);
            return;
          }
          // Fallback find
          const xbox = document.querySelector('div[role="dialog"] div[contenteditable="true"]');
          if (xbox) {
            xbox.focus();
            xbox.innerText = txt;
            const event = new Event('input', { bubbles: true });
            xbox.dispatchEvent(event);
          }
        }, text);
      }

      await new Promise(r => setTimeout(r, 3000));

      // 4. Click Post
      console.log('Clicking Post...');
      const posted = await page.evaluate(() => {
        const dialog = document.querySelector('div[role="dialog"]');
        if (!dialog) return false;

        const buttons = Array.from(dialog.querySelectorAll('div[role="button"]'));
        // The "Post" button usually has text "Post" or "نشر" and is blue.
        const postBtn = buttons.find(b =>
          (b.innerText === 'Post' || b.innerText === 'نشر') &&
          !b.getAttribute('aria-disabled') // valid
        );

        if (postBtn) {
          postBtn.click();
          return true;
        }
        return false;
      });

      if (!posted) throw new Error("Could not find Post button (or it was disabled)");

      await new Promise(r => setTimeout(r, 10000)); // wait for publish
      await page.close();

      return { success: true, message: "Posted to Facebook successfully" };

    } catch (error) {
      if (page) await page.close();
      logger.error('Create Post error:', error);
      throw error;
    }
  }

  async getProfileName(page) {
    try {
      return await page.evaluate(() => {
        // Try to find profile name in left sidebar or top nav
        return null;
      });
    } catch (e) { return null; }
  }
}

module.exports = new PuppeteerService();
