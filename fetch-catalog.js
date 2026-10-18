const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

const localKeyPath = path.join(__dirname, '..', 'aada-clothing-firebase-adminsdk-fbsvc-a6dfe44895.json');
const outputPath = path.join(__dirname, 'src', 'data', 'catalog.json');

let serviceAccount = null;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (e) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable:', e);
  }
} else if (fs.existsSync(localKeyPath)) {
  try {
    serviceAccount = require(localKeyPath);
  } catch (e) {
    console.error('Failed to load local service account file:', e);
  }
}

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
      console.error('No catalog found in Firestore.');
      if (fs.existsSync(outputPath)) {
        console.warn('Falling back to existing catalog.json');
        process.exit(0);
      }
      process.exit(1);
    }
    console.log('Catalog fetched successfully.');
    const data = doc.data();
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(data.items, null, 2));
    console.log(`Catalog saved to ${outputPath}`);
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