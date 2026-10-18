const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

const outputPath = path.join(__dirname, 'src', 'data', 'catalog.json');

/**
 * Resolves Firebase service account credentials dynamically without hardcoding specific filenames or secrets in source code.
 */
function resolveServiceAccount() {
  // 1. Direct JSON string from environment variable (e.g., GitHub Actions secret)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (e) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable:', e);
    }
  }

  // 2. Custom path from environment variable
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH && fs.existsSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)) {
    try {
      return require(path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH));
    } catch (e) {
      console.error('Failed to load file from FIREBASE_SERVICE_ACCOUNT_PATH:', e);
    }
  }

  // 3. Dynamically discover any admin SDK key or service-account JSON file in the parent or root folder without hardcoding key IDs
  const candidateDirs = [path.join(__dirname, '..'), __dirname];
  for (const dir of candidateDirs) {
    try {
      const files = fs.readdirSync(dir);
      const match = files.find((f) =>
        (f.includes('firebase-adminsdk') || f.startsWith('service-account')) && f.endsWith('.json')
      );
      if (match) {
        return require(path.join(dir, match));
      }
    } catch (e) {
      // Ignore directory read errors
    }
  }

  return null;
}

const serviceAccount = resolveServiceAccount();

if (!serviceAccount) {
  if (fs.existsSync(outputPath)) {
    console.log('Firebase credentials not found. Using pre-existing catalog at src/data/catalog.json.');
    process.exit(0);
  } else {
    console.error('Firebase credentials not found and no local catalog.json exists.');
    process.exit(1);
  }
}

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}
const db = getFirestore();

async function fetchCatalog() {
  try {
    console.log('Fetching catalog from Firestore...');
    const docRef = db.collection('store_data').doc('catalog');
    const doc = await docRef.get();
    if (!doc.exists) {
      console.error('No catalog document found in Firestore.');
      if (fs.existsSync(outputPath)) {
        console.warn('Falling back to existing catalog.json');
        process.exit(0);
      }
      process.exit(1);
    }
    console.log('Catalog fetched successfully.');
    const data = doc.data();

    // Normalize into { products: [...] } format expected by Shop.jsx and AdminUI.jsx
    let products = [];
    if (Array.isArray(data.items)) {
      products = data.items;
    } else if (data.items && Array.isArray(data.items.products)) {
      products = data.items.products;
    } else if (Array.isArray(data.products)) {
      products = data.products;
    }

    // Only overwrite if products array has valid entries
    if (products.length > 0 && products.some((p) => p.name || p.id)) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, JSON.stringify({ products }, null, 2));
      console.log(`Catalog saved to ${outputPath} (${products.length} items)`);
    } else {
      console.warn('Firestore catalog is empty or unpopulated. Preserving existing catalog.json.');
    }
  } catch (error) {
    console.error('Error fetching catalog:', error);
    if (fs.existsSync(outputPath)) {
      console.warn('Falling back to existing catalog.json');
      process.exit(0);
    }
    process.exit(1);
  }
}

fetchCatalog();