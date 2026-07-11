const express = require('express');
const multer = require('multer');
const { mergePdfs, compressPdf, imagesToPdf, generateInvoicePdf } = require('./pdf-utils');
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

// Send Document / PDF buffer helper using multipart/form-data
async function sendTelegramDocument(chatId, pdfBuffer, fileName, caption) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!BOT_TOKEN) {
    console.error('[Telegram Error] TELEGRAM_BOT_TOKEN is not configured.');
    return;
  }

  try {
    const formData = new FormData();
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    formData.append('chat_id', chatId);
    formData.append('document', blob, fileName);
    formData.append('caption', caption);
    formData.append('parse_mode', 'Markdown');

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
      method: 'POST',
      body: formData
    });
  } catch (err) {
    console.error('[Telegram sendDocument error]:', err);
  }
}

// Session state database helpers
async function getSession(chatId) {
  const db = getFirestoreDb();
  if (db) {
    try {
      const doc = await db.collection('telegram_sessions').doc(String(chatId)).get();
      return doc.exists ? doc.data() : null;
    } catch (err) {
      console.error('[Session read error]:', err);
    }
  }
  return null;
}

async function setSession(chatId, fields) {
  const db = getFirestoreDb();
  if (db) {
    try {
      await db.collection('telegram_sessions').doc(String(chatId)).set(
        { ...fields, updatedAt: new Date().toISOString() },
        { merge: true }
      );
    } catch (err) {
      console.error('[Session set error]:', err);
    }
  }
}

async function deleteSession(chatId) {
  const db = getFirestoreDb();
  if (db) {
    try {
      await db.collection('telegram_sessions').doc(String(chatId)).delete();
    } catch (err) {
      console.error('[Session delete error]:', err);
    }
  }
}

// Reusable stats reporter command helper
async function handleStatsCommand(chatId, userId, db, currencySymbol) {
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
    console.error('[Stats calculation error]:', err);
    await sendTelegramMessage(chatId, `❌ *Error calculating stats.*`);
  }
}

// Fail-safe helper to fetch latest invoice number (JS sorted)
async function getLatestInvoiceNumber(db, userId) {
  try {
    const snapshot = await db.collection('invoices').where('userId', '==', userId).get();
    if (!snapshot.empty) {
      const list = [];
      snapshot.forEach(doc => list.push(doc.data()));
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return list[0].invoiceNumber || 'None';
    }
  } catch (err) {
    console.error('[Latest Invoice Fetch Error]:', err);
  }
  return 'None';
}

// POST Telegram Webhook Endpoint
router.post('/telegram-webhook', publicLimiter, async (req, res) => {
  try {
    const update = req.body;
    if (!update || !update.message) {
      return res.sendStatus(200);
    }

    const chatId = update.message.chat.id;
    const text = (update.message.text || '').trim();

    // 1. Photo Attachment Check: Intercept photo uploads for image-to-PDF compilation
    if (update.message.photo) {
      const session = await getSession(chatId);
      if (session && session.step === 'awaiting_images') {
        const fileId = update.message.photo[update.message.photo.length - 1].file_id;
        const images = session.images || [];
        images.push(fileId);
        await setSession(chatId, { images });
        await sendTelegramMessage(
          chatId,
          `📸 *Image ${images.length} received!*\n\nSend another image, or send \`/done\` (or type *done*) when you are finished.`
        );
      } else {
        await sendTelegramMessage(
          chatId,
          `🤖 *Need Image to PDF?*\n\nIf you want to compile images into a PDF, please trigger the \`/imagetopdf\` command first.`
        );
      }
      return res.sendStatus(200);
    }

    // Global Command Check: Cancel current session at any point
    if (text.startsWith('/cancel')) {
      await deleteSession(chatId);
      await sendTelegramMessage(
        chatId,
        `❌ *Session Cancelled*\n\nYour active session has been cleared. Use \`/generateinvoice\`, \`/imagetopdf\`, or \`/updateinvoice\` to start.`
      );
      return res.sendStatus(200);
    }

    // Check for start command (pairing flow)
    if (text.startsWith('/start')) {
      const db = getFirestoreDb();
      if (!db) {
        await sendTelegramMessage(
          chatId,
          `❌ *Configuration Error*\n\nFirebase Admin SDK is not initialized.`
        );
        return res.sendStatus(200);
      }

      const parts = text.split(' ');
      if (parts.length > 1) {
        const userUid = parts[1].trim();

        try {
          // 1. Check if this Telegram chat is already connected to a different website account
          const tgSearch = await db.collection('profiles').where('telegramChatId', '==', String(chatId)).get();
          if (!tgSearch.empty) {
            const existingProfile = tgSearch.docs[0];
            if (!existingProfile.id.startsWith('telegram_')) {
              if (existingProfile.id === userUid) {
                await sendTelegramMessage(
                  chatId,
                  `🎉 *Already Connected*\n\nYour Telegram account is already linked to this BillStacker account.`
                );
              } else {
                await sendTelegramMessage(
                  chatId,
                  `❌ *Connection Rejected*\n\nThis Telegram account is already permanently linked to another BillStacker profile.`
                );
              }
              return res.sendStatus(200);
            }
          }

          // 2. Check if the target BillStacker website account is already connected to a different Telegram user
          const webProfileRef = db.collection('profiles').doc(userUid);
          const webProfileSnap = await webProfileRef.get();
          if (webProfileSnap.exists) {
            const webData = webProfileSnap.data();
            if (webData.telegramChatId && webData.telegramChatId !== String(chatId)) {
              await sendTelegramMessage(
                chatId,
                `❌ *Connection Rejected*\n\nThis BillStacker account is already permanently linked to a different Telegram user.`
              );
              return res.sendStatus(200);
            }
          }

          // 3. Connect them! Update the website profile with the telegramChatId
          if (webProfileSnap.exists) {
            await webProfileRef.update({ telegramChatId: String(chatId) });
          } else {
            // Create profile if it didn't exist
            await webProfileRef.set({
              telegramChatId: String(chatId),
              joinedDate: new Date().toISOString(),
              isPremium: false,
              currency: 'USD',
              senderInfo: { name: 'Member', email: '' }
            });
          }

          // 4. Migrate bot-only invoices (if any) to the website user account
          const botInvoicesSnapshot = await db.collection('invoices').where('userId', '==', `telegram_${chatId}`).get();
          if (!botInvoicesSnapshot.empty) {
            const batch = db.batch();
            botInvoicesSnapshot.forEach(doc => {
              batch.update(doc.ref, { userId: userUid });
            });
            await batch.commit();
            console.log(`Migrated ${botInvoicesSnapshot.size} invoices from telegram_${chatId} to ${userUid}`);
          }

          // 5. Delete the temporary standalone bot profile if it exists
          await db.collection('profiles').doc(`telegram_${chatId}`).delete();

          await sendTelegramMessage(
            chatId,
            `🎉 *Welcome to BillStacker! Link Successful.*\n\nYour account has been connected permanently. All invoices you generated on the bot are now synced with your web dashboard.\n\nUse these commands to manage your records:\n• \`/invoices\` - List your recent invoices\n• \`/stats\` - View billing summaries\n• \`/generateinvoice\` - Generate a new invoice`
          );
        } catch (dbErr) {
          console.error('[Telegram Webhook pairing error]:', dbErr);
          await sendTelegramMessage(
            chatId,
            `❌ *Connection Failed*\n\nUnable to complete linking sequence.`
          );
        }
      } else {
        // No UID provided: Check if already connected to a website profile
        try {
          const tgSearch = await db.collection('profiles').where('telegramChatId', '==', String(chatId)).get();
          let isConnected = false;
          if (!tgSearch.empty) {
            const profileDoc = tgSearch.docs[0];
            if (!profileDoc.id.startsWith('telegram_')) {
              isConnected = true;
            }
          }

          if (isConnected) {
            await sendTelegramMessage(
              chatId,
              `🎉 *Your account is already connected to BillStacker!*\n\nUse these commands:\n• \`/invoices\` - List your recent invoices\n• \`/stats\` - View billing summaries\n• \`/generateinvoice\` - Generate a new invoice\n• \`/updateinvoice\` - Update an invoice status\n• \`/imagetopdf\` - Compile photos into a PDF`
            );
          } else {
            await sendTelegramMessage(
              chatId,
              `👋 *Welcome to BillStacker Bot!*\n\nTo connect this bot to your account:\n1. Log in to [BillStacker](https://billstacker.vercel.app)\n2. Go to your *Profile* page\n3. Click *Connect Telegram Bot*`
            );
          }
        } catch (err) {
          console.error('[Telegram webhook start check error]:', err);
        }
      }
      return res.sendStatus(200);
    }

    // Fetch linked user profile to verify connection / find current user identity
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
      // A. Try to find a website profile connected to this telegramChatId
      const snapshot = await db.collection('profiles').where('telegramChatId', '==', String(chatId)).get();
      if (!snapshot.empty) {
        linkedProfile = snapshot.docs[0].data();
        userId = snapshot.docs[0].id;
      } else {
        // B. Check for a standalone bot profile `telegram_${chatId}`
        const botProfileRef = db.collection('profiles').doc(`telegram_${chatId}`);
        const botProfileSnap = await botProfileRef.get();
        if (botProfileSnap.exists) {
          linkedProfile = botProfileSnap.data();
          userId = botProfileSnap.id;
        } else {
          // C. Not found: Create stand-alone bot profile on the fly!
          linkedProfile = {
            telegramChatId: String(chatId),
            joinedDate: new Date().toISOString(),
            isPremium: false,
            currency: 'USD',
            senderInfo: { name: 'Telegram Member', email: '' }
          };
          await botProfileRef.set(linkedProfile);
          userId = `telegram_${chatId}`;
        }
      }
    } catch (err) {
      console.error('[Telegram check profile/session error]:', err);
      return res.sendStatus(200);
    }

    const currencySymbol = linkedProfile.currency === 'INR' ? '₹' : linkedProfile.currency === 'EUR' ? '€' : '$';

    // 1. Slash Commands
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
          const statusEmoji = status === 'PAID' ? '✅' : status === 'OVERDUE' ? '🛑' : '⏳';

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
      return res.sendStatus(200);
    } 
    
    if (text === '/stats') {
      await handleStatsCommand(chatId, userId, db, currencySymbol);
      return res.sendStatus(200);
    }

    if (text === '/generateinvoice') {
      // Initialize a new invoice creation session
      await setSession(chatId, {
        step: 'awaiting_mode_choice',
        userId,
        profile: linkedProfile,
        invoiceData: {
          senderInfo: {},
          clientInfo: {},
          items: [],
          currency: linkedProfile.currency || 'USD',
          taxRate: 0,
          discountRate: 0,
          paymentDetails: {
            method: 'Telegram Bot',
            terms: 'Due on Receipt'
          },
          notes: ''
        }
      });

      await sendTelegramMessage(
        chatId,
        `⚙️ *Invoice Builder Configuration*\n\nDo you want to use your *default company profile settings* (Company Name, Address, Email, Phone, Currency) for this invoice?\n\nReply with:\n*1* - Use Default Profile Settings\n*2* - Enter Sender Details Manually`
      );
      return res.sendStatus(200);
    }

    if (text === '/imagetopdf') {
      await setSession(chatId, {
        step: 'awaiting_images',
        images: []
      });
      await sendTelegramMessage(
        chatId,
        `📸 *Image to PDF Converter*\n\nPlease send me the images you want to compile (as photo attachments, one by one).\n\nWhen you are finished, reply with *done* (or send \`/done\`).\n\nIf you wish to cancel, send \`/cancel\`.`
      );
      return res.sendStatus(200);
    }

    if (text === '/updateinvoice' || text.startsWith('/updateinvoice ')) {
      const parts = text.split(' ');
      if (parts.length > 1) {
        const billNo = parts[1].trim();
        try {
          const invSnap = await db.collection('invoices')
            .where('userId', '==', userId)
            .where('invoiceNumber', '==', billNo)
            .get();
          if (invSnap.empty) {
            await sendTelegramMessage(chatId, `❌ Invoice *${billNo}* was not found. Please trigger \`/updateinvoice\` to search manually.`);
            return res.sendStatus(200);
          }
          await setSession(chatId, {
            step: 'awaiting_update_invoice_status',
            targetInvoiceId: invSnap.docs[0].id,
            targetInvoiceNumber: billNo,
            userId
          });
          await sendTelegramMessage(
            chatId,
            `Found Invoice *${billNo}*.\n\nWhat status would you like to set?\n\nReply with:\n*1* - Paid ✅\n*2* - Unpaid/Pending ⏳\n*3* - Overdue 🛑`
          );
        } catch (err) {
          console.error('[Error setting status with shortcut]:', err);
          await sendTelegramMessage(chatId, `❌ An error occurred searching for your invoice.`);
        }
      } else {
        await setSession(chatId, {
          step: 'awaiting_update_invoice_number',
          userId
        });
        await sendTelegramMessage(
          chatId,
          `✏️ *Update Invoice Status*\n\nPlease enter the *Invoice Number* of the bill you want to update (e.g. INV-1002):`
        );
      }
      return res.sendStatus(200);
    }

    // 2. Active Session State Processing (Interactive Questionnaire)
    const session = await getSession(chatId);
    if (session && session.step) {
      const step = session.step;
      const invoiceData = session.invoiceData || {};

      // Done command logic for image conversion
      if (step === 'awaiting_images' && (text === '/done' || text.toLowerCase() === 'done')) {
        const images = session.images || [];
        if (images.length === 0) {
          await sendTelegramMessage(chatId, `⚠️ No images received. Please send at least one image photo attachment first.`);
          return res.sendStatus(200);
        }

        await sendTelegramMessage(chatId, `⏳ *Downloading and compiling ${images.length} images into a PDF...*`);

        const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        if (!BOT_TOKEN) {
          await sendTelegramMessage(chatId, `❌ *Configuration Error*: Telegram Bot Token is missing.`);
          await deleteSession(chatId);
          return res.sendStatus(200);
        }

        try {
          const files = [];
          for (let i = 0; i < images.length; i++) {
            const fileId = images[i];
            const fileInfoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
            const fileInfo = await fileInfoRes.json();
            if (fileInfo.ok && fileInfo.result) {
              const filePath = fileInfo.result.file_path;
              const fileRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`);
              const fileBuffer = Buffer.from(await fileRes.arrayBuffer());
              files.push({
                buffer: fileBuffer,
                mimetype: 'image/jpeg'
              });
            }
          }

          if (files.length === 0) {
            await sendTelegramMessage(chatId, `❌ Failed to download any of the sent images. Please try again.`);
            await deleteSession(chatId);
            return res.sendStatus(200);
          }

          const pdfBytes = await imagesToPdf(files, { orientation: 'portrait', margin: 'none', isPremium: false });
          await sendTelegramDocument(chatId, pdfBytes, 'compiled_images.pdf', `📄 *Images compiled successfully!* Here is your PDF.`);
          await deleteSession(chatId);
        } catch (pdfErr) {
          console.error('[Telegram image to pdf compilation error]:', pdfErr);
          await sendTelegramMessage(chatId, `❌ *Compilation Failed*: An error occurred while assembling the images into a PDF.`);
          await deleteSession(chatId);
        }
        return res.sendStatus(200);
      }

      switch (step) {
        case 'awaiting_images':
          await sendTelegramMessage(
            chatId,
            `⚠️ Please send images as photo attachments, or reply with *done* (or send \`/done\`) to compile the PDF.`
          );
          break;

        case 'awaiting_mode_choice':
          if (text === '1') {
            invoiceData.senderInfo = session.profile.senderInfo || {};
            invoiceData.currency = session.profile.currency || 'USD';
            
            const lastNum = await getLatestInvoiceNumber(db, session.userId);
            await setSession(chatId, {
              step: 'awaiting_invoice_number',
              invoiceData
            });
            await sendTelegramMessage(
              chatId,
              `✅ *Default profile loaded.*\n\nPlease enter the *Invoice Number* (e.g. INV-1002):\n\n💡 *Last invoice number:* ${lastNum}\n\nType *skip* to generate a random number.`
            );
          } else if (text === '2') {
            invoiceData.senderInfo = {};
            await setSession(chatId, {
              step: 'awaiting_sender_name',
              invoiceData
            });
            await sendTelegramMessage(chatId, `📝 *Setting up sender details.* (Tip: You can set these defaults in the Web App Profile page)\n\nWhat is your *Company/Sender Name*?`);
          } else {
            await sendTelegramMessage(chatId, `⚠️ Invalid option. Please enter *1* to use your default profile settings, or *2* to type them manually.`);
          }
          break;

        case 'awaiting_sender_name':
          invoiceData.senderInfo.name = text;
          await setSession(chatId, { step: 'awaiting_sender_email', invoiceData });
          await sendTelegramMessage(chatId, `What is your *Company Billing Email*? (or type *skip*)`);
          break;

        case 'awaiting_sender_email':
          if (text.toLowerCase() !== 'skip') {
            invoiceData.senderInfo.email = text;
          }
          await setSession(chatId, { step: 'awaiting_sender_address', invoiceData });
          await sendTelegramMessage(chatId, `What is your *Company Address*? (or type *skip*)`);
          break;

        case 'awaiting_sender_address':
          if (text.toLowerCase() !== 'skip') {
            invoiceData.senderInfo.address = text;
          }
          await setSession(chatId, { step: 'awaiting_sender_phone', invoiceData });
          await sendTelegramMessage(chatId, `What is your *Company Phone Number*? (or type *skip*)`);
          break;

        case 'awaiting_sender_phone':
          if (text.toLowerCase() !== 'skip') {
            invoiceData.senderInfo.phone = text;
          }
          await setSession(chatId, { step: 'awaiting_currency', invoiceData });
          await sendTelegramMessage(chatId, `Which *currency* do you want to use? (e.g. USD, EUR, INR, CAD) [Default: USD]`);
          break;

        case 'awaiting_currency':
          invoiceData.currency = ['USD', 'EUR', 'INR', 'GBP', 'CAD', 'AUD'].includes(text.toUpperCase())
            ? text.toUpperCase()
            : 'USD';
            
          const lastNum = await getLatestInvoiceNumber(db, session.userId);
          await setSession(chatId, { step: 'awaiting_invoice_number', invoiceData });
          await sendTelegramMessage(
            chatId,
            `Currency set to *${invoiceData.currency}*.\n\nPlease enter the *Invoice Number* (e.g. INV-1002):\n\n💡 *Last invoice number:* ${lastNum}\n\nType *skip* to generate a random number.`
          );
          break;

        case 'awaiting_invoice_number':
          if (text.toLowerCase() === 'skip') {
            invoiceData.invoiceNumber = 'INV-' + Math.floor(1000 + Math.random() * 9000);
          } else {
            invoiceData.invoiceNumber = text;
          }
          await setSession(chatId, { step: 'awaiting_client_name', invoiceData });
          await sendTelegramMessage(chatId, `Invoice number set to *${invoiceData.invoiceNumber}*.\n\nPlease enter the *Client's Company / Name*:`);
          break;

        case 'awaiting_client_name':
          invoiceData.clientInfo.name = text;
          await setSession(chatId, { step: 'awaiting_client_email', invoiceData });
          await sendTelegramMessage(chatId, `What is the *Client's Email*? (or type *skip*)`);
          break;

        case 'awaiting_client_email':
          if (text.toLowerCase() !== 'skip') {
            invoiceData.clientInfo.email = text;
          }
          await setSession(chatId, { step: 'awaiting_client_address', invoiceData });
          await sendTelegramMessage(chatId, `What is the *Client's Physical/Billing Address*? (or type *skip*)`);
          break;

        case 'awaiting_client_address':
          if (text.toLowerCase() !== 'skip') {
            invoiceData.clientInfo.address = text;
          }
          await setSession(chatId, { step: 'awaiting_invoice_date', invoiceData });
          await sendTelegramMessage(chatId, `Please enter the *Invoice Date* (YYYY-MM-DD), or type *skip* to use today's date:`);
          break;

        case 'awaiting_invoice_date':
          let invDate = new Date();
          if (text.toLowerCase() !== 'skip') {
            const parsed = new Date(text);
            if (!isNaN(parsed.getTime())) {
              invDate = parsed;
            }
          }
          invoiceData.createdAt = invDate.toISOString();
          await setSession(chatId, { step: 'awaiting_due_date', invoiceData });
          await sendTelegramMessage(chatId, `Please enter the *Due Date* (YYYY-MM-DD), or type *skip* to default to 14 days from now:`);
          break;

        case 'awaiting_due_date':
          let dueDate = new Date(new Date(invoiceData.createdAt).getTime() + 14 * 24 * 60 * 60 * 1000);
          if (text.toLowerCase() !== 'skip') {
            const parsed = new Date(text);
            if (!isNaN(parsed.getTime())) {
              dueDate = parsed;
            }
          }
          invoiceData.dueDate = dueDate.toISOString();
          await setSession(chatId, { step: 'awaiting_tax_rate', invoiceData });
          await sendTelegramMessage(chatId, `Please enter the *Tax Rate (%)* (e.g. 5 or 18), or type *0* to skip:`);
          break;

        case 'awaiting_tax_rate':
          invoiceData.taxRate = parseFloat(text) || 0;
          await setSession(chatId, { step: 'awaiting_discount_rate', invoiceData });
          await sendTelegramMessage(chatId, `Please enter the *Discount Rate (%)* (e.g. 10), or type *0* to skip:`);
          break;

        case 'awaiting_discount_rate':
          invoiceData.discountRate = parseFloat(text) || 0;
          await setSession(chatId, { step: 'awaiting_item_name', invoiceData });
          await sendTelegramMessage(chatId, `Configuration details saved!\n\nLet's add billing items.\n\nEnter the *name or description* of the first item:`);
          break;

        case 'awaiting_item_name':
          const currentItem = { description: text };
          await setSession(chatId, { step: 'awaiting_item_qty', currentItem });
          await sendTelegramMessage(chatId, `What is the *quantity* of this item? (Enter a number)`);
          break;

        case 'awaiting_item_qty':
          const qty = parseInt(text) || 1;
          session.currentItem.quantity = qty;
          await setSession(chatId, { step: 'awaiting_item_rate', currentItem: session.currentItem });
          await sendTelegramMessage(chatId, `What is the *unit price/rate* for this item?`);
          break;

        case 'awaiting_item_rate':
          const rate = parseFloat(text) || 0.0;
          session.currentItem.rate = rate;
          invoiceData.items.push(session.currentItem);
          await setSession(chatId, {
            step: 'awaiting_add_more_confirm',
            invoiceData,
            currentItem: null
          });
          await sendTelegramMessage(
            chatId,
            `✅ Item added.\n\nDo you want to add another item?\n*1* - Yes, add another item\n*2* - No, finish and compile PDF`
          );
          break;

        case 'awaiting_add_more_confirm':
          if (text === '1') {
            await setSession(chatId, { step: 'awaiting_item_name' });
            await sendTelegramMessage(chatId, `Enter the *name or description* of the next item:`);
          } else if (text === '2') {
            await setSession(chatId, { step: 'awaiting_notes' });
            await sendTelegramMessage(chatId, `Enter any optional *payment notes or terms* (or type *skip*):`);
          } else {
            await sendTelegramMessage(chatId, `Please type *1* (Add more items) or *2* (No, finish).`);
          }
          break;

        case 'awaiting_notes':
          if (text.toLowerCase() !== 'skip') {
            invoiceData.notes = text;
          }

          // Complete calculation and invoice payload composition
          const subtotal = invoiceData.items.reduce((sum, it) => sum + (it.quantity * it.rate), 0);
          const tRate = parseFloat(invoiceData.taxRate || 0);
          const dRate = parseFloat(invoiceData.discountRate || 0);
          const taxAmount = parseFloat(((subtotal * tRate) / 100).toFixed(2));
          const discountAmount = parseFloat(((subtotal * dRate) / 100).toFixed(2));
          const grandTotal = parseFloat((subtotal + taxAmount - discountAmount).toFixed(2));

          invoiceData.status = 'pending';
          invoiceData.totals = {
            subtotal,
            taxAmount,
            discountAmount,
            grandTotal
          };

          await sendTelegramMessage(chatId, `⏳ *Compiling and saving invoice ${invoiceData.invoiceNumber}...*`);

          try {
            // 1. Save to Cloud Firestore
            await db.collection('invoices').add({
              ...invoiceData,
              userId: session.userId
            });

            // 2. Generate PDF bytes using pdf-lib
            const pdfBytes = await generateInvoicePdf(invoiceData);

            // 3. Send PDF document file as response
            await sendTelegramDocument(
              chatId,
              pdfBytes,
              `${invoiceData.invoiceNumber}.pdf`,
              `🎉 *Invoice generated successfully!* Attached is your PDF.`
            );

            // 4. Delete the active conversation session
            await deleteSession(chatId);

            // 5. Automatically run stats command
            const sym = invoiceData.currency === 'INR' ? '₹' : invoiceData.currency === 'EUR' ? '€' : '$';
            await handleStatsCommand(chatId, session.userId, db, sym);

          } catch (genErr) {
            console.error('[Telegram Webhook Generation Error]:', genErr);
            await sendTelegramMessage(chatId, `❌ *Generation Failed*: Unable to compile or save document.`);
            await deleteSession(chatId);
          }
          break;

        case 'awaiting_update_invoice_number':
          try {
            const invSnap = await db.collection('invoices')
              .where('userId', '==', session.userId)
              .where('invoiceNumber', '==', text)
              .get();
            if (invSnap.empty) {
              await sendTelegramMessage(chatId, `❌ Invoice *${text}* was not found. Please check the spelling and try again, or send \`/cancel\` to abort.`);
            } else {
              await setSession(chatId, {
                step: 'awaiting_update_invoice_status',
                targetInvoiceId: invSnap.docs[0].id,
                targetInvoiceNumber: text
              });
              await sendTelegramMessage(
                chatId,
                `Found Invoice *${text}*.\n\nWhat status would you like to set?\n\nReply with:\n*1* - Paid ✅\n*2* - Unpaid/Pending ⏳\n*3* - Overdue 🛑`
              );
            }
          } catch (err) {
            console.error('[Session update invoice find error]:', err);
            await sendTelegramMessage(chatId, `❌ An error occurred while searching. Please try again.`);
          }
          break;

        case 'awaiting_update_invoice_status':
          let statusStr = '';
          if (text === '1') {
            statusStr = 'paid';
          } else if (text === '2') {
            statusStr = 'pending';
          } else if (text === '3') {
            statusStr = 'overdue';
          } else {
            await sendTelegramMessage(chatId, `⚠️ Invalid option. Please reply with *1* (Paid), *2* (Pending), or *3* (Overdue).`);
            return res.sendStatus(200);
          }

          try {
            await db.collection('invoices').doc(session.targetInvoiceId).update({ status: statusStr });
            await sendTelegramMessage(chatId, `✅ Success! Invoice status successfully updated to *${statusStr.toUpperCase()}*.`);
            await deleteSession(chatId);

            // Automatically run stats summary
            const sym = currencySymbol;
            await handleStatsCommand(chatId, session.userId, db, sym);
          } catch (err) {
            console.error('[Session update invoice status write error]:', err);
            await sendTelegramMessage(chatId, `❌ Failed to update status in database.`);
            await deleteSession(chatId);
          }
          break;

        default:
          await deleteSession(chatId);
          break;
      }
      return res.sendStatus(200);
    }

    // Default Fallback Info Message
    await sendTelegramMessage(
      chatId,
      `🤖 *BillStacker Assistant*\n\nAvailable commands:\n• \`/invoices\` - List recent invoices\n• \`/stats\` - View billing summaries\n• \`/generateinvoice\` - Generate an invoice interactively\n• \`/updateinvoice\` - Update an invoice status\n• \`/imagetopdf\` - Compile photos into a PDF\n• \`/start\` - Get instructions`
    );
  } catch (err) {
    console.error('[Webhook error]:', err);
  }
  res.sendStatus(200);
});

module.exports = router;
