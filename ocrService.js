// ═══════════════════════════════════════════════════════════════════════
//  ocrService.js  —  OCR abstraction layer (browser only)
// ───────────────────────────────────────────────────────────────────────
//  The ONLY module that knows about the OCR engine (Tesseract.js). The rest
//  of the app depends on this interface, not on Tesseract directly, so the
//  engine can be swapped without touching the parser or the UI.
//
//  Privacy / clinical safety:
//    - All recognition runs on this device, in the browser. No image is ever
//      uploaded or transmitted. (Tesseract downloads its engine + English
//      model from a CDN once; images never leave the device.)
//    - Images are processed transiently. We never persist frames.
//    - OCR output is a DRAFT only. Structuring + review happen elsewhere; this
//      layer makes no clinical decision.
//
//  Public interface (window.OcrService):
//    init()                            -> Promise, warms up the worker
//    extractTextFromImage(imageSource) -> Promise<{ text, confidence, lines }>
//    parseBloodResultsFromText(text)   -> rows (delegates to BloodResultParser)
//    lineConfidence                    -> fn(rawLine) used by the parser
//    terminate()                       -> releases the worker and model
// ═══════════════════════════════════════════════════════════════════════
window.OcrService = (function () {
  const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  let worker = null;
  let loadingPromise = null;
  let lastLines = [];   // {text, confidence} from the most recent extraction

  function loadTesseractScript() {
    if (window.Tesseract) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = TESSERACT_CDN;
      s.async = true;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Could not load the on-device OCR engine.')); };
      document.head.appendChild(s);
    });
  }

  async function init() {
    if (worker) return worker;
    if (loadingPromise) return loadingPromise;
    loadingPromise = (async function () {
      await loadTesseractScript();
      worker = await window.Tesseract.createWorker('eng');
      return worker;
    })();
    return loadingPromise;
  }

  // imageSource: a <canvas>, <video>, ImageBitmap, Blob or data URL.
  async function extractTextFromImage(imageSource) {
    await init();
    const res = await worker.recognize(imageSource);
    const data = res.data || {};
    lastLines = (data.lines || []).map(function (l) {
      return { text: l.text, confidence: typeof l.confidence === 'number' ? l.confidence : null };
    });
    return { text: data.text || '', confidence: data.confidence || 0, lines: lastLines };
  }

  // Per-line confidence hook handed to the parser so a structured row can
  // never claim more confidence than the pixels it came from.
  function lineConfidence(rawLine) {
    if (!lastLines.length) return null;
    const norm = String(rawLine).replace(/\s+/g, ' ').trim().toLowerCase();
    let best = null;
    for (const l of lastLines) {
      const lt = String(l.text).replace(/\s+/g, ' ').trim().toLowerCase();
      if (lt && (lt === norm || lt.indexOf(norm) !== -1 || norm.indexOf(lt) !== -1)) {
        if (l.confidence != null && (best == null || l.confidence < best)) best = l.confidence;
      }
    }
    return best;
  }

  function parseBloodResultsFromText(text, options) {
    if (!window.BloodResultParser) throw new Error('BloodResultParser not loaded');
    return window.BloodResultParser.parseBloodResultsFromText(text, Object.assign({
      lineConfidence: lineConfidence
    }, options || {}));
  }

  async function terminate() {
    lastLines = [];
    if (worker) { try { await worker.terminate(); } catch (e) {} worker = null; }
    loadingPromise = null;
  }

  return { init, extractTextFromImage, parseBloodResultsFromText, lineConfidence, terminate };
})();
