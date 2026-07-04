const express = require('express');
const multer = require('multer');
const { mergePdfs, compressPdf } = require('./pdf-utils');

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // Limit files to 15MB each
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed.'), false);
    }
  }
});

// Root check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// Merge PDFs endpoint
router.post('/merge', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length < 2) {
      return res.status(400).json({ error: 'Please upload at least 2 PDF files to merge.' });
    }

    const buffers = req.files.map(file => file.buffer);
    const mergedPdfBytes = await mergePdfs(buffers);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="merged_document.pdf"');
    res.send(Buffer.from(mergedPdfBytes));
  } catch (err) {
    console.error('Merge Error:', err);
    res.status(500).json({ error: err.message || 'Failed to merge PDF documents.' });
  }
});

// Compress PDF endpoint
router.post('/compress', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a PDF file to compress.' });
    }

    const originalSize = req.file.size;
    const originalBuffer = req.file.buffer;
    const compressionLevel = req.body.compressionLevel || 'medium';

    const compressedPdfBytes = await compressPdf(originalBuffer, compressionLevel);
    const compressedSize = compressedPdfBytes.length;

    // Return the compressed PDF along with size info in headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="compressed_document.pdf"');
    res.setHeader('Access-Control-Expose-Headers', 'x-original-size, x-compressed-size');
    res.setHeader('x-original-size', originalSize.toString());
    res.setHeader('x-compressed-size', compressedSize.toString());
    
    res.send(Buffer.from(compressedPdfBytes));
  } catch (err) {
    console.error('Compression Error:', err);
    res.status(500).json({ error: err.message || 'Failed to compress PDF document.' });
  }
});

// Global error handler for Multer/Routing within Express Router
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size limit exceeded (max 15MB per file).' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

module.exports = router;
