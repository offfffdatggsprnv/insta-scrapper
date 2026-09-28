# InstaExtract — Instagram Carousel Text & OCR Studio

A system for extracting all text present across every image in an Instagram carousel post automatically.

---

## 🌟 Key Features

1. **Automatic Carousel Navigation & Capture**:
   - Give any Instagram carousel link (e.g., `https://www.instagram.com/p/SHORTCODE/`).
   - The built-in headless browser engine automatically launches, navigates to the post, dismisses login/cookie modals, and sequentially captures crystal-clear image snapshots of every slide in the carousel (up to 20 slides).

2. **Optical Character Recognition (OCR)**:
   - **Tesseract.js (Built-in & Free)**: Runs locally without external API keys or rate limits.
   - **Multi-Language Support**: Supports English, Spanish, French, German, Hindi, Portuguese, Italian, Japanese, and Chinese.
   - **Optional AI Vision (Gemini 2.5 Flash)**: Can be enabled in options with your Gemini API key for structured Markdown output (headings, bullet points, tables, and post summaries).

3. **Multi-View Results Studio**:
   - **Slide Viewer (Split View)**: Inspect each slide image on the left side-by-side with its transcribed text on the right, with slide navigation and thumbnail carousel.
   - **Grid View**: Visual card overview of all slides and extracted text simultaneously.
   - **Full Text View**: Unified clean document combining all slides with slide markers.
   - **Real-Time Keyword Search**: Search words across all slides with instant match counting.

4. **Multi-Format Export**:
   - One-click **Copy All Text** or **Copy Individual Slide**.
   - Download as **Markdown (`.md`)**.
   - Download as **Plain Text (`.txt`)**.
   - Download as **JSON (`.json`)** containing slide data, metadata, word counts, and confidence scores.

5. **Direct Image Upload / Fallback**:
   - You can also drag & drop saved carousel slides or paste screenshots directly (`Ctrl+V`) for instant OCR text extraction without fetching.

---

## 🚀 Getting Started

### 1. Start the Server
```bash
npm start
```
The server will start on: **`http://localhost:3000`**

### 2. Usage
1. Open [http://localhost:3000](http://localhost:3000) in your web browser.
2. Paste any Instagram carousel post URL in the input field.
3. Click **"Extract All Carousel Text"**.
4. Watch the live progress stepper as each slide is loaded, captured, and transcribed.
5. Review the slides, edit or search the text, and export in your desired format (Markdown, TXT, or JSON).

---

## 🛠️ Architecture

```
Vacation run/
├── server.js              # Express API & Server-Sent Events (SSE) server
├── lib/
│   ├── scraper.js         # Playwright Instagram carousel extractor
│   ├── ocr.js             # Tesseract.js & optional Gemini AI Vision OCR
│   └── jobs.js            # Asynchronous job queue & progress broadcasting
├── public/
│   ├── index.html         # Modern dark glassmorphic interface
│   ├── style.css          # Design system, micro-animations, responsive layout
│   └── app.js             # Frontend reactive logic & slide viewer
└── package.json
```
