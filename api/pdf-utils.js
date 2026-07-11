const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

/**
 * Merges multiple PDF buffers into a single PDF
 * @param {Array<Buffer>} buffers - Array of PDF file buffers
 * @returns {Promise<Uint8Array>} - Merged PDF bytes
 */
async function mergePdfs(buffers) {
  if (!buffers || buffers.length === 0) {
    throw new Error('No PDF buffers provided for merging.');
  }

  const mergedPdf = await PDFDocument.create();

  for (let i = 0; i < buffers.length; i++) {
    try {
      const pdf = await PDFDocument.load(buffers[i]);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    } catch (err) {
      throw new Error(`Failed to load or copy pages from document at index ${i}: ${err.message}`);
    }
  }

  // Save the PDF
  return await mergedPdf.save({ useObjectStreams: true });
}

/**
 * Compresses a PDF buffer
 * @param {Buffer} buffer - PDF file buffer
 * @param {string} compressionLevel - Compression level: 'medium', 'high', or 'extreme'
 * @returns {Promise<Uint8Array>} - Compressed PDF bytes
 */
async function compressPdf(buffer, compressionLevel = 'medium') {
  if (!buffer) {
    throw new Error('No PDF buffer provided for compression.');
  }

  // Load the PDF document
  const pdfDoc = await PDFDocument.load(buffer);

  // 1. Remove metadata which can bloat files
  pdfDoc.setTitle('');
  pdfDoc.setAuthor('');
  pdfDoc.setSubject('');
  pdfDoc.setCreator('');
  pdfDoc.setProducer('');

  // 2. Reduce content stream scale based on target compression level
  const pages = pdfDoc.getPages();
  let scale = 1.0;

  if (compressionLevel === 'high') {
    scale = 0.8;
  } else if (compressionLevel === 'extreme') {
    scale = 0.6;
  }

  if (scale < 1.0) {
    pages.forEach(page => {
      try {
        const { width, height } = page.getSize();
        page.setSize(width * scale, height * scale);
        page.scale(scale, scale);
      } catch (e) {
        console.warn('[PDF Scale Warning] Failed to scale page:', e);
      }
    });
  }

  // 3. Save the document with object streams enabled
  const compressedBytes = await pdfDoc.save({
    useObjectStreams: true,
    addGlyphsHtmlToPdfMap: false,
  });

  return compressedBytes;
}

/**
 * Converts multiple image buffers into a single A4 PDF
 * @param {Array<{buffer: Buffer, mimetype: string}>} files - Array of image file objects
 * @param {Object} options - { orientation: 'portrait'|'landscape', margin: 'none'|'small'|'large' }
 * @returns {Promise<Uint8Array>} - Generated PDF bytes
 */
async function imagesToPdf(files, options = {}) {
  if (!files || files.length === 0) {
    throw new Error('No images provided for compilation.');
  }

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // A4 dimensions in points (72 points = 1 inch)
  const isLandscape = options.orientation === 'landscape';
  const pageWidth = isLandscape ? 841.89 : 595.28;
  const pageHeight = isLandscape ? 595.28 : 841.89;

  let margin = 0;
  if (options.margin === 'small') {
    margin = 20;
  } else if (options.margin === 'large') {
    margin = 50;
  }

  const contentWidth = pageWidth - (margin * 2);
  const contentHeight = pageHeight - (margin * 2);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    let embeddedImage;

    try {
      if (file.mimetype === 'image/png') {
        embeddedImage = await pdfDoc.embedPng(file.buffer);
      } else {
        // Fallback to Jpg for jpeg/webp/etc.
        embeddedImage = await pdfDoc.embedJpg(file.buffer);
      }
    } catch (err) {
      // If embedPng/Jpg fails directly, try the other as fallback
      try {
        if (file.mimetype === 'image/png') {
          embeddedImage = await pdfDoc.embedJpg(file.buffer);
        } else {
          embeddedImage = await pdfDoc.embedPng(file.buffer);
        }
      } catch (err2) {
        throw new Error(`Failed to embed image at page ${i + 1}: unsupported or corrupt format.`);
      }
    }

    const imgW = embeddedImage.width;
    const imgH = embeddedImage.height;

    // Scale ratio to fit content boundaries
    const widthRatio = contentWidth / imgW;
    const heightRatio = contentHeight / imgH;
    const scaleFactor = Math.min(widthRatio, heightRatio);

    const scaledWidth = imgW * scaleFactor;
    const scaledHeight = imgH * scaleFactor;

    // Center on page
    const xPos = margin + ((contentWidth - scaledWidth) / 2);
    const yPos = margin + ((contentHeight - scaledHeight) / 2);

    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    page.drawImage(embeddedImage, {
      x: xPos,
      y: yPos,
      width: scaledWidth,
      height: scaledHeight
    });

    // Watermark removed per user request for free tier
  }

  return await pdfDoc.save({ useObjectStreams: true });
}

module.exports = {
  mergePdfs,
  compressPdf,
  imagesToPdf,
};
