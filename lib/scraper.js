const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SESSION_FILE_PATH = path.join(__dirname, '..', 'instagram_session.json');

/**
 * Check if a saved session exists
 */
function getSavedSessionInfo() {
  if (fs.existsSync(SESSION_FILE_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE_PATH, 'utf8'));
      const sessionCookie = data.cookies?.find(c => c.name === 'sessionid');
      const dsUser = data.cookies?.find(c => c.name === 'ds_user_id');
      if (sessionCookie && sessionCookie.value) {
        return {
          hasSession: true,
          userId: dsUser ? dsUser.value : null
        };
      }
    } catch (e) {}
  }
  return { hasSession: false, userId: null };
}

/**
 * Save raw sessionid cookie to storageState format
 */
function saveSessionCookie(sessionId) {
  if (!sessionId) return false;
  const cleanId = sessionId.trim().replace(/^sessionid=/, '');
  const storageState = {
    cookies: [
      {
        name: 'sessionid',
        value: cleanId,
        domain: '.instagram.com',
        path: '/',
        expires: Math.floor(Date.now() / 1000) + 365 * 24 * 3600,
        httpOnly: true,
        secure: true,
        sameSite: 'None'
      }
    ],
    origins: []
  };

  fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(storageState, null, 2));
  return true;
}

/**
 * Remove saved session
 */
function clearSession() {
  if (fs.existsSync(SESSION_FILE_PATH)) {
    fs.unlinkSync(SESSION_FILE_PATH);
  }
  return true;
}

/**
 * Launch an interactive visible browser for the user to log in once
 */
async function launchInteractiveLogin(timeoutMs = 90000) {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
  }).catch(() => chromium.launch({
    channel: 'msedge',
    headless: false,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
  }));

  const context = await browser.newContext({
    viewport: { width: 1000, height: 750 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();
  await page.goto('https://www.instagram.com/accounts/login/');

  return new Promise((resolve, reject) => {
    let resolved = false;

    // Check periodically for sessionid cookie
    const interval = setInterval(async () => {
      try {
        const cookies = await context.cookies();
        const hasSession = cookies.some(c => c.name === 'sessionid');
        if (hasSession) {
          resolved = true;
          clearInterval(interval);
          await context.storageState({ path: SESSION_FILE_PATH });
          await browser.close().catch(() => {});
          resolve({ success: true, message: 'Logged in successfully! Session saved.' });
        }
      } catch (err) {}
    }, 1500);

    // Timeout
    setTimeout(async () => {
      if (!resolved) {
        clearInterval(interval);
        await browser.close().catch(() => {});
        resolve({ success: false, message: 'Login window timed out. Please try again or paste your session cookie.' });
      }
    }, timeoutMs);
  });
}

/**
 * Clean & normalize Instagram post URLs
 */
function normalizeInstagramUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('A valid Instagram URL is required.');
  }

  const trimmed = rawUrl.trim();
  const match = trimmed.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  if (!match || !match[1]) {
    throw new Error('Invalid Instagram post URL. Please provide a link in the format: https://www.instagram.com/p/SHORTCODE/');
  }

  const shortcode = match[1];
  return {
    shortcode,
    cleanUrl: `https://www.instagram.com/p/${shortcode}/`
  };
}

/**
 * Launch Chrome or Edge with anti-detection flags
 */
async function launchBrowser() {
  const launchOptions = {
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--window-position=0,0',
      '--ignore-certifcate-errors',
      '--ignore-certifcate-errors-spki-list'
    ]
  };

  // 1. Try standard chromium (for Docker, Linux, Render container)
  try {
    return await chromium.launch(launchOptions);
  } catch (errStandard) {
    // 2. Fallback to native Chrome channel (Windows/macOS)
    try {
      return await chromium.launch({ channel: 'chrome', ...launchOptions });
    } catch (errChrome) {
      // 3. Fallback to Edge channel (Windows)
      return await chromium.launch({ channel: 'msedge', ...launchOptions });
    }
  }
}

/**
 * Scrape Instagram carousel post slides and metadata
 */
async function scrapeInstagramCarousel(rawUrl, onProgress = () => {}, customSessionId = null) {
  const { shortcode, cleanUrl } = normalizeInstagramUrl(rawUrl);

  onProgress({ progress: 10, stage: 'Connecting', message: 'Launching browser engine...' });
  const browser = await launchBrowser();

  const contextOptions = {
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-US'
  };

  // If a saved session file exists, load it
  if (fs.existsSync(SESSION_FILE_PATH)) {
    try {
      contextOptions.storageState = SESSION_FILE_PATH;
    } catch (e) {}
  }

  const context = await browser.newContext(contextOptions);

  // If custom session ID was provided in request, inject it
  if (customSessionId) {
    const cleanId = customSessionId.trim().replace(/^sessionid=/, '');
    await context.addCookies([
      {
        name: 'sessionid',
        value: cleanId,
        domain: '.instagram.com',
        path: '/',
        expires: Math.floor(Date.now() / 1000) + 365 * 24 * 3600,
        httpOnly: true,
        secure: true,
        sameSite: 'None'
      }
    ]).catch(() => {});
  }

  const page = await context.newPage();

  try {
    onProgress({ progress: 20, stage: 'Connecting', message: `Loading Instagram post (${shortcode})...` });

    await page.goto(cleanUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);

    // Dismiss any modal dialog / login banner / cookie banner
    try {
      const dismissSelectors = [
        'div[role="dialog"] button:has-text("Close")',
        'div[role="dialog"] svg[aria-label="Close"]',
        'svg[aria-label="Close"]',
        'button:has-text("Not now")',
        'button:has-text("Decline optional cookies")',
        'button:has-text("Only allow essential cookies")'
      ];

      for (const sel of dismissSelectors) {
        const el = await page.$(sel);
        if (el) {
          await el.click().catch(() => {});
          await page.waitForTimeout(800);
          break;
        }
      }
    } catch (e) {}

    // Check for Age Restriction or Strict Login Wall
    const restrictionCheck = await page.evaluate(() => {
      const text = document.body ? document.body.innerText : '';
      const isUnder18 = text.includes("People under 18 can't see this content") ||
                        text.includes("This account has set limits on who can see their profile") ||
                        text.includes("Restricted profile");
      const isBlocked = text.includes("Sorry, this page isn't available") ||
                        text.includes("The link you followed may be broken");
      return { isUnder18, isBlocked };
    });

    if (restrictionCheck.isUnder18) {
      throw new Error(
        "AGE_RESTRICTED: This account has set age or content limits (18+). Instagram requires a logged-in account to view this post. Please click 'Connect Instagram Account' or enter your sessionid cookie in options."
      );
    }

    if (restrictionCheck.isBlocked) {
      throw new Error(
        "This post is unavailable or private. If it is from a private account, please connect your Instagram session to view it."
      );
    }

    // Extract post author, caption & metadata
    onProgress({ progress: 30, stage: 'Extracting Metadata', message: 'Extracting post info and caption...' });
    const postDetails = await page.evaluate(() => {
      const authorEl = document.querySelector('header a, article h2 a, article header span a, div[role="dialog"] header a');
      const author = authorEl ? authorEl.innerText.trim() : 'instagram_user';

      const captionEl = document.querySelector('article h1, article div[data-testid="post-comment-root"] span, article ul li span, div[role="dialog"] h1');
      const caption = captionEl ? captionEl.innerText.trim() : '';

      const timeEl = document.querySelector('time');
      const timestamp = timeEl ? timeEl.getAttribute('datetime') : null;

      return {
        author,
        authorUrl: authorEl ? authorEl.href : null,
        caption,
        timestamp
      };
    });

    onProgress({ progress: 40, stage: 'Scanning Slides', message: 'Locating carousel container...' });

    // Find the carousel viewport container element
    const carouselBox = await page.evaluateHandle(() => {
      const candidates = [
        document.querySelector('article div[role="presentation"]'),
        document.querySelector('article ul')?.parentElement,
        document.querySelector('main div[role="presentation"]'),
        document.querySelector('article div._aagv')?.parentElement,
        document.querySelector('article'),
        document.querySelector('main')
      ];
      return candidates.find(el => el && el.getBoundingClientRect().width > 200);
    });

    const slides = [];
    let previousBuffer = null;
    let consecutiveDuplicates = 0;
    const maxSlides = 20;

    for (let slideNum = 1; slideNum <= maxSlides; slideNum++) {
      onProgress({
        progress: 40 + Math.min(slideNum * 3, 28),
        stage: 'Capturing Slides',
        message: `Capturing slide ${slideNum}...`,
        currentSlide: slideNum,
        totalSlides: Math.max(slideNum, slides.length)
      });

      // Capture screenshot of the active carousel viewport
      let frameBuffer = null;
      try {
        if (carouselBox) {
          frameBuffer = await carouselBox.screenshot({ type: 'png' });
        } else {
          const mainEl = await page.$('article, main');
          if (mainEl) frameBuffer = await mainEl.screenshot({ type: 'png' });
        }
      } catch (err) {
        console.warn(`Screenshot error on slide ${slideNum}:`, err.message);
      }

      if (!frameBuffer) {
        break;
      }

      // Check for deduplication (did the slide actually change?)
      if (previousBuffer && previousBuffer.length === frameBuffer.length && previousBuffer.equals(frameBuffer)) {
        console.log(`Slide ${slideNum} is identical to slide ${slideNum - 1}.`);
        consecutiveDuplicates++;

        // If duplicate detected, try pressing ArrowRight one more time
        if (consecutiveDuplicates === 1) {
          await page.keyboard.press('ArrowRight');
          await page.waitForTimeout(1000);
          continue;
        }

        // If still duplicate, end of carousel is confirmed!
        console.log(`End of carousel confirmed after ${slides.length} slides.`);
        break;
      }

      consecutiveDuplicates = 0;
      previousBuffer = frameBuffer;

      slides.push({
        slideNumber: slides.length + 1,
        base64Data: `data:image/png;base64,${frameBuffer.toString('base64')}`,
        sizeBytes: frameBuffer.length
      });

      console.log(`Successfully captured unique Slide ${slides.length}`);

      // Try navigating to next slide
      const navigationResult = await page.evaluate(() => {
        // Find visible button with 'next' aria-label
        const buttons = Array.from(document.querySelectorAll('button')).filter(b => {
          const label = (b.getAttribute('aria-label') || '').toLowerCase();
          return label.includes('next') || label.includes('suivant') || label.includes('prossimo');
        });

        const nextBtn = buttons.find(b => b && b.offsetParent !== null && !b.disabled);
        if (nextBtn) {
          nextBtn.click();
          return true;
        }
        return false;
      });

      // Also press ArrowRight on keyboard to ensure swipe transition
      await page.keyboard.press('ArrowRight').catch(() => {});
      await page.waitForTimeout(1200);

      // If no next button exists and we have slides, we reached the end
      if (!navigationResult && slideNum >= 2) {
        console.log(`No next button found in DOM after slide ${slides.length}. Carousel ended.`);
        break;
      }
    }

    if (slides.length === 0) {
      throw new Error('Could not find any images in the specified post. The post might be private or removed.');
    }

    onProgress({
      progress: 70,
      stage: 'Slides Captured',
      message: `Successfully captured all ${slides.length} unique slide(s). Ready for OCR.`,
      totalSlides: slides.length
    });

    return {
      shortcode,
      cleanUrl,
      postDetails,
      totalSlides: slides.length,
      slides
    };

  } finally {
    await browser.close().catch(() => {});
  }
}

module.exports = {
  normalizeInstagramUrl,
  scrapeInstagramCarousel,
  getSavedSessionInfo,
  saveSessionCookie,
  clearSession,
  launchInteractiveLogin
};
