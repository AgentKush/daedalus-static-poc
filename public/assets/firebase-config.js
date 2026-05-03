// Firebase Web SDK config — public-safe by design (security comes from Firestore rules).
//
// To switch this static site from bundled mock JSON to live Firestore reads:
//   1. Open https://console.firebase.google.com/project/<your-project-id>/settings/general
//   2. Scroll to "Your apps" → web app → copy the firebaseConfig object
//   3. Paste it below replacing the empty default
//   4. Update Firestore Security Rules to allow public reads on the
//      `mods`, `tools`, `nexus_mods`, and `info_content` collections — see README.
//
// Until step 3 is done, the site falls back to bundled JSON in /data/.
window.FIREBASE_CONFIG = null;

// Example (DO NOT commit a real one — just uncomment the structure):
// window.FIREBASE_CONFIG = {
//   apiKey: "AIzaSy...",
//   authDomain: "project-daedalus.firebaseapp.com",
//   projectId: "project-daedalus",
//   storageBucket: "project-daedalus.appspot.com",
//   messagingSenderId: "1234567890",
//   appId: "1:1234567890:web:abc123"
// };
