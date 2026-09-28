require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const jobManager = require('./lib/jobs');
const {
  scrapeInstagramCarousel,
  getSavedSessionInfo,
  saveSessionCookie,
  clearSession,
  launchInteractiveLogin
} = require('./lib/scraper');
const { processSlideOCR } = require('./lib/ocr');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer for direct file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 20 }
});

/**
 * Session Management Endpoints
 */
app.get('/api/session', (req, res) => {
  const info = getSavedSessionInfo();
  res.json(info);
});

app.post('/api/session/login', async (req, res) => {
  try {
    const result = await launchInteractiveLogin();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/session/cookie', (req, res) => {
  const { sessionid } = req.body;
  if (!sessionid || typeof sessionid !== 'string') {
    return res.status(400).json({ error: 'Valid sessionid cookie string is required.' });
  }
  const saved = saveSessionCookie(sessionid);
  res.json({ success: saved, message: 'Session cookie saved successfully.' });
});

app.post('/api/session/clear', (req, res) => {
  clearSession();
  res.json({ success: true, message: 'Session cleared.' });
});

/**
 * SSE Progress stream
 */
app.get('/api/progress/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobManager.getJob(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  jobManager.subscribe(jobId, res);
});

/**
 * Get job status / result
 */
app.get('/api/jobs/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobManager.getJob(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(job);
});

/**
 * Start extraction from Instagram URL
 */
app.post('/api/extract', async (req, res) => {
  const { url, ocrEngine = 'tesseract', lang = 'eng', apiKey = null, sessionCookie = null } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Please provide a valid Instagram post URL.' });
  }

  const job = jobManager.createJob('url', { url, ocrEngine, lang });
  res.json({ jobId: job.id, status: 'started' });

  // Run asynchronously
  (async () => {
    try {
      // 1. Scrape carousel slides (with optional sessionCookie)
      const scrapeResult = await scrapeInstagramCarousel(url, (progressData) => {
        jobManager.updateProgress(job.id, progressData);
      }, sessionCookie);

      const totalSlides = scrapeResult.slides.length;
      jobManager.updateProgress(job.id, {
        progress: 70,
        stage: 'Running OCR',
        message: `Running text recognition on ${totalSlides} slide(s)...`,
        totalSlides,
        currentSlide: 1
      });

      // 2. Perform OCR on each slide
      const ocrResults = [];
      for (let i = 0; i < totalSlides; i++) {
        const slide = scrapeResult.slides[i];
        jobManager.updateProgress(job.id, {
          progress: 70 + Math.round(((i + 1) / totalSlides) * 25),
          stage: 'Running OCR',
          message: `Extracting text from slide ${i + 1} of ${totalSlides}...`,
          currentSlide: i + 1,
          totalSlides
        });

        const ocrData = await processSlideOCR(slide, {
          engine: ocrEngine,
          lang,
          apiKey
        });

        ocrResults.push({
          slideNumber: i + 1,
          image: slide.base64Data,
          text: ocrData.text,
          confidence: ocrData.confidence,
          wordCount: ocrData.wordCount,
          charCount: ocrData.charCount,
          engine: ocrData.engine
        });
      }

      // 3. Assemble document and metrics
      const fullText = ocrResults
        .map(s => `--- Slide ${s.slideNumber} ---\n${s.text || '[No text detected]'}`)
        .join('\n\n');

      const totalWords = ocrResults.reduce((acc, s) => acc + s.wordCount, 0);
      const totalChars = ocrResults.reduce((acc, s) => acc + s.charCount, 0);
      const avgConfidence = Math.round(
        ocrResults.reduce((acc, s) => acc + s.confidence, 0) / (totalSlides || 1)
      );
      const readingTimeMinutes = Math.max(1, Math.round(totalWords / 200));

      const finalResult = {
        shortcode: scrapeResult.shortcode,
        url: scrapeResult.cleanUrl,
        postDetails: scrapeResult.postDetails,
        totalSlides,
        slides: ocrResults,
        fullText,
        stats: {
          totalSlides,
          totalWords,
          totalCharacters: totalChars,
          avgConfidence,
          readingTimeMinutes,
          ocrEngine
        }
      };

      jobManager.completeJob(job.id, finalResult);

    } catch (err) {
      console.error('Job error:', err);
      jobManager.failJob(job.id, err);
    }
  })();
});

/**
 * Direct file upload OCR (fallback or custom slides)
 */
app.post('/api/extract-files', upload.array('slides', 20), async (req, res) => {
  const files = req.files;
  const ocrEngine = req.body.ocrEngine || 'tesseract';
  const lang = req.body.lang || 'eng';
  const apiKey = req.body.apiKey || null;

  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'Please upload at least one image.' });
  }

  const job = jobManager.createJob('upload', { fileCount: files.length, ocrEngine, lang });
  res.json({ jobId: job.id, status: 'started' });

  // Run asynchronously
  (async () => {
    try {
      const totalSlides = files.length;
      jobManager.updateProgress(job.id, {
        progress: 10,
        stage: 'Processing Uploads',
        message: `Received ${totalSlides} image(s). Preparing OCR...`,
        totalSlides,
        currentSlide: 1
      });

      const ocrResults = [];
      for (let i = 0; i < totalSlides; i++) {
        const file = files[i];
        const base64Data = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

        jobManager.updateProgress(job.id, {
          progress: 10 + Math.round(((i + 1) / totalSlides) * 85),
          stage: 'Running OCR',
          message: `Extracting text from image ${i + 1} of ${totalSlides}...`,
          currentSlide: i + 1,
          totalSlides
        });

        const ocrData = await processSlideOCR({ base64Data }, {
          engine: ocrEngine,
          lang,
          apiKey
        });

        ocrResults.push({
          slideNumber: i + 1,
          fileName: file.originalname,
          image: base64Data,
          text: ocrData.text,
          confidence: ocrData.confidence,
          wordCount: ocrData.wordCount,
          charCount: ocrData.charCount,
          engine: ocrData.engine
        });
      }

      const fullText = ocrResults
        .map(s => `--- Slide ${s.slideNumber} (${s.fileName || ''}) ---\n${s.text || '[No text detected]'}`)
        .join('\n\n');

      const totalWords = ocrResults.reduce((acc, s) => acc + s.wordCount, 0);
      const totalChars = ocrResults.reduce((acc, s) => acc + s.charCount, 0);
      const avgConfidence = Math.round(
        ocrResults.reduce((acc, s) => acc + s.confidence, 0) / (totalSlides || 1)
      );

      const finalResult = {
        shortcode: 'upload-' + Date.now(),
        url: null,
        postDetails: {
          author: 'Uploaded Images',
          authorUrl: null,
          caption: `${totalSlides} custom image slides uploaded directly`,
          timestamp: new Date().toISOString()
        },
        totalSlides,
        slides: ocrResults,
        fullText,
        stats: {
          totalSlides,
          totalWords,
          totalCharacters: totalChars,
          avgConfidence,
          readingTimeMinutes: Math.max(1, Math.round(totalWords / 200)),
          ocrEngine
        }
      };

      jobManager.completeJob(job.id, finalResult);

    } catch (err) {
      console.error('Upload job error:', err);
      jobManager.failJob(job.id, err);
    }
  })();
});

// Start server
app.listen(PORT, () => {
  console.log(`Instagram Carousel Text Extractor running on http://localhost:${PORT}`);
});
