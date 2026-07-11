const express = require('express');
const multer = require('multer');
const { mergePdfs, compressPdf, imagesToPdf } = require('./pdf-utils');
const PaytmChecksum = require('paytmchecksum');
const {
  createRateLimiter,
  checkAuthRateLimit,
  validateBody,
  validateSchema,
  isValidPdfBuffer,
  isValidImageBuffer
} = require('./security');

const publicLimiter = createRateLimiter('public');
const userLimiter = createRateLimiter('user');

// Validation schemas
const paytmInitiateSchema = {
  amount: { type: 'number', min: 0.01, required: true },
  currency: { type: 'string', enum: ['USD', 'EUR', 'INR', 'GBP', 'CAD', 'AUD'], required: true },
  userId: { type: 'string', minLength: 5, maxLength: 128, pattern: /^[a-zA-Z0-9_\-]+$/, required: true }
};

const updatePasswordSchema = {
  uid: { type: 'string', minLength: 5, maxLength: 128, pattern: /^[a-zA-Z0-9_\-]+$/, required: true },
  newPassword: { type: 'string', minLength: 8, maxLength: 100, required: true }
};

const imageToPdfSchema = {
  orientation: { type: 'string', enum: ['portrait', 'landscape'], required: false },
  margin: { type: 'string', enum: ['none', 'small', 'large'], required: false },
  isPremium: { type: 'string', enum: ['true', 'false'], required: false }
};

const router = express.Router();

// Configure multer instances for PDF and Image types
const uploadPdf = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed.'), false);
    }
  }
});

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per image
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPG, PNG, WebP) are allowed.'), false);
    }
  }
});

// Root check endpoint
router.get('/health', publicLimiter, (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// Merge PDFs endpoint
router.post('/merge', userLimiter, uploadPdf.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length < 2) {
      return res.status(400).json({ error: 'Please upload at least 2 PDF files to merge.' });
    }

    // Magic Bytes Verification
    for (let i = 0; i < req.files.length; i++) {
      if (!isValidPdfBuffer(req.files[i].buffer)) {
        return res.status(400).json({ error: `File at index ${i} is not a valid PDF document.` });
      }
    }

    const buffers = req.files.map(file => file.buffer);
    const mergedPdfBytes = await mergePdfs(buffers);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="merged_document.pdf"');
    res.send(Buffer.from(mergedPdfBytes));
  } catch (err) {
    console.error('[Merge Endpoint Error]:', err);
    res.status(500).json({ error: 'An unexpected internal error occurred while merging your PDF documents.' });
  }
});

// Compress PDF endpoint
router.post('/compress', userLimiter, uploadPdf.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a PDF file to compress.' });
    }

    // Magic Bytes Verification
    if (!isValidPdfBuffer(req.file.buffer)) {
      return res.status(400).json({ error: 'Uploaded file is not a valid PDF document.' });
    }

    const compressionLevel = req.body.compressionLevel || 'medium';
    if (!['low', 'medium', 'high', 'extreme'].includes(compressionLevel)) {
      return res.status(400).json({ error: 'Invalid compression level. Must be one of: low, medium, high, extreme.' });
    }

    const originalSize = req.file.size;
    const originalBuffer = req.file.buffer;

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
    console.error('[Compression Endpoint Error]:', err);
    res.status(500).json({ error: 'An unexpected internal error occurred while compressing your PDF document.' });
  }
});

// Image-to-PDF Compile endpoint
router.post('/image-to-pdf', userLimiter, uploadImage.array('files', 30), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Please upload at least one image file.' });
    }

    // Validate body schemas
    const bodyValidation = validateSchema(req.body, imageToPdfSchema);
    if (!bodyValidation.valid) {
      return res.status(400).json({ error: 'Validation failed', details: bodyValidation.errors });
    }

    // Magic Bytes Verification
    for (let i = 0; i < req.files.length; i++) {
      if (!isValidImageBuffer(req.files[i].buffer)) {
        return res.status(400).json({ error: `File at index ${i} is not a valid image (JPEG, PNG, or WEBP).` });
      }
    }

    const options = {
      orientation: req.body.orientation || 'portrait',
      margin: req.body.margin || 'none',
      isPremium: req.body.isPremium === 'true'
    };

    const compiledPdfBytes = await imagesToPdf(req.files, options);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="compiled_images.pdf"');
    res.send(Buffer.from(compiledPdfBytes));
  } catch (err) {
    console.error('[Image-to-PDF Endpoint Error]:', err);
    res.status(500).json({ error: 'An unexpected internal error occurred while compiling your images to PDF.' });
  }
});

// Paytm Initiate Transaction Endpoint
router.post('/paytm/initiate', userLimiter, async (req, res) => {
  try {
    // Validate request schema
    const bodyValidation = validateSchema(req.body, paytmInitiateSchema);
    if (!bodyValidation.valid) {
      return res.status(400).json({ error: 'Validation failed', details: bodyValidation.errors });
    }

    const { amount, currency, userId } = req.body;
    const orderId = 'ORD' + Date.now();
    const mid = process.env.PAYTM_MID || 'MOCK_MID';
    let merchantKey = process.env.PAYTM_MERCHANT_KEY;
    if (merchantKey) {
      merchantKey = merchantKey.trim();
    }

    // Convert non-INR currencies to INR dynamically for Paytm PG compatibility
    let finalAmountInInr = Number(amount);
    if (currency === 'USD') {
      finalAmountInInr = Number(amount) * 83.3;
    } else if (currency === 'EUR') {
      finalAmountInInr = Number(amount) * 90.5;
    }
    const formattedAmount = finalAmountInInr.toFixed(2);

    if (!merchantKey) {
      console.log('[Paytm Initiate] Mock Mode Active (PAYTM_MERCHANT_KEY not found in .env)');
      return res.json({
        txnToken: 'MOCK_TOKEN_' + Date.now(),
        orderId,
        amount: formattedAmount,
        mid,
        isMock: true
      });
    }

    if (merchantKey.length !== 16) {
      console.error('[Paytm configuration error] PAYTM_MERCHANT_KEY length must be exactly 16.');
      return res.status(500).json({ error: 'Payment service configuration error.' });
    }

    const paytmParams = {
      body: {
        requestType: 'Payment',
        mid: mid,
        websiteName: 'WEBSTAGING',
        orderId: orderId,
        callbackUrl: `${req.protocol}://${req.get('host')}/api/paytm/callback`,
        txnAmount: {
          value: formattedAmount,
          currency: 'INR'
        },
        userInfo: {
          custId: userId.replace(/[^a-zA-Z0-9]/g, '')
        }
      }
    };

    const signature = await PaytmChecksum.generateSignature(JSON.stringify(paytmParams.body), merchantKey);
    paytmParams.head = {
      channelId: 'WEB',
      signature: signature
    };

    const response = await fetch(`https://securestage.paytmpayments.com/theia/api/v1/initiateTransaction?mid=${mid}&orderId=${orderId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paytmParams)
    });

    const textResponse = await response.text();
    console.log('[Paytm Response Raw]:', textResponse);

    let result;
    try {
      result = JSON.parse(textResponse);
    } catch (e) {
      console.error('[Paytm API response parse error]:', e);
      return res.status(500).json({ error: 'Failed to communicate with Paytm gateway.' });
    }

    if (result.body && result.body.resultInfo && result.body.resultInfo.resultStatus === 'S') {
      res.json({
        txnToken: result.body.txnToken,
        orderId,
        amount: formattedAmount,
        mid,
        isMock: false
      });
    } else {
      // Paytm API failed or returned 501 (account not activated). Fallback to mock sandbox so the user is not blocked.
      console.warn(`[Paytm API Warning]: Staging account not yet active (resultCode: ${result.body?.resultInfo?.resultCode}, resultMsg: ${result.body?.resultInfo?.resultMsg}). Falling back to mock sandbox simulator.`);
      res.json({
        txnToken: 'MOCK_TOKEN_' + Date.now(),
        orderId,
        amount: formattedAmount,
        mid,
        isMock: true,
        warning: 'Sandbox simulator active. Proceeding without live charge.'
      });
    }
  } catch (err) {
    console.error('Paytm Initiate Error:', err);
    // Fallback to mock sandbox so development isn't blocked
    const orderId = 'ORD' + Date.now();
    res.json({
      txnToken: 'MOCK_TOKEN_' + Date.now(),
      orderId,
      amount: '99.00',
      mid: process.env.PAYTM_MID || 'MOCK_MID',
      isMock: true,
      warning: 'Local gateway exception. Using sandbox simulator.'
    });
  }
});

// Paytm Transaction Callback Handler
router.post('/paytm/callback', async (req, res) => {
  try {
    const paytmResponse = req.body;
    console.log('[Paytm Callback Response Received]:', paytmResponse);

    const mid = process.env.PAYTM_MID || 'MgeNKs02477629003335';
    let merchantKey = process.env.PAYTM_MERCHANT_KEY;
    if (merchantKey) {
      merchantKey = merchantKey.trim();
    }

    // Verify signature (if key is present)
    let isSignatureValid = false;
    if (merchantKey && paytmResponse.CHECKSUMHASH) {
      isSignatureValid = PaytmChecksum.verifySignature(paytmResponse, merchantKey, paytmResponse.CHECKSUMHASH);
      console.log('[Paytm Callback Signature Verification]:', isSignatureValid);
    } else {
      isSignatureValid = true;
    }

    const orderId = paytmResponse.ORDERID || 'ORD_UNKNOWN';
    const txnId = paytmResponse.TXNID || 'TXN_UNKNOWN';
    const status = paytmResponse.STATUS || 'TXN_FAILURE';
    const respMsg = paytmResponse.RESPMSG || 'Transaction failed';

    // Redirect the browser back to the frontend page with status parameters
    // In local development, the frontend runs on port 3000
    let redirectBase = 'http://localhost:3000';
    if (req.get('host') && !req.get('host').includes('localhost')) {
      redirectBase = `${req.protocol}://${req.get('host')}`;
    }

    if (status === 'TXN_SUCCESS') {
      return res.send(`
        <html>
          <head>
            <title>Payment Successful</title>
            <script>
              window.location.href = "${redirectBase}?payment=success&orderId=${orderId}&txnId=${txnId}";
            </script>
          </head>
          <body style="background-color: #020617; color: #f8fafc; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
            <div style="text-align: center;">
              <h2 style="color: #10b981;">Payment Successful!</h2>
              <p>Redirecting you back to BillStacker...</p>
            </div>
          </body>
        </html>
      `);
    } else {
      return res.send(`
        <html>
          <head>
            <title>Payment Failed</title>
            <script>
              window.location.href = "${redirectBase}?payment=failed&msg=${encodeURIComponent(respMsg)}";
            </script>
          </head>
          <body style="background-color: #020617; color: #f8fafc; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
            <div style="text-align: center;">
              <h2 style="color: #ef4444;">Payment Failed</h2>
              <p>${respMsg}</p>
              <p>Redirecting you back to BillStacker...</p>
            </div>
          </body>
        </html>
      `);
    }
  } catch (err) {
    console.error('Paytm Callback processing error:', err);
    res.status(500).send('An error occurred during callback processing.');
  }
});

// Global error handler for Multer/Routing within Express Router
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size limit exceeded (max 10MB per image, 15MB per PDF).' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Admin Reset Password Route (Optional Firebase Admin SDK capability)
let adminAuth = null;
try {
  const admin = require('firebase-admin');
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }
    adminAuth = admin.auth();
  }
} catch (e) {
  // Gracefully bypass if firebase-admin package is missing or unconfigured
}

router.post('/admin/update-password', checkAuthRateLimit, async (req, res) => {
  // Validate request schema
  const bodyValidation = validateSchema(req.body, updatePasswordSchema);
  if (!bodyValidation.valid) {
    return res.status(400).json({ error: 'Validation failed', details: bodyValidation.errors });
  }

  const { uid, newPassword } = req.body;

  if (adminAuth) {
    try {
      await adminAuth.updateUser(uid, { password: newPassword });
      return res.json({ success: true, message: 'User password successfully updated.' });
    } catch (err) {
      console.error('[Admin Update Password Error]:', err);
      return res.status(500).json({ error: 'Failed to update user password.' });
    }
  } else {
    return res.status(501).json({
      error: 'Password update service is not available.'
    });
  }
});

// Initialize Firestore using Firebase Admin SDK
function getFirestoreDb() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const admin = require('firebase-admin');
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
      }
      return admin.firestore();
    } catch (err) {
      console.error('[Firebase Admin SDK FireStore Init error]:', err);
    }
  }
  return null;
}

// Telegram send message helper
async function sendTelegramMessage(chatId, text) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!BOT_TOKEN) {
    console.error('[Telegram Error] TELEGRAM_BOT_TOKEN is not configured.');
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      })
    });
  } catch (err) {
    console.error('[Telegram sendMessage error]:', err);
  }
}

// GET Telegram Bot Info (to retrieve username dynamically for frontend deep links)
router.get('/telegram-info', publicLimiter, async (req, res) => {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!BOT_TOKEN) {
    return res.json({ success: true, username: 'BillStackerBot' });
  }
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
    const data = await response.json();
    if (data.ok && data.result) {
      return res.json({ success: true, username: data.result.username });
    }
  } catch (err) {
    console.error('getMe error:', err);
  }
  res.json({ success: true, username: 'BillStackerBot' }); // fallback
});

// POST Telegram Webhook Endpoint
router.post('/telegram-webhook', publicLimiter, async (req, res) => {
  try {
    const update = req.body;
    if (!update || !update.message) {
      return res.sendStatus(200);
    }

    const chatId = update.message.chat.id;
    const text = (update.message.text || '').trim();

    // 1. Check for /start command
    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      if (parts.length > 1) {
        const userUid = parts[1].trim();

        // Perform pairing in Firestore
        const db = getFirestoreDb();
        if (!db) {
          await sendTelegramMessage(
            chatId,
            `❌ *Configuration Error*\n\nFirebase Admin SDK is not initialized. Please configure the database service key.`
          );
          return res.sendStatus(200);
        }

        try {
          const profileRef = db.collection('profiles').doc(userUid);
          const docSnap = await profileRef.get();

          if (docSnap.exists) {
            await profileRef.update({ telegramChatId: String(chatId) });
          } else {
            await profileRef.set({
              telegramChatId: String(chatId),
              joinedDate: new Date().toISOString(),
              isPremium: false,
              currency: 'USD',
              senderInfo: { name: 'Member', email: '' }
            });
          }

          await sendTelegramMessage(
            chatId,
            `🎉 *Welcome to BillStacker Bot!*\n\nYour account has been connected successfully.\n\nUse these commands to manage your records:\n• \`/invoices\` - List your recent invoices\n• \`/stats\` - View billing summaries`
          );
        } catch (dbErr) {
          console.error('[Telegram Webhook pairing error]:', dbErr);
          await sendTelegramMessage(
            chatId,
            `❌ *Connection Failed*\n\nUnable to save pairing code in database.`
          );
        }
      } else {
        await sendTelegramMessage(
          chatId,
          `👋 *Welcome to BillStacker Bot!*\n\nTo connect this bot to your account:\n1. Log in to [BillStacker](https://billstacker.vercel.app)\n2. Go to your *Profile* page\n3. Click *Connect Telegram Bot*`
        );
      }
      return res.sendStatus(200);
    }

    // 2. Fetch linked user profile
    const db = getFirestoreDb();
    if (!db) {
      await sendTelegramMessage(
        chatId,
        `❌ *Configuration Error*\n\nFirebase Admin SDK is not initialized.`
      );
      return res.sendStatus(200);
    }

    let linkedProfile = null;
    let userId = null;
    try {
      const snapshot = await db.collection('profiles').where('telegramChatId', '==', String(chatId)).get();
      if (!snapshot.empty) {
        linkedProfile = snapshot.docs[0].data();
        userId = snapshot.docs[0].id;
      }
    } catch (err) {
      console.error('[Telegram check pairing error]:', err);
    }

    if (!linkedProfile) {
      await sendTelegramMessage(
        chatId,
        `❌ *Account Not Connected*\n\nPlease link your Telegram account first:\n1. Open [BillStacker Profile](https://billstacker.vercel.app)\n2. Click *Connect Telegram Bot*`
      );
      return res.sendStatus(200);
    }

    const currencySymbol = linkedProfile.currency === 'INR' ? '₹' : linkedProfile.currency === 'EUR' ? '€' : '$';

    // 3. Handle commands
    if (text === '/invoices') {
      try {
        const snapshot = await db.collection('invoices').where('userId', '==', userId).get();
        if (snapshot.empty) {
          await sendTelegramMessage(chatId, `ℹ️ *No Invoices Found*\n\nYou haven't created any invoices yet! Visit the website builder to create one.`);
          return res.sendStatus(200);
        }

        const invoices = [];
        snapshot.forEach(doc => {
          invoices.push(doc.data());
        });
        invoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Limit to top 8 recent invoices
        const recent = invoices.slice(0, 8);
        let msg = `📋 *Your Recent Invoices (${invoices.length} total)*:\n\n`;
        recent.forEach((inv, index) => {
          const invNum = inv.invoiceNumber || `INV-${index+1}`;
          const client = inv.clientInfo?.name || 'Unnamed Client';
          const total = Number(inv.totals?.grandTotal || 0).toFixed(2);
          const status = (inv.status || 'pending').toUpperCase();
          const statusEmoji = status === 'PAID' ? '✅' : '⏳';

          msg += `${index + 1}. *${invNum}* | ${client}\n   ${statusEmoji} Status: *${status}* | *${currencySymbol}${total}*\n\n`;
        });

        if (invoices.length > 8) {
          msg += `_Showing 8 most recent. View all on your dashboard._`;
        }

        await sendTelegramMessage(chatId, msg);
      } catch (err) {
        console.error('[Telegram Webhook fetch invoices error]:', err);
        await sendTelegramMessage(chatId, `❌ *Error fetching invoices.*`);
      }
    } else if (text === '/stats') {
      try {
        const snapshot = await db.collection('invoices').where('userId', '==', userId).get();
        let total = 0;
        let paid = 0;
        let pending = 0;
        let count = 0;

        snapshot.forEach(doc => {
          const inv = doc.data();
          const grandTotal = Number(inv.totals?.grandTotal || 0);
          total += grandTotal;
          count++;
          if (inv.status === 'paid') {
            paid += grandTotal;
          } else {
            pending += grandTotal;
          }
        });

        const msg = `📊 *BillStacker Billing Summary*\n\n` +
          `• *Total Invoices:* ${count}\n` +
          `• *Total Billed Amount:* ${currencySymbol}${total.toFixed(2)}\n` +
          `• *Paid Amount:* ${currencySymbol}${paid.toFixed(2)} ✅\n` +
          `• *Pending Balance:* ${currencySymbol}${pending.toFixed(2)} ⏳\n\n` +
          `_Track all bills on billstacker.vercel.app_`;

        await sendTelegramMessage(chatId, msg);
      } catch (err) {
        console.error('[Telegram Webhook stats calculation error]:', err);
        await sendTelegramMessage(chatId, `❌ *Error calculating stats.*`);
      }
    } else {
      // Default fallback info message
      await sendTelegramMessage(
        chatId,
        `🤖 *BillStacker Assistant*\n\nAvailable commands:\n• \`/invoices\` - List recent invoices\n• \`/stats\` - View billing summaries\n• \`/start\` - Get instructions`
      );
    }
  } catch (err) {
    console.error('[Webhook error]:', err);
  }
  res.sendStatus(200);
});

module.exports = router;
