import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL
} from 'firebase/storage';

// Firebase client configuration
// Uses environment variables with placeholders for seamless local & production development
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyPlaceholderKeyForAadaStore2026",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "aada-clothing.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "aada-clothing",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "aada-clothing.appspot.com",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "109876543210",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:109876543210:web:aada1234567890"
};

// Singleton Firebase App initialization
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

/**
 * Checks whether live environment credentials have been supplied
 */
export function isFirebaseConfigured() {
  const key = process.env.REACT_APP_FIREBASE_API_KEY;
  return Boolean(key && !key.includes('Placeholder'));
}

export function getFirebaseConfigSummary() {
  return {
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
    isConfigured: isFirebaseConfigured(),
    authDomain: firebaseConfig.authDomain
  };
}

/**
 * Firebase Auth: Email & Password Sign-in
 */
export async function loginWithEmail(email, password) {
  if (!isFirebaseConfigured()) {
    // Demo fallback for development without live Firebase project keys
    if (email && password && password.length >= 6) {
      const mockUser = {
        uid: 'demo_admin_' + Date.now(),
        email: email,
        displayName: email.split('@')[0],
        isDemo: true
      };
      sessionStorage.setItem('aada_admin_demo_user', JSON.stringify(mockUser));
      return { success: true, user: mockUser, isDemo: true };
    }
    throw new Error('Password must be at least 6 characters.');
  }

  const credential = await signInWithEmailAndPassword(auth, email, password);
  return { success: true, user: credential.user, isDemo: false };
}

/**
 * Firebase Auth: Google Sign-in Popup
 */
export async function loginWithGoogle() {
  if (!isFirebaseConfigured()) {
    const mockUser = {
      uid: 'google_demo_' + Date.now(),
      email: 'admin.google@aada-atelier.com',
      displayName: 'AADA Admin (Google Demo)',
      isDemo: true
    };
    sessionStorage.setItem('aada_admin_demo_user', JSON.stringify(mockUser));
    return { success: true, user: mockUser, isDemo: true };
  }

  const credential = await signInWithPopup(auth, googleProvider);
  return { success: true, user: credential.user, isDemo: false };
}

/**
 * Firebase Auth: Sign Out
 */
export async function logoutUser() {
  sessionStorage.removeItem('aada_admin_demo_user');
  sessionStorage.removeItem('aada_admin_auth');
  if (isFirebaseConfigured()) {
    await signOut(auth);
  }
  return { success: true };
}

/**
 * Firebase Auth: Observer
 */
export function subscribeToAuthState(callback) {
  // Check for local demo user first if placeholder mode
  if (!isFirebaseConfigured()) {
    const demoUser = sessionStorage.getItem('aada_admin_demo_user');
    if (demoUser) {
      try {
        callback(JSON.parse(demoUser));
        return () => {};
      } catch (e) {
        // fall through
      }
    }
  }

  return onAuthStateChanged(auth, (user) => {
    callback(user);
  });
}

/**
 * Firebase Auth: Send Password Reset Email
 */
export async function resetPassword(email) {
  if (!isFirebaseConfigured()) {
    return { success: true, message: 'Password reset link simulated in Demo Mode.' };
  }
  await sendPasswordResetEmail(auth, email);
  return { success: true, message: 'Password reset email sent!' };
}


/**
 * Uploads an image file to Firebase Storage with progress tracking.
 * Falls back gracefully to base64 if storage is not connected or fails.
 * 
 * @param {File} file - The file to upload
 * @param {Function} onProgress - Callback receiving (progressPercent)
 * @returns {Promise<{downloadURL: string, path: string, isFallback: boolean}>}
 */
export async function uploadProductImage(file, onProgress) {
  if (!file) throw new Error("No file provided for upload");

  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `catalog-images/${timestamp}_${sanitizedName}`;

  // If live credentials are not present, provide realistic simulated upload + base64 data URL
  if (!isFirebaseConfigured()) {
    console.warn("Firebase Storage credentials in placeholder mode. Using local data URL fallback.");
    return new Promise((resolve) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += 25;
        if (onProgress) onProgress(Math.min(progress, 100));
        if (progress >= 100) {
          clearInterval(interval);
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              downloadURL: reader.result,
              path: storagePath,
              isFallback: true
            });
          };
          reader.readAsDataURL(file);
        }
      }, 120);
    });
  }

  // Live Firebase Storage upload
  try {
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type || 'image/jpeg'
    });

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );
          if (onProgress) onProgress(progress);
        },
        async (error) => {
          console.error("Firebase Storage upload error, creating fallback:", error);
          // Fall back gracefully to base64 so user flow is not broken
          try {
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                downloadURL: reader.result,
                path: storagePath,
                isFallback: true,
                warning: `Storage upload issue (${error.message}). Saved with image data fallback.`
              });
            };
            reader.readAsDataURL(file);
          } catch (readerError) {
            reject(error);
          }
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({
            downloadURL,
            path: storagePath,
            isFallback: false
          });
        }
      );
    });
  } catch (error) {
    console.error("Storage upload exception:", error);
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          downloadURL: reader.result,
          path: storagePath,
          isFallback: true,
          warning: "Upload fallback active."
        });
      };
      reader.readAsDataURL(file);
    });
  }
}

/**
 * Saves a new product to Firestore:
 * 1. Inserts into the 'products' collection (one doc per item)
 * 2. Appends to 'store_data/catalog' (matching fetch-catalog.js structure)
 * 
 * @param {Object} product - Product details conforming to catalog.json format
 * @returns {Promise<{success: boolean, mode: string, message: string}>}
 */
export async function saveProductToFirestore(product) {
  if (!product || !product.id) {
    throw new Error("Invalid product data provided");
  }

  const structuredProduct = {
    id: product.id,
    name: product.name,
    description: product.description || "",
    priceInr: Number(product.priceInr) || 0,
    priceAed: Number(product.priceAed) || 0,
    image: product.image || "",
    gender: product.gender || "Women",
    category: product.category || "Clothing",
    subcategory: product.subcategory || "Ethnic Wear",
    inStock: Boolean(product.inStock),
    updatedAt: new Date().toISOString()
  };

  // If live credentials are not set, return simulated success for placeholder mode
  if (!isFirebaseConfigured()) {
    console.info("Firestore configured with placeholders. Product saved to local session catalog.");
    return {
      success: true,
      mode: 'placeholder',
      message: 'Product formatted for Firestore catalog and saved to local state (Placeholder Mode).',
      product: structuredProduct
    };
  }

  try {
    // 1. Write individual doc to 'products' collection
    const productDocRef = doc(db, 'products', product.id);
    await setDoc(productDocRef, {
      ...structuredProduct,
      serverTime: serverTimestamp()
    }, { merge: true });

    // 2. Sync to store_data/catalog (which fetch-catalog.js pulls from)
    const catalogDocRef = doc(db, 'store_data', 'catalog');
    const catalogSnap = await getDoc(catalogDocRef);

    if (catalogSnap.exists()) {
      const data = catalogSnap.data();
      if (Array.isArray(data.items)) {
        await updateDoc(catalogDocRef, {
          items: arrayUnion(structuredProduct)
        });
      } else if (data.items && Array.isArray(data.items.products)) {
        const updatedProducts = [...data.items.products, structuredProduct];
        await updateDoc(catalogDocRef, {
          'items.products': updatedProducts
        });
      } else {
        await updateDoc(catalogDocRef, {
          items: arrayUnion(structuredProduct)
        });
      }
    } else {
      // Create fresh document structure if it doesn't exist
      await setDoc(catalogDocRef, {
        items: [structuredProduct],
        lastUpdated: serverTimestamp()
      });
    }

    return {
      success: true,
      mode: 'live',
      message: 'Product uploaded to Firestore (both catalog doc and products collection)!',
      product: structuredProduct
    };
  } catch (error) {
    console.error("Firestore write error:", error);
    return {
      success: false,
      mode: 'error',
      message: `Firestore sync failed: ${error.message}. Product retained in local inventory.`,
      error: error.message,
      product: structuredProduct
    };
  }
}
