// One-off seeding script — run locally with:
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json node scripts/seed-firestore.js
// (serviceAccountKey.json is the private key downloaded from
//  Firebase console > Project settings > Service accounts > Generate new private key)

const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

const rooms = [
  { id: 'LAB-A', name: 'LAB-A', description: 'ห้องปฏิบัติการเคมี' },
  { id: 'LAB-B', name: 'LAB-B', description: 'ห้องปฏิบัติการชีวะ' },
];

const chemicals = [
  { id: 'ethanol', name: 'Ethanol', unit: 'mL', current_stock: 5000, min_threshold: 1000 },
  { id: 'methanol', name: 'Methanol', unit: 'mL', current_stock: 3000, min_threshold: 800 },
  { id: 'hcl', name: 'HCl', unit: 'mL', current_stock: 2000, min_threshold: 500 },
  { id: 'naoh', name: 'NaOH', unit: 'g', current_stock: 2500, min_threshold: 500 },
  { id: 'h2so4', name: 'H2SO4', unit: 'mL', current_stock: 1500, min_threshold: 400 },
  { id: 'acetone', name: 'Acetone', unit: 'mL', current_stock: 4000, min_threshold: 800 },
  { id: 'nacl', name: 'NaCl', unit: 'g', current_stock: 5000, min_threshold: 1000 },
  { id: 'glucose', name: 'Glucose', unit: 'g', current_stock: 3000, min_threshold: 600 },
  { id: 'agar', name: 'Agar', unit: 'g', current_stock: 1000, min_threshold: 200 },
  { id: 'distilled_water', name: 'Distilled Water', unit: 'mL', current_stock: 20000, min_threshold: 3000 },
];

async function seed() {
  const batch = db.batch();

  for (const { id, ...data } of rooms) {
    batch.set(db.collection('rooms').doc(id), data);
  }
  for (const { id, ...data } of chemicals) {
    batch.set(db.collection('chemical_inventory').doc(id), data);
  }

  await batch.commit();
  console.log(`Seeded ${rooms.length} rooms and ${chemicals.length} chemicals.`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
