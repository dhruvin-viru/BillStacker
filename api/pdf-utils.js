const { PDFDocument } = require('pdf-lib');

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

module.exports = {
  mergePdfs,
  compressPdf,
};
