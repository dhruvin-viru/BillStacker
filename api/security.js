const admin = require('firebase-admin');

// Global in-memory cache fallback for environments without Firestore
const localMemoryStore = new Map();

/**
 * Get Firestore instance via Firebase Admin SDK
 */
function getFirestoreDb() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
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

/**
 * Clean up expired rate limiting entries from memory store (to prevent memory leaks)
 */
function cleanLocalMemoryStore() {
  const now = Date.now();
  for (const [key, value] of localMemoryStore.entries()) {
    if (value.resetTime && now > value.resetTime) {
      localMemoryStore.delete(key);
    }
  }
}

/**
 * Read rate limit entry from Firestore or Local memory fallback
 */
async function getRateLimitEntry(key) {
  const db = getFirestoreDb();
  if (db) {
    try {
      const doc = await db.collection('rate_limits').doc(key).get();
      return doc.exists ? doc.data() : null;
    } catch (err) {
      console.warn('[RateLimiter] Firestore read failed, falling back to memory:', err.message);
    }
  }
  
  cleanLocalMemoryStore();
  const entry = localMemoryStore.get(key);
  if (entry && Date.now() > entry.resetTime) {
    localMemoryStore.delete(key);
    return null;
  }
  return entry;
}

/**
 * Save rate limit entry to Firestore or Local memory fallback
 */
async function setRateLimitEntry(key, entry) {
  const db = getFirestoreDb();
  if (db) {
    try {
      await db.collection('rate_limits').doc(key).set(entry);
      return;
    } catch (err) {
      console.warn('[RateLimiter] Firestore write failed, falling back to memory:', err.message);
    }
  }
  localMemoryStore.set(key, entry);
}

/**
 * Centralized Rate Limiting and Backoff Logic
 */
async function checkRateLimit(req, res, options) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const {
    type = 'public',
    windowMs = 60 * 1000,
    max = 30,
    identifier = '',
    useBackoff = false
  } = options;

  const rateKey = `${type}_${identifier || ip}`.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const now = Date.now();
  let entry = await getRateLimitEntry(rateKey);

  if (!entry) {
    // New window
    entry = {
      attempts: 1,
      resetTime: now + windowMs,
      blockedUntil: 0
    };
    await setRateLimitEntry(rateKey, entry);
    return { allowed: true };
  }

  // Check if active block exists (exponential backoff)
  if (entry.blockedUntil && now < entry.blockedUntil) {
    const waitSeconds = Math.ceil((entry.blockedUntil - now) / 1000);
    return {
      allowed: false,
      waitSeconds,
      attempts: entry.attempts
    };
  }

  // Check if window expired
  if (now > entry.resetTime) {
    entry.attempts = 1;
    entry.resetTime = now + windowMs;
    entry.blockedUntil = 0;
    await setRateLimitEntry(rateKey, entry);
    return { allowed: true };
  }

  // Increment attempts
  entry.attempts = (entry.attempts || 0) + 1;

  if (entry.attempts > max) {
    if (useBackoff) {
      // Exponential Backoff calculation
      // delay = BaseDelay * 2^(Attempts - MaxAttempts)
      const baseDelayMs = 5000; // 5 seconds initial delay
      const multiplier = Math.pow(2, Math.min(entry.attempts - max, 8)); // Cap multiplier at 2^8 to avoid overflow
      const delayMs = Math.min(baseDelayMs * multiplier, 15 * 60 * 1000); // Max 15 minutes lock
      entry.blockedUntil = now + delayMs;
      await setRateLimitEntry(rateKey, entry);

      const waitSeconds = Math.ceil(delayMs / 1000);
      return {
        allowed: false,
        waitSeconds,
        attempts: entry.attempts
      };
    } else {
      await setRateLimitEntry(rateKey, entry);
      return {
        allowed: false,
        waitSeconds: Math.ceil((entry.resetTime - now) / 1000),
        attempts: entry.attempts
      };
    }
  }

  await setRateLimitEntry(rateKey, entry);
  return { allowed: true };
}

/**
 * Standard Rate Limiter middleware creator
 */
function createRateLimiter(type) {
  return async (req, res, next) => {
    try {
      let windowMs = 60 * 1000;
      let max = 100;
      
      if (type === 'public') {
        windowMs = Number(process.env.LIMIT_PUBLIC_WINDOW_MS) || 60 * 1000;
        max = Number(process.env.LIMIT_PUBLIC_MAX) || 30;
      } else if (type === 'user') {
        windowMs = Number(process.env.LIMIT_USER_WINDOW_MS) || 60 * 1000;
        max = Number(process.env.LIMIT_USER_MAX) || 100;
      }

      const limitCheck = await checkRateLimit(req, res, { type, windowMs, max });
      if (!limitCheck.allowed) {
        res.setHeader('Retry-After', String(limitCheck.waitSeconds));
        return res.status(429).json({
          error: 'Too many requests. Please try again later.',
          retryAfterSeconds: limitCheck.waitSeconds
        });
      }
      next();
    } catch (err) {
      console.error('[RateLimiter Error]:', err);
      next(); // safe fallback: let request proceed if limiter crashes
    }
  };
}

/**
 * Exponential Backoff rate limiter for auth / password reset actions
 */
async function checkAuthRateLimit(req, res, next) {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const uid = (req.body.uid || '').trim();

    const windowMs = Number(process.env.LIMIT_AUTH_WINDOW_MS) || 15 * 60 * 1000; // 15 mins
    const maxAttempts = Number(process.env.LIMIT_AUTH_MAX_ATTEMPTS) || 5;

    // Check IP rate limiting
    const ipCheck = await checkRateLimit(req, res, {
      type: 'auth_ip',
      windowMs,
      max: maxAttempts,
      identifier: ip,
      useBackoff: true
    });

    if (!ipCheck.allowed) {
      res.setHeader('Retry-After', String(ipCheck.waitSeconds));
      return res.status(429).json({
        error: `Too many login/reset attempts from this IP. Please try again in ${ipCheck.waitSeconds} seconds.`,
        retryAfterSeconds: ipCheck.waitSeconds
      });
    }

    // Check Account UID rate limiting if UID is provided
    if (uid) {
      const uidCheck = await checkRateLimit(req, res, {
        type: 'auth_uid',
        windowMs,
        max: maxAttempts,
        identifier: uid,
        useBackoff: true
      });

      if (!uidCheck.allowed) {
        res.setHeader('Retry-After', String(uidCheck.waitSeconds));
        return res.status(429).json({
          error: `Too many password update attempts for this account. Please try again in ${uidCheck.waitSeconds} seconds.`,
          retryAfterSeconds: uidCheck.waitSeconds
        });
      }
    }

    next();
  } catch (err) {
    console.error('[AuthRateLimiter Error]:', err);
    next();
  }
}

/**
 * Validate input data against a strict schema.
 * Rejects parameters that fail type/format checks.
 */
function validateSchema(data, schema) {
  const errors = [];
  
  for (const field of Object.keys(schema)) {
    const val = data[field];
    const rules = schema[field];

    // 1. Check Required status
    if (rules.required && (val === undefined || val === null || val === '')) {
      errors.push(`Field '${field}' is required.`);
      continue;
    }

    if (val !== undefined && val !== null && val !== '') {
      // 2. Validate Type
      if (rules.type === 'number') {
        const num = Number(val);
        if (isNaN(num)) {
          errors.push(`Field '${field}' must be a number.`);
        } else {
          if (rules.min !== undefined && num < rules.min) {
            errors.push(`Field '${field}' must be greater than or equal to ${rules.min}.`);
          }
          if (rules.max !== undefined && num > rules.max) {
            errors.push(`Field '${field}' must be less than or equal to ${rules.max}.`);
          }
        }
      } else if (rules.type === 'string') {
        if (typeof val !== 'string') {
          errors.push(`Field '${field}' must be a string.`);
        } else {
          const str = val.trim();
          if (rules.minLength !== undefined && str.length < rules.minLength) {
            errors.push(`Field '${field}' length must be at least ${rules.minLength} characters.`);
          }
          if (rules.maxLength !== undefined && str.length > rules.maxLength) {
            errors.push(`Field '${field}' length cannot exceed ${rules.maxLength} characters.`);
          }
          if (rules.pattern && !rules.pattern.test(str)) {
            errors.push(`Field '${field}' format is invalid.`);
          }
          if (rules.enum && !rules.enum.includes(str)) {
            errors.push(`Field '${field}' must be one of: ${rules.enum.join(', ')}.`);
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Middleware wrapper for schema validation
 */
function validateBody(schema) {
  return (req, res, next) => {
    const result = validateSchema(req.body, schema);
    if (!result.valid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.errors
      });
    }
    next();
  };
}

/**
 * Magic Bytes PDF Checker
 */
function isValidPdfBuffer(buffer) {
  if (!buffer || buffer.length < 4) return false;
  // PDF Magic Signature: %PDF (25 50 44 46)
  return (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  );
}

/**
 * Magic Bytes Image Checker (supports JPEG, PNG, WEBP)
 */
function isValidImageBuffer(buffer) {
  if (!buffer || buffer.length < 4) return false;

  // 1. PNG Header: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return true;
  }

  // 2. JPEG/JPG Header: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return true;
  }

  // 3. WebP Header: RIFF (52 49 46 46) followed by WEBP at offset 8 (57 45 42 50)
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    if (buffer.length >= 12 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      return true;
    }
  }

  return false;
}

module.exports = {
  createRateLimiter,
  checkAuthRateLimit,
  validateBody,
  validateSchema,
  isValidPdfBuffer,
  isValidImageBuffer
};
