import { initializeApp, getApp, getApps } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  updateDoc, 
  query, 
  orderBy,
  where,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';

// Read config from env variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Check if variables are valid and not placeholders
const hasFirebaseConfig = 
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== 'your_api_key_here' && 
  firebaseConfig.projectId;

let app;
let firestoreDb = null;
let storage = null;
let auth = null;
let isMock = true;

if (hasFirebaseConfig) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    firestoreDb = getFirestore(app);
    storage = getStorage(app);
    auth = getAuth(app);
    isMock = false;
    // console.log('[Firebase] Successfully initialized live connection & auth.');
  } catch (error) {
    console.error('[Firebase] Initialization failed. Falling back to Mock Storage.', error);
    isMock = true;
  }
} else {
  console.log('[Firebase] No config found. Running in MOCK mode (LocalStorage fallback).');
}

// Instantly resolve all operations (removed artificial SaaS delay)
const delay = () => Promise.resolve();

// Mock authentication listeners list
const mockAuthListeners = [];
let activeMockUser = JSON.parse(localStorage.getItem('billstacker_mock_user') || 'null');

const triggerMockAuthListeners = (user) => {
  mockAuthListeners.forEach(callback => callback(user));
};

/**
 * Listen for authentication changes (Live or Mock)
 */
export function onAuthStateChange(callback) {
  if (!isMock && auth) {
    return onAuthStateChanged(auth, callback);
  } else {
    // Mock Auth callback
    mockAuthListeners.push(callback);
    // Call immediately with current active mock user
    callback(activeMockUser);
    return () => {
      const idx = mockAuthListeners.indexOf(callback);
      if (idx !== -1) mockAuthListeners.splice(idx, 1);
    };
  }
}

/**
 * Sign in using Google (Live Popup or Simulated Mock)
 */
export async function signInWithGoogle() {
  if (!isMock && auth) {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } else {
    // Mock user sign-in simulation
    await delay(600);
    const mockUser = {
      uid: 'mock_user_billstacker_99',
      displayName: 'Jane Doe (Guest Demo)',
      photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120',
      email: 'jane.doe@billstacker.com',
    };
    activeMockUser = mockUser;
    localStorage.setItem('billstacker_mock_user', JSON.stringify(mockUser));
    triggerMockAuthListeners(mockUser);
    return mockUser;
  }
}

/**
 * Sign out user (Live or Mock)
 */
export async function signOutUser() {
  if (!isMock && auth) {
    await signOut(auth);
  } else {
    // Mock sign-out
    await delay(300);
    activeMockUser = null;
    localStorage.removeItem('billstacker_mock_user');
    triggerMockAuthListeners(null);
  }
}

/**
 * Save logo image file (Base64 conversion to avoid Firebase Storage CORS and Blaze billing upgrade blocks)
 */
export async function dbUploadLogo(file) {
  if (!file) return null;
  
  // Convert logo file to Base64 string directly. This bypasses Firebase Storage requirements
  // so you do not need to upgrade your project to the Blaze plan.
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read logo file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Update user avatar image (Firestore Profile document + mock local sync)
 */
export async function dbUpdateAvatar(userId, base64String) {
  if (!isMock && firestoreDb && userId) {
    const docRef = doc(firestoreDb, 'profiles', userId);
    const docSnap = await getDoc(docRef);
    let currentProfile = {};
    if (docSnap.exists()) {
      currentProfile = docSnap.data();
    }
    currentProfile.photoURL = base64String;
    await setDoc(docRef, currentProfile);
    return { photoURL: base64String };
  } else if (activeMockUser) {
    activeMockUser.photoURL = base64String;
    localStorage.setItem('billstacker_mock_user', JSON.stringify(activeMockUser));
    triggerMockAuthListeners(activeMockUser);
    return activeMockUser;
  }
  return null;
}

/**
 * Save invoice to Firestore (Cloud scoped by userId) or LocalStorage (Guest)
 */
export async function dbSaveInvoice(invoice, userId) {
  const invoiceData = {
    ...invoice,
    userId: userId || 'guest_user'
  };

  if (!isMock && firestoreDb && userId) {
    try {
      const docRef = await addDoc(collection(firestoreDb, 'invoices'), invoiceData);
      return { id: docRef.id, ...invoiceData };
    } catch (err) {
      console.error('[Firestore] Error saving invoice:', err);
      throw err;
    }
  } else {
    // Guest / LocalStorage Mode
    await delay(400);
    const mockInvoices = JSON.parse(localStorage.getItem('billstacker_invoices') || '[]');
    const newInvoice = {
      ...invoiceData,
      id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    mockInvoices.push(newInvoice);
    localStorage.setItem('billstacker_invoices', JSON.stringify(mockInvoices));
    return newInvoice;
  }
}

/**
 * Get invoices (Scoped by userId in cloud, or all Guest invoices locally)
 */
export async function dbGetInvoices(userId) {
  if (!isMock && firestoreDb && userId) {
    try {
      const q = query(
        collection(firestoreDb, 'invoices'), 
        where('userId', '==', userId)
      );
      const querySnapshot = await getDocs(q);
      const invoices = [];
      querySnapshot.forEach((doc) => {
        invoices.push({ id: doc.id, ...doc.data() });
      });
      return invoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (err) {
      console.error('[Firestore] Error fetching invoices:', err);
      throw err;
    }
  } else {
    // Guest / LocalStorage Mode
    await delay(300);
    const mockInvoices = JSON.parse(localStorage.getItem('billstacker_invoices') || '[]');
    return mockInvoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

/**
 * Delete invoice by ID
 */
export async function dbDeleteInvoice(id, userId) {
  if (!isMock && firestoreDb && userId && !id.startsWith('local_')) {
    try {
      await deleteDoc(doc(firestoreDb, 'invoices', id));
      return true;
    } catch (err) {
      console.error('[Firestore] Error deleting invoice:', err);
      throw err;
    }
  } else {
    // Guest / LocalStorage Mode
    await delay(300);
    const mockInvoices = JSON.parse(localStorage.getItem('billstacker_invoices') || '[]');
    const filtered = mockInvoices.filter(inv => inv.id !== id);
    localStorage.setItem('billstacker_invoices', JSON.stringify(filtered));
    return true;
  }
}

/**
 * Update invoice by ID
 */
export async function dbUpdateInvoice(id, updatedFields, userId) {
  const fieldsToUpdate = {
    ...updatedFields,
    userId: userId || updatedFields.userId || 'guest_user',
    updatedAt: new Date().toISOString(),
  };

  if (!isMock && firestoreDb && userId && !id.startsWith('local_')) {
    try {
      const docRef = doc(firestoreDb, 'invoices', id);
      await updateDoc(docRef, fieldsToUpdate);
      return { id, ...fieldsToUpdate };
    } catch (err) {
      console.error('[Firestore] Error updating invoice:', err);
      throw err;
    }
  } else {
    // Guest / LocalStorage Mode
    await delay(350);
    const mockInvoices = JSON.parse(localStorage.getItem('billstacker_invoices') || '[]');
    const index = mockInvoices.findIndex(inv => inv.id === id);
    if (index !== -1) {
      mockInvoices[index] = { ...mockInvoices[index], ...fieldsToUpdate };
      localStorage.setItem('billstacker_invoices', JSON.stringify(mockInvoices));
      return mockInvoices[index];
    }
    throw new Error(`Invoice with ID ${id} not found.`);
  }
}

/**
 * Save default company profile settings for logged-in user
 */
export async function dbSaveDefaultProfile(userId, profileFields) {
  if (!userId) return null;

  if (!isMock && firestoreDb) {
    try {
      const docRef = doc(firestoreDb, 'profiles', userId);
      await setDoc(docRef, profileFields);
      return profileFields;
    } catch (err) {
      console.error('[Firestore] Error saving user profile:', err);
      throw err;
    }
  } else {
    // Guest / LocalStorage Mode
    await delay(400);
    localStorage.setItem(`billstacker_profile_${userId}`, JSON.stringify(profileFields));
    return profileFields;
  }
}

/**
 * Fetch default company profile settings for logged-in user
 */
export async function dbGetDefaultProfile(userId) {
  if (!userId) return null;

  if (!isMock && firestoreDb) {
    try {
      const docRef = doc(firestoreDb, 'profiles', userId);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() : null;
    } catch (err) {
      console.error('[Firestore] Error fetching user profile:', err);
      throw err;
    }
  } else {
    // Guest / LocalStorage Mode
    await delay(250);
    const profile = localStorage.getItem(`billstacker_profile_${userId}`);
    return profile ? JSON.parse(profile) : null;
  }
}

/**
 * Fetch all registered user profiles (Admin action)
 */
export async function dbGetAllProfiles() {
  if (!isMock && firestoreDb) {
    try {
      const colRef = collection(firestoreDb, 'profiles');
      const querySnapshot = await getDocs(colRef);
      const profiles = [];
      querySnapshot.forEach((doc) => {
        profiles.push({ id: doc.id, ...doc.data() });
      });
      return profiles;
    } catch (err) {
      console.error('[Firestore] Error fetching all profiles:', err);
      throw err;
    }
  } else {
    // Guest / Mock mode
    await delay(300);
    const profiles = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('billstacker_profile_')) {
        const userId = key.replace('billstacker_profile_', '');
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          profiles.push({ id: userId, ...data });
        } catch (e) {
          console.error(e);
        }
      }
    }
    
    // Seed a few mock users if empty so the admin has something to view instantly
    if (profiles.length === 0) {
      const defaultMockProfiles = [
        {
          id: 'mock_user_billstacker_99',
          senderInfo: { name: 'Jane Doe', email: 'jane.doe@billstacker.com' },
          currency: 'USD',
          isPremium: false,
          isAdmin: false,
          joinedDate: new Date(Date.now() - 3600000 * 24 * 5).toISOString()
        },
        {
          id: 'mock_email_adminbillstackercom',
          senderInfo: { name: 'BillStacker Admin', email: 'admin@billstacker.com' },
          currency: 'USD',
          isPremium: true,
          isAdmin: true,
          joinedDate: new Date(Date.now() - 3600000 * 24 * 30).toISOString()
        },
        {
          id: 'mock_email_johnsmith',
          senderInfo: { name: 'John Smith', email: 'john.smith@gmail.com' },
          currency: 'EUR',
          isPremium: true,
          isAdmin: false,
          joinedDate: new Date(Date.now() - 3600000 * 24 * 2).toISOString()
        }
      ];
      defaultMockProfiles.forEach(p => {
        localStorage.setItem(`billstacker_profile_${p.id}`, JSON.stringify(p));
      });
      return defaultMockProfiles;
    }
    
    return profiles;
  }
}

/**
 * Toggle a user's subscription tier between Free and Premium (Admin action)
 */
export async function dbToggleUserTier(userId, isPremium) {
  if (!userId) return null;

  if (!isMock && firestoreDb) {
    try {
      const docRef = doc(firestoreDb, 'profiles', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        data.isPremium = isPremium;
        await setDoc(docRef, data);
        return data;
      } else {
        // Create basic profile with Premium tier
        const data = {
          senderInfo: { name: 'Member', email: '' },
          currency: 'USD',
          isPremium: isPremium,
          joinedDate: new Date().toISOString()
        };
        await setDoc(docRef, data);
        return data;
      }
    } catch (err) {
      console.error('[Firestore] Error toggling user tier:', err);
    }
  }

  // Guest / Mock mode
  await delay(200);
  const key = `billstacker_profile_${userId}`;
  const localProfileStr = localStorage.getItem(key);
  if (localProfileStr) {
    const data = JSON.parse(localProfileStr);
    data.isPremium = isPremium;
    localStorage.setItem(key, JSON.stringify(data));
    return data;
  } else {
    const data = {
      senderInfo: { name: 'Member', email: '' },
      currency: 'USD',
      isPremium: isPremium,
      joinedDate: new Date().toISOString()
    };
    localStorage.setItem(key, JSON.stringify(data));
    return data;
  }
}

/**
 * Toggle a user's banned status (Admin action)
 */
export async function dbToggleUserBan(userId, isBanned) {
  if (!userId) return null;

  if (!isMock && firestoreDb) {
    try {
      const docRef = doc(firestoreDb, 'profiles', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        data.isBanned = isBanned;
        await setDoc(docRef, data);
        return data;
      } else {
        const data = {
          senderInfo: { name: 'Member', email: '' },
          currency: 'USD',
          isPremium: false,
          isBanned: isBanned,
          joinedDate: new Date().toISOString()
        };
        await setDoc(docRef, data);
        return data;
      }
    } catch (err) {
      console.error('[Firestore] Error toggling user ban:', err);
      throw err;
    }
  } else {
    // Guest / Mock mode
    await delay(200);
    const key = `billstacker_profile_${userId}`;
    const localProfileStr = localStorage.getItem(key);
    if (localProfileStr) {
      const data = JSON.parse(localProfileStr);
      data.isBanned = isBanned;
      localStorage.setItem(key, JSON.stringify(data));
      return data;
    } else {
      const data = {
        senderInfo: { name: 'Member', email: '' },
        currency: 'USD',
        isPremium: false,
        isBanned: isBanned,
        joinedDate: new Date().toISOString()
      };
      localStorage.setItem(key, JSON.stringify(data));
      return data;
    }
  }
}

/**
 * Fetch all platform invoices (Admin action)
 */
export async function dbGetAllInvoices() {
  if (!isMock && firestoreDb) {
    try {
      const colRef = collection(firestoreDb, 'invoices');
      const querySnapshot = await getDocs(colRef);
      const invoices = [];
      querySnapshot.forEach((doc) => {
        invoices.push({ id: doc.id, ...doc.data() });
      });
      return invoices;
    } catch (err) {
      console.error('[Firestore] Error fetching all platform invoices:', err);
    }
  }

  // Guest / Mock mode
  await delay(200);
  return JSON.parse(localStorage.getItem('billstacker_invoices') || '[]');
}

/**
 * Sign Up with Email (Live Firebase Auth or Simulated Mock)
 */
export async function signUpWithEmail(email, password, displayName, phone, gender) {
  const defaultPhoto = gender === 'female' 
    ? 'https://avatar.iran.liara.run/public/40' 
    : 'https://avatar.iran.liara.run/public/30';

  if (!isMock && auth) {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { 
      displayName, 
      photoURL: defaultPhoto 
    });
    
    // Save metadata profile fields in Firestore
    const profileFields = {
      senderInfo: {
        name: displayName,
        email: email,
        address: '',
        phone: phone || '',
        logoUrl: ''
      },
      currency: 'USD',
      paymentDetails: {
        method: '',
        terms: ''
      },
      gender: gender,
      phone: phone || '',
      isPremium: false,
      isAdmin: email.toLowerCase() === 'admin@billstacker.com',
      joinedDate: new Date().toISOString()
    };
    await dbSaveDefaultProfile(result.user.uid, profileFields);
    return result.user;
  } else {
    await delay(500);
    const mockUser = {
      uid: 'mock_email_' + email.replace(/[^a-zA-Z0-9]/g, ''),
      displayName,
      email,
      photoURL: defaultPhoto,
    };
    
    // Save to mock profile
    const profileFields = {
      senderInfo: {
        name: displayName,
        email: email,
        address: '',
        phone: phone || '',
        logoUrl: ''
      },
      currency: 'USD',
      paymentDetails: {
        method: '',
        terms: ''
      },
      gender: gender,
      phone: phone || '',
      isPremium: false,
      isAdmin: email.toLowerCase() === 'admin@billstacker.com',
      joinedDate: new Date().toISOString()
    };
    localStorage.setItem(`billstacker_profile_${mockUser.uid}`, JSON.stringify(profileFields));
    
    activeMockUser = mockUser;
    localStorage.setItem('billstacker_mock_user', JSON.stringify(mockUser));
    triggerMockAuthListeners(mockUser);
    return mockUser;
  }
}

/**
 * Sign In with Email (Live Firebase Auth or Simulated Mock)
 */
export async function signInWithEmail(email, password) {
  if (!isMock && auth) {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (err) {
      const isEmailAdmin = email.toLowerCase() === 'admin@billstacker.com';
      // Automatically register the admin user if their account is not found on a fresh Firebase instance
      if (isEmailAdmin && (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password')) {
        try {
          console.log('[Admin Auth] Admin account not found. Automatically registering admin@billstacker.com...');
          const signupResult = await signUpWithEmail(email, password, 'BillStacker Admin', '', 'male');
          return signupResult;
        } catch (signupErr) {
          throw err;
        }
      }
      throw err;
    }
  } else {
    await delay(400);
    // Find if a profile is already saved for this mock email, otherwise create it
    const mockUid = 'mock_email_' + email.replace(/[^a-zA-Z0-9]/g, '');
    let localProfileStr = localStorage.getItem(`billstacker_profile_${mockUid}`);
    let localProfile = localProfileStr ? JSON.parse(localProfileStr) : null;
    
    if (!localProfile) {
      localProfile = {
        senderInfo: {
          name: email.split('@')[0],
          email: email,
          address: '',
          phone: '',
          logoUrl: ''
        },
        currency: 'USD',
        paymentDetails: {
          method: '',
          terms: ''
        },
        gender: 'male',
        phone: '',
        isPremium: false,
        isAdmin: email.toLowerCase() === 'admin@billstacker.com',
        joinedDate: new Date().toISOString()
      };
      localStorage.setItem(`billstacker_profile_${mockUid}`, JSON.stringify(localProfile));
    }

    const name = localProfile.senderInfo?.name || email.split('@')[0];
    const defaultPhoto = localProfile.gender === 'female' 
      ? 'https://avatar.iran.liara.run/public/40' 
      : 'https://avatar.iran.liara.run/public/30';

    const mockUser = {
      uid: mockUid,
      displayName: name,
      email,
      photoURL: defaultPhoto,
    };

    activeMockUser = mockUser;
    localStorage.setItem('billstacker_mock_user', JSON.stringify(mockUser));
    triggerMockAuthListeners(mockUser);
    return mockUser;
  }
}

/**
 * Save customer review (Live Firestore or LocalStorage fallback)
 */
export async function dbSaveReview(reviewData) {
  const finalReview = {
    ...reviewData,
    createdAt: new Date().toISOString()
  };

  if (!isMock && firestoreDb) {
    try {
      const colRef = collection(firestoreDb, 'reviews');
      await addDoc(colRef, finalReview);
      return finalReview;
    } catch (err) {
      console.error('[Firestore] Error saving review:', err);
    }
  }

  // Guest / LocalStorage Mode
  await delay(200);
  const reviews = JSON.parse(localStorage.getItem('billstacker_reviews') || '[]');
  reviews.unshift({ ...finalReview, id: 'local_rev_' + Date.now() });
  localStorage.setItem('billstacker_reviews', JSON.stringify(reviews));
  return finalReview;
}

/**
 * Get customer reviews list (Live Firestore or LocalStorage fallback)
 */
export async function dbGetReviews() {
  if (!isMock && firestoreDb) {
    try {
      const colRef = collection(firestoreDb, 'reviews');
      const q = query(colRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.error('[Firestore] Error getting reviews:', err);
    }
  }

  // Guest / LocalStorage Mode
  await delay(300);
  const localReviews = JSON.parse(localStorage.getItem('billstacker_reviews') || '[]');
  
  // Provide pre-seeded testimonials if empty so it looks beautiful instantly
  if (localReviews.length === 0) {
    const seeds = [
      {
        id: 'seed_1',
        userName: 'Aarav Mehta',
        userPhoto: 'https://avatar.iran.liara.run/public/15',
        rating: 5,
        comment: 'BillStacker has completely streamlined my invoice workflow. The dynamic PDF tool is incredibly fast and premium.',
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
      },
      {
        id: 'seed_2',
        userName: 'Sophia Dubois',
        userPhoto: 'https://avatar.iran.liara.run/public/65',
        rating: 5,
        comment: 'I upgraded to Premium and the clean borderless invoice format is beautiful. Saved over 10 hours of manual bookkeeping this month!',
        createdAt: new Date(Date.now() - 3600000 * 24).toISOString()
      },
      {
        id: 'seed_3',
        userName: 'Rajesh Kumar',
        userPhoto: 'https://avatar.iran.liara.run/public/44',
        rating: 4,
        comment: 'The Image-to-PDF utility is fantastic for combining receipt scans. Recommended to my whole freelance team.',
        createdAt: new Date(Date.now() - 3600000 * 72).toISOString()
      }
    ];
    localStorage.setItem('billstacker_reviews', JSON.stringify(seeds));
    return seeds;
  }
  return localReviews;
}

/**
 * Save blog post (Create or Update)
 */
export async function dbSaveBlogPost(postData) {
  const post = {
    ...postData,
    updatedAt: new Date().toISOString(),
    createdAt: postData.createdAt || new Date().toISOString()
  };
  
  if (!isMock && firestoreDb) {
    try {
      if (post.id) {
        const docRef = doc(firestoreDb, 'blogs', post.id);
        await setDoc(docRef, post);
        return post;
      } else {
        const colRef = collection(firestoreDb, 'blogs');
        const docRef = await addDoc(colRef, post);
        post.id = docRef.id;
        // Update document with ID inside data
        await setDoc(docRef, post);
        return post;
      }
    } catch (err) {
      console.error('[Firestore] Error saving blog post:', err);
      throw err;
    }
  } else {
    // Guest / Mock mode
    await delay(200);
    const localBlogs = JSON.parse(localStorage.getItem('billstacker_blogs') || '[]');
    if (post.id) {
      const index = localBlogs.findIndex(b => b.id === post.id);
      if (index !== -1) {
        localBlogs[index] = post;
      }
    } else {
      post.id = 'blog_' + Date.now();
      localBlogs.push(post);
    }
    localStorage.setItem('billstacker_blogs', JSON.stringify(localBlogs));
    return post;
  }
}

/**
 * Fetch blog posts
 */
export async function dbGetBlogPosts(includeDrafts = false) {
  if (!isMock && firestoreDb) {
    try {
      const colRef = collection(firestoreDb, 'blogs');
      let q;
      if (includeDrafts) {
        q = query(colRef);
      } else {
        q = query(colRef, where('published', '==', true));
      }
      const querySnapshot = await getDocs(q);
      const posts = [];
      querySnapshot.forEach((doc) => {
        posts.push({ id: doc.id, ...doc.data() });
      });
      // Sort in-memory to prevent composite index requirements
      return posts.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    } catch (err) {
      console.error('[Firestore] Error getting blog posts:', err);
      throw err;
    }
  } else {
    // Guest / Mock mode
    await delay(200);
    const localBlogs = JSON.parse(localStorage.getItem('billstacker_blogs') || '[]');
    
    // Seed initial blog posts if empty so the public blog looks gorgeous immediately
    if (localBlogs.length === 0) {
      const seeds = [
        {
          id: 'seed_blog_1',
          title: 'Introducing BillStacker SaaS Suite',
          slug: 'introducing-billstacker',
          published: true,
          imageUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=60',
          body: 'Welcome to BillStacker! We are excited to launch our secure invoice management and premium PDF utility suite. Read our guide to learn how to manage receipts and merge documents dynamically.',
          createdAt: new Date(Date.now() - 3600000 * 24 * 10).toISOString(),
          updatedAt: new Date(Date.now() - 3600000 * 24 * 10).toISOString()
        },
        {
          id: 'seed_blog_2',
          title: 'Getting Started with Paytm Checkout',
          slug: 'getting-started-paytm',
          published: true,
          imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=60',
          body: 'Learn how to configure your account settings to accept and manage client payments. Upgrade to Premium to toggle watermark rules and compile white-label documents.',
          createdAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
          updatedAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString()
        },
        {
          id: 'seed_blog_3',
          title: 'Best Practices for Compressing PDFs without Losing Quality',
          slug: 'compress-pdf-best-practices',
          published: true,
          imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60',
          body: 'Managing digital receipts and document files can quickly lead to storage overhead and slow email response times. PDFs are particularly prone to getting bloated when they contain high-resolution images, styled layouts, or embedded typography assets.\n\nHere are three best practices for compressing PDFs:\n1. Downscale Images to Web Resolutions (e.g. 72-150 DPI)\n2. Strip Unused Metadata and Extra Font Sets\n3. Clean Object Streams and Redundant Tags\n\nUsing BillStacker\'s built-in PDF Reducer, you can automatically downscale files in memory while keeping text content sharp and vector lines clean. Upgrading to Premium removes all processing limits and strips platform watermark branding, allowing you to deliver premium branded PDFs directly to your clients.',
          createdAt: new Date(Date.now() - 3600000 * 24 * 1).toISOString(),
          updatedAt: new Date(Date.now() - 3600000 * 24 * 1).toISOString()
        }
      ];
      localStorage.setItem('billstacker_blogs', JSON.stringify(seeds));
      return includeDrafts ? seeds : seeds.filter(b => b.published);
    }
    
    return includeDrafts ? localBlogs : localBlogs.filter(b => b.published);
  }
}

/**
 * Delete blog post by ID
 */
export async function dbDeleteBlogPost(postId) {
  if (!isMock && firestoreDb && postId) {
    try {
      await deleteDoc(doc(firestoreDb, 'blogs', postId));
      return true;
    } catch (err) {
      console.error('[Firestore] Error deleting blog post:', err);
      throw err;
    }
  } else {
    // Guest / Mock mode
    await delay(100);
    const localBlogs = JSON.parse(localStorage.getItem('billstacker_blogs') || '[]');
    const filtered = localBlogs.filter(b => b.id !== postId);
    localStorage.setItem('billstacker_blogs', JSON.stringify(filtered));
    return true;
  }
}

/**
 * Submit User Feedback
 */
export async function dbSubmitFeedback(feedbackData) {
  if (!isMock && firestoreDb) {
    try {
      const colRef = collection(firestoreDb, 'feedback');
      const docRef = await addDoc(colRef, {
        ...feedbackData,
        status: 'Pending',
        createdAt: new Date().toISOString()
      });
      return { id: docRef.id, ...feedbackData, status: 'Pending', createdAt: new Date().toISOString() };
    } catch (err) {
      console.error('[Firestore] Error submitting feedback:', err);
      throw err;
    }
  } else {
    // Guest / Mock mode
    await delay(100);
    const key = 'billstacker_feedback';
    const localFeedbacks = JSON.parse(localStorage.getItem(key) || '[]');
    const newFeedback = {
      id: 'mock_fb_' + Math.random().toString(36).substr(2, 9),
      ...feedbackData,
      status: 'Pending',
      createdAt: new Date().toISOString()
    };
    localFeedbacks.push(newFeedback);
    localStorage.setItem(key, JSON.stringify(localFeedbacks));
    return newFeedback;
  }
}

/**
 * Fetch All Feedbacks (Admin Action)
 */
export async function dbGetAllFeedbacks() {
  if (!isMock && firestoreDb) {
    try {
      const colRef = collection(firestoreDb, 'feedback');
      const querySnapshot = await getDocs(colRef);
      const feedbacks = [];
      querySnapshot.forEach((doc) => {
        feedbacks.push({ id: doc.id, ...doc.data() });
      });
      // Sort: Pending first, then by date descending
      return feedbacks.sort((a, b) => {
        if (a.status === 'Pending' && b.status === 'Solved') return -1;
        if (a.status === 'Solved' && b.status === 'Pending') return 1;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
    } catch (err) {
      console.error('[Firestore] Error fetching all feedbacks:', err);
      throw err;
    }
  } else {
    // Guest / Mock mode
    await delay(200);
    const key = 'billstacker_feedback';
    const localFeedbacks = JSON.parse(localStorage.getItem(key) || '[]');
    
    // Seed initial tickets if empty for premium admin demo aesthetics
    if (localFeedbacks.length === 0) {
      const seeds = [
        {
          id: 'seed_fb_1',
          userId: 'guest_user',
          userName: 'Rohan Sharma',
          userEmail: 'rohan.sharma@example.com',
          type: 'Bug Report',
          message: 'The PDF Merger throws a memory layout warning when attempting to merge 5 compressed images. Works on desktop but slow on Chrome Mobile.',
          status: 'Pending',
          createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
        },
        {
          id: 'seed_fb_2',
          userId: 'guest_user_2',
          userName: 'Anita Desai',
          userEmail: 'anita.desai@example.com',
          type: 'Feature Request',
          message: 'Can you add custom theme options for the invoice templates? A dark-themed invoice style would look extremely modern.',
          status: 'Solved',
          createdAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
          resolvedAt: new Date(Date.now() - 3600000 * 24).toISOString()
        }
      ];
      localStorage.setItem(key, JSON.stringify(seeds));
      return seeds;
    }
    
    return localFeedbacks.sort((a, b) => {
      if (a.status === 'Pending' && b.status === 'Solved') return -1;
      if (a.status === 'Solved' && b.status === 'Pending') return 1;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }
}

/**
 * Solve / Close Feedback (Admin Action)
 */
export async function dbResolveFeedback(feedbackId) {
  if (!isMock && firestoreDb && feedbackId) {
    try {
      const docRef = doc(firestoreDb, 'feedback', feedbackId);
      await updateDoc(docRef, {
        status: 'Solved',
        resolvedAt: new Date().toISOString()
      });
      return true;
    } catch (err) {
      console.error('[Firestore] Error resolving feedback:', err);
      throw err;
    }
  } else {
    // Guest / Mock mode
    await delay(100);
    const key = 'billstacker_feedback';
    const localFeedbacks = JSON.parse(localStorage.getItem(key) || '[]');
    const updated = localFeedbacks.map(f => {
      if (f.id === feedbackId) {
        return { ...f, status: 'Solved', resolvedAt: new Date().toISOString() };
      }
      return f;
    });
    localStorage.setItem(key, JSON.stringify(updated));
    return true;
  }
}

/**
 * Send password reset email
 */
export async function dbSendPasswordReset(email) {
  if (!isMock && auth) {
    try {
      await sendPasswordResetEmail(auth, email);
      return true;
    } catch (err) {
      console.error('[Firestore] Error sending reset email:', err);
      throw err;
    }
  } else {
    // Guest / Mock mode
    await delay(100);
    return true;
  }
}

/**
 * Seed live Firestore database with sample blogs and feedbacks
 */
export async function dbSeedSampleData() {
  if (!isMock && firestoreDb) {
    try {
      const blogsRef = collection(firestoreDb, 'blogs');
      const feedbackRef = collection(firestoreDb, 'feedback');

      // 1. Seed blogs
      const blogSeeds = [
        {
          title: 'Introducing BillStacker SaaS Suite',
          slug: 'introducing-billstacker',
          published: true,
          imageUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=60',
          body: 'Welcome to BillStacker! We are excited to launch our secure invoice management and premium PDF utility suite. Read our guide to learn how to manage receipts and merge documents dynamically.',
          createdAt: new Date(Date.now() - 3600000 * 24 * 10).toISOString(),
          updatedAt: new Date(Date.now() - 3600000 * 24 * 10).toISOString()
        },
        {
          title: 'Getting Started with Paytm Checkout',
          slug: 'getting-started-paytm',
          published: true,
          imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=60',
          body: 'Learn how to configure your account settings to accept and manage client payments. Upgrade to Premium to toggle watermark rules and compile white-label documents.',
          createdAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
          updatedAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString()
        },
        {
          title: 'Best Practices for Compressing PDFs without Losing Quality',
          slug: 'compress-pdf-best-practices',
          published: true,
          imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60',
          body: 'Managing digital receipts and document files can quickly lead to storage overhead and slow email response times. PDFs are particularly prone to getting bloated when they contain high-resolution images, styled layouts, or embedded typography assets.\n\nHere are three best practices for compressing PDFs:\n1. Downscale Images to Web Resolutions (e.g. 72-150 DPI)\n2. Strip Unused Metadata and Extra Font Sets\n3. Clean Object Streams and Redundant Tags\n\nUsing BillStacker\'s built-in PDF Reducer, you can automatically downscale files in memory while keeping text content sharp and vector lines clean. Upgrading to Premium removes all processing limits and strips platform watermark branding, allowing you to deliver premium branded PDFs directly to your clients.',
          createdAt: new Date(Date.now() - 3600000 * 24 * 1).toISOString(),
          updatedAt: new Date(Date.now() - 3600000 * 24 * 1).toISOString()
        }
      ];

      for (const blog of blogSeeds) {
        const q = query(blogsRef, where('slug', '==', blog.slug));
        const snap = await getDocs(q);
        if (snap.empty) {
          await addDoc(blogsRef, blog);
        }
      }

      // 2. Seed feedback tickets
      const feedbackSeeds = [
        {
          userId: 'guest_user',
          userName: 'Rohan Sharma',
          userEmail: 'rohan.sharma@example.com',
          type: 'Bug Report',
          message: 'The PDF Merger throws a memory layout warning when attempting to merge 5 compressed images. Works on desktop but slow on Chrome Mobile.',
          status: 'Pending',
          createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
        },
        {
          userId: 'guest_user_2',
          userName: 'Anita Desai',
          userEmail: 'anita.desai@example.com',
          type: 'Feature Request',
          message: 'Can you add custom theme options for the invoice templates? A dark-themed invoice style would look extremely modern.',
          status: 'Solved',
          createdAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
          resolvedAt: new Date(Date.now() - 3600000 * 24).toISOString()
        }
      ];

      for (const fb of feedbackSeeds) {
        const q = query(feedbackRef, where('message', '==', fb.message));
        const snap = await getDocs(q);
        if (snap.empty) {
          await addDoc(feedbackRef, fb);
        }
      }

      return true;
    } catch (err) {
      console.error('[Firestore] Seeding error:', err);
      throw err;
    }
  } else {
    // Mock / LocalStorage seed
    await delay(200);
    return true;
  }
}

export { isMock };
