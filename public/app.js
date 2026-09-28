// InstaExtract Client Application

document.addEventListener('DOMContentLoaded', () => {
  // State
  let currentResult = null;
  let activeSlideIndex = 0;
  let uploadedFiles = [];
  let sseEventSource = null;

  // DOM Elements - Inputs & Tabs
  const tabUrl = document.getElementById('tab-url');
  const tabUpload = document.getElementById('tab-upload');
  const contentUrl = document.getElementById('content-url');
  const contentUpload = document.getElementById('content-upload');
  const urlInput = document.getElementById('instagram-url-input');
  const btnPaste = document.getElementById('btn-paste');
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const uploadPreviewContainer = document.getElementById('upload-preview-container');

  // Options
  const toggleOptions = document.getElementById('toggle-options');
  const optionsPanel = document.getElementById('options-panel');
  const chevronIcon = document.getElementById('chevron-icon');
  const ocrEngineSelect = document.getElementById('ocr-engine-select');
  const ocrLangSelect = document.getElementById('ocr-lang-select');
  const geminiKeyField = document.getElementById('gemini-key-field');
  const geminiApiKey = document.getElementById('gemini-api-key');

  // Actions
  const btnExtract = document.getElementById('btn-extract');
  const btnExtractText = document.getElementById('btn-extract-text');

  // Progress
  const progressCard = document.getElementById('progress-card');
  const progressStageTitle = document.getElementById('progress-stage-title');
  const progressMessage = document.getElementById('progress-message');
  const progressPercentage = document.getElementById('progress-percentage');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const step1 = document.getElementById('step-1');
  const step2 = document.getElementById('step-2');
  const step3 = document.getElementById('step-3');
  const step4 = document.getElementById('step-4');
  const line1 = document.getElementById('line-1');
  const line2 = document.getElementById('line-2');
  const line3 = document.getElementById('line-3');

  // Session & Authentication Elements
  const headerSessionBtn = document.getElementById('header-session-btn');
  const sessionStatusText = document.getElementById('session-status-text');
  const sessionBadge = document.getElementById('session-badge');
  const btnLoginWindow = document.getElementById('btn-login-window');
  const inputSessionCookie = document.getElementById('input-session-cookie');
  const btnSaveCookie = document.getElementById('btn-save-cookie');
  const btnClearSession = document.getElementById('btn-clear-session');
  const ageAlertCard = document.getElementById('age-alert-card');
  const btnAlertLogin = document.getElementById('btn-alert-login');
  const btnAlertCookie = document.getElementById('btn-alert-cookie');

  // Check saved session on load
  fetchSessionStatus();

  async function fetchSessionStatus() {
    try {
      const res = await fetch('/api/session');
      const data = await res.json();
      if (data.hasSession) {
        headerSessionBtn.className = 'header-session-btn connected';
        sessionStatusText.textContent = 'Instagram Connected (18+ Unlocked)';
        sessionBadge.className = 'tag tag-success';
        sessionBadge.textContent = 'Connected &bull; 18+ Unlocked';
        btnClearSession.style.display = 'inline-block';
      } else {
        headerSessionBtn.className = 'header-session-btn not-connected';
        sessionStatusText.textContent = 'Guest Mode (18+ posts locked)';
        sessionBadge.className = 'tag tag-warn';
        sessionBadge.textContent = 'Not Logged In';
        btnClearSession.style.display = 'none';
      }
    } catch (e) {}
  }

  // Session Action Listeners
  headerSessionBtn.addEventListener('click', () => {
    optionsPanel.classList.add('open');
    chevronIcon.classList.add('open');
    document.querySelector('.session-config-box').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  btnLoginWindow.addEventListener('click', handleLoginWindow);
  btnAlertLogin?.addEventListener('click', handleLoginWindow);

  async function handleLoginWindow() {
    showToast('Launching Instagram login window... Please log in.');
    try {
      const res = await fetch('/api/session/login', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('Successfully logged in! 18+ posts unlocked.');
        ageAlertCard.style.display = 'none';
        await fetchSessionStatus();
      } else {
        showToast(data.message || 'Login window closed without logging in.');
      }
    } catch (e) {
      showToast('Error opening login window: ' + e.message);
    }
  }

  btnSaveCookie.addEventListener('click', async () => {
    const val = inputSessionCookie.value.trim();
    if (!val) {
      showToast('Please paste a sessionid cookie string.');
      inputSessionCookie.focus();
      return;
    }

    try {
      const res = await fetch('/api/session/cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionid: val })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Session cookie saved successfully!');
        inputSessionCookie.value = '';
        ageAlertCard.style.display = 'none';
        await fetchSessionStatus();
      } else {
        showToast('Failed to save cookie.');
      }
    } catch (e) {
      showToast('Error: ' + e.message);
    }
  });

  btnClearSession.addEventListener('click', async () => {
    try {
      await fetch('/api/session/clear', { method: 'POST' });
      showToast('Instagram session disconnected.');
      await fetchSessionStatus();
    } catch (e) {}
  });

  btnAlertCookie?.addEventListener('click', () => {
    optionsPanel.classList.add('open');
    chevronIcon.classList.add('open');
    inputSessionCookie.focus();
    inputSessionCookie.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // Results
  const resultsSection = document.getElementById('results-section');
  const metaAvatar = document.getElementById('meta-avatar');
  const metaAuthor = document.getElementById('meta-author');
  const metaLink = document.getElementById('meta-link');
  const metaCaption = document.getElementById('meta-caption');
  const metricSlides = document.getElementById('metric-slides');
  const metricWords = document.getElementById('metric-words');
  const metricConfidence = document.getElementById('metric-confidence');
  const metricTime = document.getElementById('metric-time');

  // Views & Toolbar
  const viewBtns = document.querySelectorAll('.view-btn');
  const viewContainers = {
    split: document.getElementById('container-split'),
    grid: document.getElementById('container-grid'),
    doc: document.getElementById('container-doc')
  };
  const searchInput = document.getElementById('search-input');
  const searchCount = document.getElementById('search-count');

  // Split View Elements
  const activeSlideImg = document.getElementById('active-slide-img');
  const btnPrevSlide = document.getElementById('btn-prev-slide');
  const btnNextSlide = document.getElementById('btn-next-slide');
  const slideBadge = document.getElementById('slide-badge');
  const thumbStrip = document.getElementById('thumb-strip');
  const activeSlideTitle = document.getElementById('active-slide-title');
  const activeSlideConfidence = document.getElementById('active-slide-confidence');
  const activeSlideWords = document.getElementById('active-slide-words');
  const activeSlideText = document.getElementById('active-slide-text');
  const btnCopySlide = document.getElementById('btn-copy-slide');

  // Grid & Doc Elements
  const slidesGrid = document.getElementById('slides-grid');
  const docFullText = document.getElementById('doc-full-text');
  const docWordCount = document.getElementById('doc-word-count');

  // Export Buttons
  const btnCopyAll = document.getElementById('btn-copy-all');
  const btnDlMd = document.getElementById('btn-dl-md');
  const btnDlTxt = document.getElementById('btn-dl-txt');
  const btnDlJson = document.getElementById('btn-dl-json');
  const toast = document.getElementById('toast');

  // Initialize stored Gemini API key if present
  const storedKey = localStorage.getItem('insta_gemini_api_key');
  if (storedKey) {
    geminiApiKey.value = storedKey;
  }

  // ---------------------------------------------------------------------------
  // Tab Switching
  // ---------------------------------------------------------------------------
  tabUrl.addEventListener('click', () => {
    tabUrl.classList.add('active');
    tabUpload.classList.remove('active');
    contentUrl.classList.add('active');
    contentUpload.classList.remove('active');
  });

  tabUpload.addEventListener('click', () => {
    tabUpload.classList.add('active');
    tabUrl.classList.remove('active');
    contentUpload.classList.add('active');
    contentUrl.classList.remove('active');
  });

  // ---------------------------------------------------------------------------
  // Options Drawer & Engine Selector
  // ---------------------------------------------------------------------------
  toggleOptions.addEventListener('click', () => {
    optionsPanel.classList.toggle('open');
    chevronIcon.classList.toggle('open');
  });

  ocrEngineSelect.addEventListener('change', () => {
    if (ocrEngineSelect.value === 'gemini') {
      geminiKeyField.style.display = 'flex';
    } else {
      geminiKeyField.style.display = 'none';
    }
  });

  geminiApiKey.addEventListener('input', () => {
    localStorage.setItem('insta_gemini_api_key', geminiApiKey.value.trim());
  });

  // ---------------------------------------------------------------------------
  // Paste URL Helper
  // ---------------------------------------------------------------------------
  btnPaste.addEventListener('click', async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText) {
        urlInput.value = clipText.trim();
        showToast('Link pasted from clipboard!');
      }
    } catch (e) {
      urlInput.focus();
    }
  });

  // ---------------------------------------------------------------------------
  // Drag & Drop / File Uploads
  // ---------------------------------------------------------------------------
  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files?.length) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files?.length) {
      handleFiles(Array.from(fileInput.files));
    }
  });

  // Paste image directly from clipboard (Ctrl+V)
  window.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const pastedImages = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) pastedImages.push(file);
      }
    }
    if (pastedImages.length > 0) {
      tabUpload.click();
      handleFiles(pastedImages);
      showToast(`${pastedImages.length} image(s) pasted from clipboard!`);
    }
  });

  function handleFiles(files) {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      showToast('Please select valid image files (PNG, JPG, WEBP).');
      return;
    }
    uploadedFiles = [...uploadedFiles, ...imageFiles].slice(0, 20);
    renderUploadPreviews();
  }

  function renderUploadPreviews() {
    uploadPreviewContainer.innerHTML = '';
    uploadedFiles.forEach((file, index) => {
      const img = document.createElement('img');
      img.className = 'upload-thumb';
      img.src = URL.createObjectURL(file);
      img.title = `Slide ${index + 1}: ${file.name}`;
      uploadPreviewContainer.appendChild(img);
    });
    btnExtractText.textContent = `Extract Text from ${uploadedFiles.length} Slide(s)`;
  }

  // ---------------------------------------------------------------------------
  // Start Extraction Pipeline
  // ---------------------------------------------------------------------------
  btnExtract.addEventListener('click', async () => {
    const isUrlMode = tabUrl.classList.contains('active');
    const ocrEngine = ocrEngineSelect.value;
    const lang = ocrLangSelect.value;
    const apiKey = geminiApiKey.value.trim() || null;

    if (ocrEngine === 'gemini' && !apiKey) {
      showToast('Please enter your Gemini API key for AI Vision mode, or select Tesseract.');
      optionsPanel.classList.add('open');
      geminiKeyField.style.display = 'flex';
      geminiApiKey.focus();
      return;
    }

    if (isUrlMode) {
      const url = urlInput.value.trim();
      if (!url) {
        showToast('Please enter an Instagram post link.');
        urlInput.focus();
        return;
      }
      startUrlExtraction(url, ocrEngine, lang, apiKey);
    } else {
      if (uploadedFiles.length === 0) {
        showToast('Please drop or select at least one carousel image.');
        return;
      }
      startFileUploadExtraction(uploadedFiles, ocrEngine, lang, apiKey);
    }
  });

  // ---------------------------------------------------------------------------
  // URL Extraction API Call & Progress Listener
  // ---------------------------------------------------------------------------
  async function startUrlExtraction(url, ocrEngine, lang, apiKey) {
    resetProgressUI();
    ageAlertCard.style.display = 'none';
    progressCard.style.display = 'block';
    resultsSection.style.display = 'none';
    btnExtract.disabled = true;
    btnExtract.style.opacity = '0.6';

    try {
      const resp = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, ocrEngine, lang, apiKey })
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Failed to start extraction');
      }

      listenToProgress(data.jobId);
    } catch (err) {
      showToast('Error: ' + err.message);
      progressCard.style.display = 'none';
      btnExtract.disabled = false;
      btnExtract.style.opacity = '1';
    }
  }

  // ---------------------------------------------------------------------------
  // File Upload Extraction API Call
  // ---------------------------------------------------------------------------
  async function startFileUploadExtraction(files, ocrEngine, lang, apiKey) {
    resetProgressUI();
    ageAlertCard.style.display = 'none';
    progressCard.style.display = 'block';
    resultsSection.style.display = 'none';
    btnExtract.disabled = true;
    btnExtract.style.opacity = '0.6';

    const formData = new FormData();
    files.forEach(f => formData.append('slides', f));
    formData.append('ocrEngine', ocrEngine);
    formData.append('lang', lang);
    if (apiKey) formData.append('apiKey', apiKey);

    try {
      const resp = await fetch('/api/extract-files', {
        method: 'POST',
        body: formData
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Failed to upload images');
      }

      listenToProgress(data.jobId);
    } catch (err) {
      showToast('Error: ' + err.message);
      progressCard.style.display = 'none';
      btnExtract.disabled = false;
      btnExtract.style.opacity = '1';
    }
  }

  // ---------------------------------------------------------------------------
  // Server-Sent Events (SSE) Live Progress
  // ---------------------------------------------------------------------------
  function listenToProgress(jobId) {
    if (sseEventSource) {
      sseEventSource.close();
    }

    sseEventSource = new EventSource(`/api/progress/${jobId}`);

    sseEventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const { type, job } = payload;

        if (job) {
          updateProgressUI(job);

          if (type === 'completed' || job.status === 'completed') {
            sseEventSource.close();
            btnExtract.disabled = false;
            btnExtract.style.opacity = '1';
            progressCard.style.display = 'none';
            ageAlertCard.style.display = 'none';
            renderResults(job.result);
            showToast('All carousel text extracted successfully!');
          } else if (type === 'failed' || job.status === 'failed') {
            sseEventSource.close();
            btnExtract.disabled = false;
            btnExtract.style.opacity = '1';

            if (job.error && job.error.includes('AGE_RESTRICTED')) {
              progressCard.style.display = 'none';
              ageAlertCard.style.display = 'flex';
              ageAlertCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
              showToast('Age-restricted post. Please connect Instagram to view.');
            } else {
              showToast('Extraction failed: ' + (job.error || 'Unknown error'));
              progressStageTitle.textContent = 'Extraction Failed';
              progressMessage.textContent = job.error || 'Instagram blocked or post not available.';
            }
          }
        }
      } catch (e) {
        console.error('SSE parse error:', e);
      }
    };

    sseEventSource.onerror = () => {
      // Fallback polling if SSE disconnects
      setTimeout(async () => {
        try {
          const res = await fetch(`/api/jobs/${jobId}`);
          const job = await res.json();
          if (job.status === 'completed') {
            sseEventSource?.close();
            btnExtract.disabled = false;
            btnExtract.style.opacity = '1';
            progressCard.style.display = 'none';
            renderResults(job.result);
          }
        } catch (e) {}
      }, 2000);
    };
  }

  function resetProgressUI() {
    progressPercentage.textContent = '10%';
    progressBarFill.style.width = '10%';
    progressStageTitle.textContent = 'Starting Engine';
    progressMessage.textContent = 'Preparing browser and OCR workers...';

    [step1, step2, step3, step4].forEach(s => s.className = 'step-item');
    [line1, line2, line3].forEach(l => l.className = 'step-line');
    step1.classList.add('active');
  }

  function updateProgressUI(job) {
    const pct = Math.max(10, Math.min(100, Math.round(job.progress || 10)));
    progressPercentage.textContent = `${pct}%`;
    progressBarFill.style.width = `${pct}%`;
    if (job.stage) progressStageTitle.textContent = job.stage;
    if (job.message) progressMessage.textContent = job.message;

    // Update Stepper
    if (pct >= 25) {
      step1.className = 'step-item completed';
      line1.className = 'step-line completed';
      step2.className = 'step-item active';
    }
    if (pct >= 65) {
      step2.className = 'step-item completed';
      line2.className = 'step-line completed';
      step3.className = 'step-item active';
    }
    if (pct >= 90) {
      step3.className = 'step-item completed';
      line3.className = 'step-line completed';
      step4.className = 'step-item active';
    }
  }

  // ---------------------------------------------------------------------------
  // Render Extraction Results
  // ---------------------------------------------------------------------------
  function renderResults(result) {
    currentResult = result;
    activeSlideIndex = 0;
    resultsSection.style.display = 'flex';
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Meta Header
    const author = result.postDetails?.author || 'instagram_user';
    metaAuthor.textContent = author.startsWith('@') ? author : `@${author}`;
    metaAvatar.textContent = author.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || 'IG';
    if (result.url) {
      metaLink.href = result.url;
      metaLink.style.display = 'inline-block';
    } else {
      metaLink.style.display = 'none';
    }

    metaCaption.textContent = result.postDetails?.caption || 'No caption available for this post.';

    // Metrics
    metricSlides.textContent = result.totalSlides;
    metricWords.textContent = result.stats?.totalWords || 0;
    metricConfidence.textContent = `${result.stats?.avgConfidence || 95}%`;
    metricTime.textContent = `${result.stats?.readingTimeMinutes || 1}m`;

    // Render Views
    renderThumbnails();
    showSlide(0);
    renderGridView();
    renderDocView();
  }

  // ---------------------------------------------------------------------------
  // Split Slide View Controller
  // ---------------------------------------------------------------------------
  function renderThumbnails() {
    thumbStrip.innerHTML = '';
    currentResult.slides.forEach((slide, idx) => {
      const item = document.createElement('div');
      item.className = `thumb-item ${idx === activeSlideIndex ? 'active' : ''}`;
      item.innerHTML = `
        <span class="thumb-number">${idx + 1}</span>
        <img src="${slide.image}" alt="Slide ${idx + 1}">
      `;
      item.addEventListener('click', () => showSlide(idx));
      thumbStrip.appendChild(item);
    });
  }

  function showSlide(index) {
    if (!currentResult?.slides?.[index]) return;
    activeSlideIndex = index;
    const slide = currentResult.slides[index];

    activeSlideImg.src = slide.image;
    slideBadge.textContent = `Slide ${index + 1} of ${currentResult.totalSlides}`;
    activeSlideTitle.textContent = `Slide ${index + 1} Extracted Text`;
    activeSlideConfidence.textContent = `${slide.confidence || 95}% Accuracy`;
    activeSlideWords.textContent = `${slide.wordCount || 0} words`;
    activeSlideText.value = slide.text || '';

    // Update thumbnail active states
    const thumbs = thumbStrip.querySelectorAll('.thumb-item');
    thumbs.forEach((t, i) => {
      t.classList.toggle('active', i === index);
      if (i === index) {
        t.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    });

    btnPrevSlide.disabled = index === 0;
    btnNextSlide.disabled = index === currentResult.totalSlides - 1;
    btnPrevSlide.style.opacity = index === 0 ? '0.35' : '1';
    btnNextSlide.style.opacity = index === currentResult.totalSlides - 1 ? '0.35' : '1';
  }

  btnPrevSlide.addEventListener('click', () => {
    if (activeSlideIndex > 0) showSlide(activeSlideIndex - 1);
  });

  btnNextSlide.addEventListener('click', () => {
    if (activeSlideIndex < currentResult.totalSlides - 1) showSlide(activeSlideIndex + 1);
  });

  // Keyboard navigation
  window.addEventListener('keydown', (e) => {
    if (resultsSection.style.display === 'none') return;
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

    if (e.key === 'ArrowLeft') {
      if (activeSlideIndex > 0) showSlide(activeSlideIndex - 1);
    } else if (e.key === 'ArrowRight') {
      if (activeSlideIndex < currentResult?.totalSlides - 1) showSlide(activeSlideIndex + 1);
    }
  });

  // Slide Copy
  btnCopySlide.addEventListener('click', () => {
    const text = activeSlideText.value.trim();
    if (!text) {
      showToast('No text in this slide to copy.');
      return;
    }
    navigator.clipboard.writeText(text);
    showToast(`Copied Slide ${activeSlideIndex + 1} text!`);
  });

  // ---------------------------------------------------------------------------
  // Grid View Renderer
  // ---------------------------------------------------------------------------
  function renderGridView() {
    slidesGrid.innerHTML = '';
    currentResult.slides.forEach((slide, idx) => {
      const card = document.createElement('div');
      card.className = 'grid-card';
      card.innerHTML = `
        <div class="grid-card-img-wrap">
          <img src="${slide.image}" alt="Slide ${idx + 1}" loading="lazy">
          <div class="slide-badge" style="bottom: 8px; left: 8px; transform: none;">Slide ${idx + 1}</div>
        </div>
        <div class="grid-card-body">
          <div class="grid-card-title">
            <span class="tag">${slide.wordCount || 0} words &bull; ${slide.confidence || 95}% acc</span>
            <button class="btn-secondary btn-sm copy-grid-btn" data-index="${idx}">Copy</button>
          </div>
          <div class="grid-card-text">${escapeHtml(slide.text || '[No text detected]')}</div>
        </div>
      `;
      card.querySelector('.copy-grid-btn').addEventListener('click', () => {
        navigator.clipboard.writeText(slide.text || '');
        showToast(`Copied Slide ${idx + 1} text!`);
      });
      slidesGrid.appendChild(card);
    });
  }

  // ---------------------------------------------------------------------------
  // Full Document View Renderer
  // ---------------------------------------------------------------------------
  function renderDocView() {
    docFullText.textContent = currentResult.fullText || '';
    docWordCount.textContent = `${currentResult.stats?.totalWords || 0} words total`;
  }

  // ---------------------------------------------------------------------------
  // View Switcher
  // ---------------------------------------------------------------------------
  viewBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      viewBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const view = btn.dataset.view;
      Object.keys(viewContainers).forEach(k => {
        viewContainers[k].classList.toggle('active', k === view);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Search Filter
  // ---------------------------------------------------------------------------
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    if (!query || !currentResult) {
      searchCount.textContent = '';
      return;
    }

    let matchCount = 0;
    currentResult.slides.forEach(slide => {
      if (slide.text && slide.text.toLowerCase().includes(query)) {
        matchCount++;
      }
    });

    searchCount.textContent = `${matchCount} slide(s) match`;
  });

  // ---------------------------------------------------------------------------
  // Export & Download Actions
  // ---------------------------------------------------------------------------
  btnCopyAll.addEventListener('click', () => {
    if (!currentResult?.fullText) return;
    navigator.clipboard.writeText(currentResult.fullText);
    showToast('All carousel text copied to clipboard!');
  });

  btnDlMd.addEventListener('click', () => {
    if (!currentResult) return;
    const author = currentResult.postDetails?.author || 'instagram';
    let md = `# Instagram Carousel Text Extract\n`;
    md += `**Author:** @${author}  \n`;
    if (currentResult.url) md += `**Post Link:** ${currentResult.url}  \n`;
    md += `**Total Slides:** ${currentResult.totalSlides}  \n`;
    md += `**Total Words:** ${currentResult.stats?.totalWords}  \n\n`;
    md += `## Caption\n> ${currentResult.postDetails?.caption || 'N/A'}\n\n`;
    md += `## Extracted Slide Texts\n\n`;

    currentResult.slides.forEach(s => {
      md += `### Slide ${s.slideNumber}\n`;
      md += `${s.text || '[No text detected]'}\n\n`;
    });

    downloadBlob(md, `carousel-${currentResult.shortcode || 'extract'}.md`, 'text/markdown');
    showToast('Downloaded Markdown document!');
  });

  btnDlTxt.addEventListener('click', () => {
    if (!currentResult?.fullText) return;
    downloadBlob(currentResult.fullText, `carousel-${currentResult.shortcode || 'extract'}.txt`, 'text/plain');
    showToast('Downloaded TXT file!');
  });

  btnDlJson.addEventListener('click', () => {
    if (!currentResult) return;
    const jsonStr = JSON.stringify(currentResult, null, 2);
    downloadBlob(jsonStr, `carousel-${currentResult.shortcode || 'extract'}.json`, 'application/json');
    showToast('Downloaded JSON export!');
  });

  function downloadBlob(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
});
