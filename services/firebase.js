const admin = require('firebase-admin');
const path = require('path');

// Load your service account key from a secure path
const serviceAccount = require(path.resolve(__dirname, '../firebaseServiceAccountKey.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const fieldValue = admin.firestore.FieldValue;


module.exports = { admin, db, fieldValue };
