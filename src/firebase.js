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
  onAuthStateChanged
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
    console.log('[Firebase] Successfully initialized live connection & auth.');
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
 * Save logo image file (Firebase Storage or Base64 fallback)
 */
export async function dbUploadLogo(file) {
  if (!file) return null;
  
  if (!isMock && storage) {
    try {
      const storageRef = ref(storage, `logos/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(snapshot.ref);
      return downloadUrl;
    } catch (err) {
      console.error('[Firebase Storage] Upload failed, falling back to Base64:', err);
    }
  }

  // Mock Fallback: Convert file to Base64 string for storage inside JSON
  await delay(500);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file for mock upload.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Save invoice to Firestore (Cloud scoped by userId) or LocalStorage (Guest)
 */
export async function dbSaveInvoice(invoiceData, userId) {
  const invoice = {
    ...invoiceData,
    userId: userId || null, // Associate user ID
    createdAt: invoiceData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (!isMock && firestoreDb && userId) {
    try {
      const docRef = await addDoc(collection(firestoreDb, 'invoices'), invoice);
      return { id: docRef.id, ...invoice };
    } catch (err) {
      console.error('[Firestore] Error saving invoice. Retrying in Mock:', err);
    }
  }

  // Guest / LocalStorage Mode
  await delay(400);
  const mockInvoices = JSON.parse(localStorage.getItem('billstacker_invoices') || '[]');
  const newInvoice = {
    ...invoice,
    id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  };
  mockInvoices.push(newInvoice);
  localStorage.setItem('billstacker_invoices', JSON.stringify(mockInvoices));
  return newInvoice;
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
      console.error('[Firestore] Error fetching invoices. Retrying in Local:', err);
    }
  }

  // Guest / LocalStorage Mode
  await delay(300);
  const mockInvoices = JSON.parse(localStorage.getItem('billstacker_invoices') || '[]');
  return mockInvoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
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
    }
  }

  // Guest / LocalStorage Mode
  await delay(300);
  const mockInvoices = JSON.parse(localStorage.getItem('billstacker_invoices') || '[]');
  const filtered = mockInvoices.filter(inv => inv.id !== id);
  localStorage.setItem('billstacker_invoices', JSON.stringify(filtered));
  return true;
}

/**
 * Update invoice by ID
 */
export async function dbUpdateInvoice(id, updatedFields, userId) {
  const fieldsToUpdate = {
    ...updatedFields,
    updatedAt: new Date().toISOString(),
  };

  if (!isMock && firestoreDb && userId && !id.startsWith('local_')) {
    try {
      const docRef = doc(firestoreDb, 'invoices', id);
      await updateDoc(docRef, fieldsToUpdate);
      return { id, ...fieldsToUpdate };
    } catch (err) {
      console.error('[Firestore] Error updating invoice:', err);
    }
  }

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
    }
  }

  // Guest / LocalStorage Mode
  await delay(400);
  localStorage.setItem(`billstacker_profile_${userId}`, JSON.stringify(profileFields));
  return profileFields;
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
    }
  }

  // Guest / LocalStorage Mode
  await delay(250);
  const profile = localStorage.getItem(`billstacker_profile_${userId}`);
  return profile ? JSON.parse(profile) : null;
}

export { isMock };
