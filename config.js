// ============================
// The Cork - Configuration
// ============================

const CONFIG = {
    // ============================
    // Firebase Configuration
    // ============================
    FIREBASE: {
        apiKey: "AIzaSyBkWeQuul7Qmm6Z3YxWoVeORcceqjaZiTM",
        authDomain: "thecork.corkapps.com",
        databaseURL: "https://the-cork-v2-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "the-cork-v2",
        storageBucket: "the-cork-v2.firebasestorage.app",
        messagingSenderId: "232100497970",
        appId: "1:232100497970:web:d0db58efb539e7abfc8a2b"
    },

    // ============================
    // Cloud Functions URLs
    // ============================
    FUNCTIONS: {
        quickAnalyzeWineLabel: "https://us-central1-the-cork-v2.cloudfunctions.net/quickAnalyzeWineLabel",
        analyzeWineLabel: "https://us-central1-the-cork-v2.cloudfunctions.net/analyzeWineLabel",
        lookupWinePrice: "https://us-central1-the-cork-v2.cloudfunctions.net/lookupWinePrice",
        searchWineImage: "https://us-central1-the-cork-v2.cloudfunctions.net/searchWineImage",
        deepAnalyzeWineLabel: "https://us-central1-the-cork-v2.cloudfunctions.net/deepAnalyzeWineLabel",
        health: "https://us-central1-the-cork-v2.cloudfunctions.net/health"
    }
};
