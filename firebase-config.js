const firebaseConfig = {
    apiKey: "AIzaSyAfki4eW87D4LJVNvcUveJ5mjTxWPzmfpc",
    authDomain: "ers-backend.firebaseapp.com",
    projectId: "ers-backend",
    storageBucket: "ers-backend.firebasestorage.app",
    messagingSenderId: "804667906511",
    appId: "1:804667906511:web:9e3d0ca2132b076c1f5aba"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Shortcuts
const auth = firebase.auth();
const db = firebase.firestore();
