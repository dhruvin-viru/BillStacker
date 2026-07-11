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

/**
 * Generates an invoice PDF in memory
 * @param {Object} invoiceData - Invoice information
 * @returns {Promise<Uint8Array>} - Compiled PDF bytes
 */
async function generateInvoicePdf(invoiceData) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 dimensions
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  
  // Header background bar
  page.drawRectangle({
    x: 0,
    y: height - 15,
    width: width,
    height: 15,
    color: rgb(0.48, 0.36, 0.92)
  });

  // Invoice Title
  page.drawText('INVOICE', {
    x: width - 150,
    y: height - 55,
    size: 24,
    font: boldFont,
    color: rgb(0.48, 0.36, 0.92)
  });

  // Company Name
  page.drawText(invoiceData.senderInfo?.name || 'Sender Company', {
    x: 50,
    y: height - 55,
    size: 16,
    font: boldFont,
    color: rgb(0.08, 0.08, 0.24)
  });

  // Company details
  let currentY = height - 75;
  const addressLines = (invoiceData.senderInfo?.address || '').split('\n');
  addressLines.forEach(line => {
    if (line.trim()) {
      page.drawText(line.trim(), { x: 50, y: currentY, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
      currentY -= 12;
    }
  });

  if (invoiceData.senderInfo?.email) {
    page.drawText(`Email: ${invoiceData.senderInfo.email}`, { x: 50, y: currentY, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
    currentY -= 12;
  }
  if (invoiceData.senderInfo?.phone) {
    page.drawText(`Phone: ${invoiceData.senderInfo.phone}`, { x: 50, y: currentY, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
  }

  // Invoice Metadata
  let metaY = height - 85;
  page.drawText(`Invoice No:`, { x: width - 150, y: metaY, size: 9, font: boldFont });
  page.drawText(invoiceData.invoiceNumber || 'INV-1001', { x: width - 85, y: metaY, size: 9, font });
  
  metaY -= 12;
  const dateStr = invoiceData.createdAt ? invoiceData.createdAt.split('T')[0] : new Date().toISOString().split('T')[0];
  page.drawText(`Date:`, { x: width - 150, y: metaY, size: 9, font: boldFont });
  page.drawText(dateStr, { x: width - 85, y: metaY, size: 9, font });
  
  metaY -= 12;
  if (invoiceData.dueDate) {
    const dueStr = invoiceData.dueDate.split('T')[0];
    page.drawText(`Due Date:`, { x: width - 150, y: metaY, size: 9, font: boldFont });
    page.drawText(dueStr, { x: width - 85, y: metaY, size: 9, font });
  }

  // Bill To details
  page.drawText('BILL TO:', { x: 50, y: height - 150, size: 9, font: boldFont, color: rgb(0.48, 0.36, 0.92) });
  page.drawText(invoiceData.clientInfo?.name || 'Client Name', { x: 50, y: height - 165, size: 11, font: boldFont });

  let clientY = height - 177;
  const clientAddrLines = (invoiceData.clientInfo?.address || '').split('\n');
  clientAddrLines.forEach(line => {
    if (line.trim()) {
      page.drawText(line.trim(), { x: 50, y: clientY, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
      clientY -= 12;
    }
  });

  if (invoiceData.clientInfo?.email) {
    page.drawText(`Email: ${invoiceData.clientInfo.email}`, { x: 50, y: clientY, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
  }

  // Table Headers
  const tableY = height - 230;
  page.drawRectangle({
    x: 50,
    y: tableY - 4,
    width: width - 100,
    height: 18,
    color: rgb(0.95, 0.95, 0.98)
  });

  page.drawText('Item Description', { x: 58, y: tableY, size: 9, font: boldFont, color: rgb(0.08, 0.08, 0.24) });
  page.drawText('Qty', { x: 340, y: tableY, size: 9, font: boldFont, color: rgb(0.08, 0.08, 0.24) });
  page.drawText('Unit Rate', { x: 410, y: tableY, size: 9, font: boldFont, color: rgb(0.08, 0.08, 0.24) });
  page.drawText('Amount', { x: 500, y: tableY, size: 9, font: boldFont, color: rgb(0.08, 0.08, 0.24) });

  // Table rows
  let rowY = tableY - 20;
  const items = invoiceData.items || [];
  const symbol = invoiceData.currency === 'INR' ? 'Rs.' : invoiceData.currency === 'EUR' ? 'EUR' : '$';

  items.forEach((item, index) => {
    // Row separation line
    page.drawLine({
      start: { x: 50, y: rowY + 12 },
      end: { x: width - 50, y: rowY + 12 },
      thickness: 0.5,
      color: rgb(0.9, 0.9, 0.9)
    });

    page.drawText(item.description || 'Service/Item', { x: 58, y: rowY, size: 9, font });
    page.drawText(String(item.quantity || 1), { x: 340, y: rowY, size: 9, font });
    page.drawText(`${symbol} ${(Number(item.rate) || 0).toFixed(2)}`, { x: 410, y: rowY, size: 9, font });
    
    const rowTotal = (item.quantity || 1) * (item.rate || 0);
    page.drawText(`${symbol} ${rowTotal.toFixed(2)}`, { x: 500, y: rowY, size: 9, font });

    rowY -= 20;
  });

  // Table bottom line
  page.drawLine({
    start: { x: 50, y: rowY + 12 },
    end: { x: width - 50, y: rowY + 12 },
    thickness: 1,
    color: rgb(0.48, 0.36, 0.92)
  });

  // Totals Block
  let totY = rowY - 5;
  const subtotal = Number(invoiceData.totals?.subtotal || 0);
  const taxRate = parseFloat(invoiceData.taxRate || 0);
  const discountRate = parseFloat(invoiceData.discountRate || 0);
  const taxAmount = Number(invoiceData.totals?.taxAmount || 0);
  const discountAmount = Number(invoiceData.totals?.discountAmount || 0);
  const grandTotal = Number(invoiceData.totals?.grandTotal || 0);

  page.drawText('Subtotal:', { x: 380, y: totY, size: 9, font });
  page.drawText(`${symbol} ${subtotal.toFixed(2)}`, { x: 500, y: totY, size: 9, font });
  totY -= 15;

  if (taxAmount > 0) {
    page.drawText(`Tax (${taxRate}%):`, { x: 380, y: totY, size: 9, font });
    page.drawText(`${symbol} ${taxAmount.toFixed(2)}`, { x: 500, y: totY, size: 9, font });
    totY -= 15;
  }

  if (discountAmount > 0) {
    page.drawText(`Discount (${discountRate}%):`, { x: 380, y: totY, size: 9, font });
    page.drawText(`-${symbol} ${discountAmount.toFixed(2)}`, { x: 500, y: totY, size: 9, font, color: rgb(0.8, 0.1, 0.1) });
    totY -= 15;
  }

  page.drawLine({
    start: { x: 380, y: totY + 10 },
    end: { x: width - 50, y: totY + 10 },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8)
  });

  page.drawText('Total Due:', { x: 380, y: totY, size: 10, font: boldFont, color: rgb(0.08, 0.08, 0.24) });
  page.drawText(`${symbol} ${grandTotal.toFixed(2)}`, { x: 500, y: totY, size: 10, font: boldFont, color: rgb(0.48, 0.36, 0.92) });

  // Notes
  if (invoiceData.notes) {
    const notesY = totY - 50;
    page.drawText('Notes / Payment Terms:', { x: 50, y: notesY, size: 9, font: boldFont });
    page.drawText(invoiceData.notes, { x: 50, y: notesY - 12, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
  }

  // Footer bar
  page.drawRectangle({
    x: 0,
    y: 0,
    width: width,
    height: 35,
    color: rgb(0.95, 0.95, 0.98)
  });

  page.drawText('Generated by BillStacker - Your Premium Invoice Suite', {
    x: 50,
    y: 13,
    size: 8,
    font,
    color: rgb(0.5, 0.5, 0.5)
  });

  return await pdfDoc.save();
}

module.exports = {
  mergePdfs,
  compressPdf,
  imagesToPdf,
  generateInvoicePdf,
};
