const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require('../aada-clothing-firebase-adminsdk-fbsvc-a6dfe44895.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

async function fetchCatalog() {
    try {
        console.log('Fetching catalog from Firestore...');
        const docRef = db.collection('store_data').document('catalog');
        const doc = await docRef.get();
        if (!doc.exists) {
            console.error('No catalog found in Firestore.');
            process.exit(1);
        }
        console.log('Catalog fetched successfully.');
        const data =  doc.data();
        const outputPath = path.join(__dirname, 'src', 'data', 'catalog.json');
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, JSON.stringify(data.items, null, 2));
        console.log(`Catalog saved to ${outputPath}`);
    } catch (error) {
        console.error('Error fetching catalog:', error);
        process.exit(1);
    }
}

fetchCatalog();