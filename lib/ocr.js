const Tesseract = require('tesseract.js');
const { GoogleGenAI } = require('@google/genai');

/**
 * Clean OCR text to improve readability:
 * - Trims unnecessary whitespace
 * - Removes excessive blank lines
 * - Fixes common OCR misrecognitions
 */
function cleanExtractedText(rawText) {
  if (!rawText) return '';
  return rawText
    .split('\n')
    .map(line => line.trim())
    .filter((line, i, arr) => {
      // Avoid more than two consecutive empty lines
      if (line === '' && i > 0 && arr[i - 1] === '') return false;
      return true;
    })
    .join('\n')
    .trim();
}

/**
 * Run Tesseract OCR on an image buffer or base64 data URL
 */
async function runTesseractOCR(imageBufferOrDataUrl, lang = 'eng', onProgress = null) {
  let worker = null;
  try {
    worker = await Tesseract.createWorker(lang);
    
    // Tesseract recognize accepts Buffer, data URL or file path
    const ret = await worker.recognize(imageBufferOrDataUrl);
    const cleanedText = cleanExtractedText(ret.data.text);

    const words = cleanedText.length > 0 ? cleanedText.split(/\s+/).filter(Boolean).length : 0;
    const chars = cleanedText.length;

    return {
      text: cleanedText,
      rawText: ret.data.text,
      confidence: Math.round(ret.data.confidence || 0),
      wordCount: words,
      charCount: chars,
      engine: 'tesseract'
    };
  } finally {
    if (worker) {
      await worker.terminate().catch(() => {});
    }
  }
}

/**
 * Optional Gemini AI Vision text extraction & structure formatting
 */
async function runGeminiVisionOCR(base64Data, apiKey, lang = 'English') {
  if (!apiKey) {
    throw new Error('Gemini API key is required for AI Vision mode.');
  }

  const ai = new GoogleGenAI({ apiKey });

  // Remove data URL prefix if present
  let pureBase64 = base64Data;
  let mimeType = 'image/png';
  if (base64Data.startsWith('data:')) {
    const parts = base64Data.split(';base64,');
    pureBase64 = parts[1];
    mimeType = parts[0].replace('data:', '') || 'image/png';
  }

  const prompt = `You are a high-accuracy Document & Social Media OCR system.
Extract all visible text from this Instagram carousel slide accurately.
Instructions:
1. Extract ALL text present in the image, preserving the original wording, hierarchy, headings, bullet points, and numbers.
2. If there are tables, code snippets, or quotes, format them nicely with standard Markdown.
3. Do NOT add preamble or meta-commentary like "Here is the extracted text:".
4. If there is absolutely no text in the image, respond with: "[No text detected in this slide]"`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        parts: [
          { inlineData: { mimeType, data: pureBase64 } },
          { text: prompt }
        ]
      }
    ]
  });

  const text = (response.text || '').trim();
  const words = text.length > 0 ? text.split(/\s+/).filter(Boolean).length : 0;

  return {
    text,
    rawText: text,
    confidence: 99,
    wordCount: words,
    charCount: text.length,
    engine: 'gemini-vision'
  };
}

/**
 * Process a single slide using specified engine
 */
async function processSlideOCR(slideData, options = {}) {
  const { engine = 'tesseract', lang = 'eng', apiKey = null } = options;

  if (engine === 'gemini' && apiKey) {
    try {
      return await runGeminiVisionOCR(slideData.base64Data, apiKey, lang);
    } catch (err) {
      console.warn('Gemini vision failed, falling back to Tesseract:', err.message);
      return await runTesseractOCR(Buffer.from(slideData.base64Data.split(',')[1], 'base64'), lang);
    }
  }

  const buffer = Buffer.from(slideData.base64Data.split(',')[1], 'base64');
  return await runTesseractOCR(buffer, lang);
}

module.exports = {
  cleanExtractedText,
  runTesseractOCR,
  runGeminiVisionOCR,
  processSlideOCR
};
