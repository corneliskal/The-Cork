// ============================
// The Cork - Wine Cellar App
// With ChatGPT Vision API Integration
// And Firebase Cloud Sync
// ============================

// ============================
// SwipeHandler - iOS-style swipe gestures
// ============================

class SwipeHandler {
    constructor(options) {
        this.container = options.container;
        this.onAction = options.onAction;
        this.actionWidth = options.actionWidth || 80;
        this.fullSwipeThreshold = 0.45; // 45% of width for full swipe
        this.velocityThreshold = 0.5; // pixels per ms

        this.currentOpenItem = null;
        this.activeItem = null;
        this.startX = 0;
        this.startY = 0;
        this.currentX = 0;
        this.startTime = 0;
        this.isScrolling = null; // null = undetermined, true = vertical scroll, false = horizontal swipe

        this.bindEvents();
    }

    bindEvents() {
        // Use event delegation on the container
        this.container.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
        this.container.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.container.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: true });

        // Close open item when clicking elsewhere
        document.addEventListener('touchstart', (e) => {
            if (this.currentOpenItem && !this.container.contains(e.target)) {
                this.closeCurrentItem();
            }
        }, { passive: true });
    }

    handleTouchStart(e) {
        const swipeContent = e.target.closest('.swipe-content');
        if (!swipeContent) return;

        const swipeContainer = swipeContent.closest('.swipe-container');
        if (!swipeContainer) return;

        // Close any other open item
        if (this.currentOpenItem && this.currentOpenItem !== swipeContainer) {
            this.closeCurrentItem();
        }

        this.activeItem = swipeContainer;
        this.startX = e.touches[0].clientX;
        this.startY = e.touches[0].clientY;
        this.currentX = 0;
        this.startTime = Date.now();
        this.isScrolling = null;

        // Remove transition during drag
        swipeContent.classList.remove('swipe-transitioning');
        this.activeItem.classList.add('swiping');
    }

    handleTouchMove(e) {
        if (!this.activeItem) return;

        const swipeContent = this.activeItem.querySelector('.swipe-content');
        if (!swipeContent) return;

        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;
        const deltaX = touchX - this.startX;
        const deltaY = touchY - this.startY;

        // Determine scroll vs swipe on first significant movement
        if (this.isScrolling === null) {
            if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
                this.isScrolling = Math.abs(deltaY) > Math.abs(deltaX);
            }
        }

        // If vertical scrolling, don't interfere
        if (this.isScrolling === true) {
            this.activeItem = null;
            return;
        }

        // Horizontal swipe - prevent page scroll
        if (this.isScrolling === false) {
            e.preventDefault();
        }

        // Calculate how far to move (only allow left swipe)
        let translateX = deltaX;

        // Check if item was already open
        if (this.currentOpenItem === this.activeItem) {
            translateX = deltaX - this.actionWidth;
        }

        // Limit swipe to left only, with resistance past action width
        if (translateX > 0) {
            translateX = 0;
        } else if (translateX < -this.activeItem.offsetWidth * 0.7) {
            // Add resistance past 70%
            const overflow = Math.abs(translateX) - this.activeItem.offsetWidth * 0.7;
            translateX = -(this.activeItem.offsetWidth * 0.7 + overflow * 0.2);
        }

        this.currentX = translateX;
        swipeContent.style.transform = `translateX(${translateX}px)`;
    }

    handleTouchEnd(e) {
        if (!this.activeItem) return;

        const swipeContent = this.activeItem.querySelector('.swipe-content');
        if (!swipeContent) return;

        this.activeItem.classList.remove('swiping');
        swipeContent.classList.add('swipe-transitioning');

        const itemWidth = this.activeItem.offsetWidth;
        const velocity = Math.abs(this.currentX) / (Date.now() - this.startTime);
        const movedPastThreshold = Math.abs(this.currentX) > itemWidth * this.fullSwipeThreshold;
        const fastSwipe = velocity > this.velocityThreshold && Math.abs(this.currentX) > 50;

        if (movedPastThreshold || fastSwipe) {
            // Full swipe - trigger action
            this.triggerAction(this.activeItem);
        } else if (Math.abs(this.currentX) > this.actionWidth * 0.5) {
            // Partial swipe - snap open to show action
            swipeContent.style.transform = `translateX(-${this.actionWidth}px)`;
            this.currentOpenItem = this.activeItem;
        } else {
            // Snap back closed
            swipeContent.style.transform = 'translateX(0)';
            if (this.currentOpenItem === this.activeItem) {
                this.currentOpenItem = null;
            }
        }

        this.activeItem = null;
    }

    triggerAction(item) {
        const swipeContent = item.querySelector('.swipe-content');
        const itemWidth = item.offsetWidth;

        // Slide out completely
        swipeContent.style.transform = `translateX(-${itemWidth}px)`;

        // Collapse the row
        setTimeout(() => {
            item.classList.add('swipe-collapsing');
            item.style.maxHeight = item.offsetHeight + 'px';

            // Force reflow
            item.offsetHeight;

            item.style.maxHeight = '0';

            // Get the ID and trigger callback
            const id = item.dataset.id;

            setTimeout(() => {
                if (this.onAction && id) {
                    this.onAction(id);
                }
            }, 300);
        }, 200);

        if (this.currentOpenItem === item) {
            this.currentOpenItem = null;
        }
    }

    closeCurrentItem() {
        if (!this.currentOpenItem) return;

        const swipeContent = this.currentOpenItem.querySelector('.swipe-content');
        if (swipeContent) {
            swipeContent.classList.add('swipe-transitioning');
            swipeContent.style.transform = 'translateX(0)';
        }
        this.currentOpenItem = null;
    }

    // Handle click on action button
    handleActionClick(item) {
        const id = item.dataset.id;
        if (this.onAction && id) {
            this.triggerAction(item);
        }
    }

    destroy() {
        // Clean up if needed
        this.container = null;
        this.onAction = null;
    }
}

class WineCellar {
    constructor() {
        this.wines = [];
        this.filteredWines = [];
        this.archive = [];
        this.filteredArchive = [];
        this.wishlist = [];
        this.addDestination = null; // 'cellar' or 'wishlist'
        this.currentWineId = null;
        this.currentArchiveId = null;
        this.editMode = false;
        this.currentImage = null;
        this.searchQuery = '';
        this.archiveSearchQuery = '';
        // Archive modal state
        this.archiveRating = 0;
        this.archiveRebuy = null;

        // Background processing: wineId → { priceLoading, imageLoading }
        this.backgroundProcessing = new Map();

        // Sort and filter state
        this.sortBy = 'recent'; // 'recent', 'drinkability', 'price_asc', 'price_desc'
        this.typeFilter = 'all';
        this.drinkabilityFilter = 'all';
        this.grapeFilter = 'all';

        // Firebase
        this.db = null;
        this.userId = null;
        this.firebaseEnabled = false;
        this.syncInProgress = false;

        // Cloud Functions status
        this.cloudFunctionsAvailable = false;

        this.init();
    }

    async init() {
        this.bindEvents();

        // Initialize Firebase - user must be logged in to use app
        await this.initFirebase();

        // Check Cloud Functions availability
        await this.checkCloudFunctions();
    }

    // Check if Cloud Functions are available
    async checkCloudFunctions() {
        if (!CONFIG.FUNCTIONS?.health) {
            console.log('Cloud Functions not configured');
            return;
        }

        try {
            const response = await fetch(CONFIG.FUNCTIONS.health);
            const data = await response.json();
            this.cloudFunctionsAvailable = data.status === 'ok' && (data.geminiConfigured || data.openaiConfigured);
            console.log('Cloud Functions status:', data);
        } catch (error) {
            console.log('Cloud Functions not available:', error.message);
            this.cloudFunctionsAvailable = false;
        }
    }

    get isAdmin() {
        const adminUids = ['9lcsHu9NN3clMBqzCqkQ3PrNdqQ2', 'FMDaB2kzg4fSyWiBwLxrFFl2Zjv2']
        return adminUids.includes(this.userId)
    }

    // Get Firebase ID token for API calls
    async getIdToken() {
        const user = firebase.auth().currentUser;
        if (!user) return null;
        return await user.getIdToken();
    }

    // ============================
    // Firebase Integration
    // ============================

    async initFirebase() {
        // Check if Firebase config is available and valid
        if (typeof CONFIG === 'undefined' || !CONFIG.FIREBASE ||
            !CONFIG.FIREBASE.apiKey || CONFIG.FIREBASE.apiKey.includes('YOUR')) {
            console.log('Firebase not configured - app requires login');
            this.updateSyncStatus('local');
            this.showAppContent(false);
            return;
        }

        try {
            // Initialize Firebase
            if (!firebase.apps.length) {
                firebase.initializeApp(CONFIG.FIREBASE);
            }

            this.db = firebase.database();
            this.storage = firebase.storage();
            this.updateSyncStatus('connecting');

            // Listen for auth state changes
            firebase.auth().onAuthStateChanged((user) => {
                if (user) {
                    this.userId = user.uid;
                    this.firebaseEnabled = true;
                    this.setupFirebaseListener();
                    this.updateSyncStatus('synced');
                    this.updateAuthUI(user);
                    this.showAppContent(true);
                    console.log('Signed in as:', user.displayName || 'Anonymous', '- UID:', user.uid);
                } else {
                    this.firebaseEnabled = false;
                    this.userId = null;
                    this.wines = [];
                    this.archive = [];
                    this.updateSyncStatus('disconnected');
                    this.updateAuthUI(null);
                    this.showAppContent(false);
                    this.renderWineList();
                    this.updateStats();
                }
            });

        } catch (error) {
            console.error('Firebase initialization error:', error);
            this.updateSyncStatus('error');
            this.showToast('Cloud sync unavailable - using local storage');
        }
    }

    async signInWithGoogle() {
        try {
            this.updateSyncStatus('connecting');
            const provider = new firebase.auth.GoogleAuthProvider();

            // Always use popup — signInWithRedirect breaks on iOS Safari (ITP blocks cookies)
            const result = await firebase.auth().signInWithPopup(provider);
            this.showToast(`Signed in as ${result.user.displayName}`);
        } catch (error) {
            console.error('Google sign-in error:', error);
            if (error.code !== 'auth/popup-closed-by-user') {
                this.showToast('Sign in failed:' + error.message);
            }
            this.updateSyncStatus('disconnected');
        }
    }

    // Email/Password Authentication
    isRegisterMode = false;

    toggleAuthMode() {
        this.isRegisterMode = !this.isRegisterMode;
        const btn = document.getElementById('emailSignInBtn');
        const toggleBtn = document.getElementById('toggleRegisterBtn');
        const forgotBtn = document.getElementById('forgotPasswordBtn');

        if (this.isRegisterMode) {
            btn.textContent = 'Register';
            toggleBtn.innerHTML = 'Already have an account? <span>Sign in</span>';
            forgotBtn.style.display = 'none';
        } else {
            btn.textContent = 'Sign in';
            toggleBtn.innerHTML = 'Don\'t have an account? <span>Register</span>';
            forgotBtn.style.display = 'block';
        }
    }

    async handleEmailAuth(e) {
        e.preventDefault();

        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            this.showToast('Please enter email and password');
            return;
        }

        this.updateSyncStatus('connecting');

        try {
            if (this.isRegisterMode) {
                // Register new user
                const result = await firebase.auth().createUserWithEmailAndPassword(email, password);
                this.showToast('Account created!');
                console.log('User registered:', result.user.email);
            } else {
                // Sign in existing user
                const result = await firebase.auth().signInWithEmailAndPassword(email, password);
                this.showToast(`Signed in as ${result.user.email}`);
                console.log('User signed in:', result.user.email);
            }
        } catch (error) {
            console.error('Email auth error:', error);
            this.updateSyncStatus('disconnected');

            const errorMessages = {
                'auth/email-already-in-use': 'This email address is already in use',
                'auth/invalid-email': 'Invalid email address',
                'auth/operation-not-allowed': 'Email/password sign in is not enabled',
                'auth/weak-password': 'Password must be at least 6 characters',
                'auth/user-disabled': 'This account has been disabled',
                'auth/user-not-found': 'No account found with this email address',
                'auth/wrong-password': 'Incorrect password',
                'auth/invalid-credential': 'Invalid credentials',
                'auth/too-many-requests': 'Too many attempts. Please try again later'
            };

            const message = errorMessages[error.code] || error.message;
            this.showToast(message);
        }
    }

    async handleForgotPassword() {
        const email = document.getElementById('loginEmail').value.trim();

        if (!email) {
            this.showToast('Please enter your email address first');
            return;
        }

        try {
            await firebase.auth().sendPasswordResetEmail(email);
            this.showToast('Password reset email sent!');
        } catch (error) {
            console.error('Password reset error:', error);

            const errorMessages = {
                'auth/invalid-email': 'Invalid email address',
                'auth/user-not-found': 'No account found with this email address'
            };

            const message = errorMessages[error.code] || error.message;
            this.showToast(message);
        }
    }

    async signOut() {
        try {
            // Detach Firebase listeners before signing out
            if (this.db && this.userId) {
                this.db.ref(`users/${this.userId}/wines`).off();
                this.db.ref(`users/${this.userId}/archive`).off();
                this.db.ref(`users/${this.userId}/wishlist`).off();
            }
            await firebase.auth().signOut();
            this.firebaseEnabled = false;
            this.userId = null;
            this.wines = [];
            this.archive = [];
            this.wishlist = [];
            this.renderWineList();
            this.updateStats();
            this.showToast('Signed out');
            this.updateSyncStatus('disconnected');
            this.showAppContent(false);
        } catch (error) {
            console.error('Sign out error:', error);
        }
    }

    showAppContent(isLoggedIn) {
        const loginScreen = document.getElementById('loginScreen');
        const mainContent = document.querySelector('.main-content');
        const fab = document.getElementById('addWineBtn');
        const filterBar = document.getElementById('filterBar');

        if (isLoggedIn) {
            // Show app content
            if (loginScreen) loginScreen.classList.add('hidden');
            if (mainContent) mainContent.classList.remove('hidden');
            if (fab) fab.classList.remove('hidden');
        } else {
            // Show login screen
            if (loginScreen) loginScreen.classList.remove('hidden');
            if (mainContent) mainContent.classList.add('hidden');
            if (fab) fab.classList.add('hidden');
            if (filterBar) filterBar.classList.add('hidden');
        }
    }

    updateAuthUI(user) {
        const userInfo = document.getElementById('userInfo');
        const signInBtn = document.getElementById('googleSignInBtn');
        const signOutBtn = document.getElementById('signOutBtn');

        if (user && !user.isAnonymous) {
            // User is signed in with Google
            if (userInfo) {
                userInfo.innerHTML = `✓ Signed in as <strong>${user.displayName || user.email}</strong>`;
                userInfo.style.display = 'block';
            }
            if (signInBtn) signInBtn.style.display = 'none';
            if (signOutBtn) signOutBtn.style.display = 'block';
        } else {
            // User is not signed in
            if (userInfo) userInfo.style.display = 'none';
            if (signInBtn) signInBtn.style.display = 'block';
            if (signOutBtn) signOutBtn.style.display = 'none';
        }
    }

    setupFirebaseListener() {
        if (!this.db || !this.userId) return;

        // Detach any existing listeners first
        this.db.ref(`users/${this.userId}/wines`).off();
        this.db.ref(`users/${this.userId}/archive`).off();
        this.db.ref(`users/${this.userId}/wishlist`).off();

        // Wines listener
        const winesRef = this.db.ref(`users/${this.userId}/wines`);
        winesRef.on('value', (snapshot) => {
            console.log('📥 Firebase wines listener triggered. syncInProgress:', this.syncInProgress);

            if (this.syncInProgress) {
                console.log('  ⏸️ Ignoring update (sync in progress)');
                return;
            }

            const data = snapshot.val();
            const firebaseWines = data ? Object.values(data) : [];

            console.log('  📊 Firebase data received:', firebaseWines.length, 'wines');

            // Firebase is the source of truth
            this.wines = firebaseWines;

            // Sort by addedAt date (newest first)
            this.wines.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));

            this.renderWineList();
            this.updateStats();
            this.updateSearchVisibility();

            console.log('  ✅ Wines synced from cloud:', this.wines.length);
        });

        // Archive listener
        const archiveRef = this.db.ref(`users/${this.userId}/archive`);
        archiveRef.on('value', (snapshot) => {
            if (this.syncInProgress) return;

            const data = snapshot.val();
            const firebaseArchive = data ? Object.values(data) : [];

            console.log('📚 Archive synced from cloud:', firebaseArchive.length, 'items');

            this.archive = firebaseArchive;
            this.archive.sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));
        });

        // Wishlist listener
        const wishlistRef = this.db.ref(`users/${this.userId}/wishlist`);
        wishlistRef.on('value', (snapshot) => {
            if (this.syncInProgress) return;

            const data = snapshot.val();
            this.wishlist = data ? Object.values(data) : [];
            this.wishlist.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
            console.log('💝 Wishlist synced from cloud:', this.wishlist.length, 'items');
        });

        // One-time migration of base64 images to Storage (after initial data load)
        archiveRef.once('value', () => {
            setTimeout(() => this.migrateImagesToStorage(), 2000);
        });
    }

    async pushWineToFirebase(wine) {
        if (!this.firebaseEnabled || !this.db || !this.userId) return;

        try {
            await this.db.ref(`users/${this.userId}/wines/${wine.id}`).set(wine);
        } catch (error) {
            console.error('Error pushing wine to Firebase:', error);
        }
    }

    async deleteWineFromFirebase(wineId) {
        if (!this.firebaseEnabled || !this.db || !this.userId) {
            console.log('❌ Cannot delete from Firebase - not enabled or no user');
            console.log('  firebaseEnabled:', this.firebaseEnabled);
            console.log('  db:', !!this.db);
            console.log('  userId:', this.userId);
            return false;
        }

        try {
            const path = `users/${this.userId}/wines/${wineId}`;
            console.log('🗑️ Deleting wine from Firebase...');
            console.log('  Wine ID:', wineId);
            console.log('  Full path:', path);

            // First check if the wine exists in Firebase
            const snapshot = await this.db.ref(path).once('value');
            console.log('  Wine exists in Firebase:', snapshot.exists());

            if (snapshot.exists()) {
                await this.db.ref(path).remove();
                console.log('✅ Wine deleted from Firebase successfully');

                // Verify the delete worked
                const verifySnapshot = await this.db.ref(path).once('value');
                console.log('  Verified deleted:', !verifySnapshot.exists());
                return true;
            } else {
                console.log('⚠️ Wine was not found in Firebase - may already be deleted');
                return true;
            }
        } catch (error) {
            console.error('❌ Error deleting wine from Firebase:', error);
            return false;
        }
    }

    async saveWinesToFirebase() {
        if (!this.firebaseEnabled || !this.db || !this.userId) return;

        this.syncInProgress = true;
        this.updateSyncStatus('syncing');

        try {
            // Convert array to object with wine IDs as keys
            const winesObject = {};
            this.wines.forEach(wine => {
                winesObject[wine.id] = wine;
            });

            await this.db.ref(`users/${this.userId}/wines`).set(winesObject);

            this.updateSyncStatus('synced');
            console.log('Wines saved to cloud');
        } catch (error) {
            console.error('Error saving to Firebase:', error);
            this.updateSyncStatus('error');
            this.showToast('Sync error - saved locally');
        } finally {
            this.syncInProgress = false;
        }
    }

    updateSyncStatus(status) {
        const statusEl = document.getElementById('syncStatus');
        const settingsStatusEl = document.getElementById('firebaseSyncStatus');

        const cloudSvg = `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>`;
        const cloudOffSvg = `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M19.35 10.04A7.49 7.49 0 0 0 12 4c-1.48 0-2.85.43-4.01 1.17l1.46 1.46A5.47 5.47 0 0 1 12 6a5.5 5.5 0 0 1 5.5 5.5v.5H19a3 3 0 0 1 3 3c0 1.13-.64 2.11-1.56 2.62l1.45 1.45C23.16 18.16 24 16.68 24 15c0-2.64-2.05-4.78-4.65-4.96zM3 5.27l2.75 2.74C2.56 8.15 0 10.77 0 14c0 3.31 2.69 6 6 6h11.73l2 2 1.27-1.27L4.27 4 3 5.27zM7.73 10l8 8H6c-2.21 0-4-1.79-4-4s1.79-4 4-4h1.73z"/></svg>`;

        const statusMap = {
            'local': { icon: cloudOffSvg, class: 'status-local', settingsText: 'Not configured - Data is stored locally only' },
            'connecting': { icon: cloudSvg, class: 'status-connecting', settingsText: 'Connecting to cloud...' },
            'synced': { icon: cloudSvg, class: 'status-synced', settingsText: '✓ Connected - Your wines are synced automatically' },
            'syncing': { icon: cloudSvg, class: 'status-syncing', settingsText: 'Syncing...' },
            'error': { icon: cloudOffSvg, class: 'status-error', settingsText: '⚠️ Sync error - Please try again later' },
            'disconnected': { icon: cloudOffSvg, class: 'status-disconnected', settingsText: 'Offline - Data is stored locally' }
        };

        const s = statusMap[status] || statusMap['local'];

        if (statusEl) {
            statusEl.className = `sync-icon ${s.class}`;
            statusEl.innerHTML = s.icon;
        }

        if (settingsStatusEl) {
            const statusClass = status === 'synced' ? 'status-connected' : 'status-disconnected';
            settingsStatusEl.innerHTML = `<span class="${statusClass}">${s.settingsText}</span>`;
        }
    }

    // ============================
    // Wine Storage (Firebase only)
    // ============================

    saveWines() {
        if (this.firebaseEnabled) {
            this.saveWinesToFirebase();
        }
    }

    // ============================
    // Archive Storage (Firebase only)
    // ============================

    async pushToArchive(archivedWine) {
        this.archive.unshift(archivedWine);

        if (this.firebaseEnabled && this.db && this.userId) {
            try {
                await this.db.ref(`users/${this.userId}/archive/${archivedWine.id}`).set(archivedWine);
            } catch (error) {
                console.error('Error pushing to archive in Firebase:', error);
            }
        }
    }

    async deleteFromArchive(archiveId) {
        this.archive = this.archive.filter(w => w.id !== archiveId);

        if (this.firebaseEnabled && this.db && this.userId) {
            try {
                await this.db.ref(`users/${this.userId}/archive/${archiveId}`).remove();
            } catch (error) {
                console.error('Error deleting from archive in Firebase:', error);
            }
        }
    }


    // ============================
    // Firebase Storage (Images)
    // ============================

    animateImageTransition(wineId, newImageUrl) {
        const container = document.querySelector(`.swipe-container[data-id="${wineId}"] .wine-card-image`)
        if (!container) return

        const oldImg = container.querySelector('img')
        if (!oldImg) return

        const newImg = document.createElement('img')
        newImg.className = 'image-transition-overlay'
        newImg.alt = oldImg.alt

        newImg.onload = () => {
            container.appendChild(newImg)
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    newImg.classList.add('visible')
                })
            })
            setTimeout(() => {
                if (oldImg.parentNode) oldImg.remove()
                newImg.classList.remove('image-transition-overlay', 'visible')
            }, 800)
        }

        newImg.src = newImageUrl
    }

    async uploadImageToStorage(imageId, base64Data, folder = 'wines') {
        if (!this.storage || !this.userId) return null;

        try {
            // Convert base64 data URL to Blob
            const response = await fetch(base64Data);
            const blob = await response.blob();

            const ref = this.storage.ref(`users/${this.userId}/${folder}/${imageId}.jpg`);
            await ref.put(blob, { contentType: 'image/jpeg' });
            const url = await ref.getDownloadURL();
            return url;
        } catch (error) {
            console.error('Error uploading image to Storage:', error);
            return null;
        }
    }

    async deleteImageFromStorage(imageId, folder = 'wines') {
        if (!this.storage || !this.userId) return;

        try {
            const ref = this.storage.ref(`users/${this.userId}/${folder}/${imageId}.jpg`);
            await ref.delete();
        } catch (error) {
            // Ignore "object not found" errors
            if (error.code !== 'storage/object-not-found') {
                console.error('Error deleting image from Storage:', error);
            }
        }
    }

    isBase64Image(str) {
        return str && typeof str === 'string' && str.startsWith('data:');
    }

    async migrateImagesToStorage() {
        if (!this.storage || !this.userId) return;

        try {
            // Check if already migrated
            const flagRef = this.db.ref(`users/${this.userId}/imagesMigrated`);
            const flagSnap = await flagRef.once('value');
            if (flagSnap.val() === true) return;

            // Collect all items with base64 images
            const toMigrate = [];
            this.wines.forEach(w => {
                if (this.isBase64Image(w.image)) toMigrate.push({ item: w, type: 'wines' });
            });
            this.archive.forEach(w => {
                if (this.isBase64Image(w.image)) toMigrate.push({ item: w, type: 'archive' });
            });

            if (toMigrate.length === 0) {
                await flagRef.set(true);
                return;
            }

            console.log(`🔄 Migrating ${toMigrate.length} images to Storage...`);
            this.showToast(`Migrating ${toMigrate.length} images...`);

            let done = 0;
            for (const { item, type } of toMigrate) {
                const url = await this.uploadImageToStorage(item.id, item.image, type);
                if (url) {
                    item.image = url;
                    // Update in Firebase immediately
                    await this.db.ref(`users/${this.userId}/${type}/${item.id}/image`).set(url);
                }
                done++;
                if (done % 5 === 0) {
                    this.showToast(`Migrating images... (${done}/${toMigrate.length})`);
                }
            }

            await flagRef.set(true);
            console.log('✅ Image migration complete');
            this.showToast('Image migration complete!');
        } catch (error) {
            console.error('Error migrating images:', error);
        }
    }

    // ============================
    // Event Binding
    // ============================

    bindEvents() {
        // Settings button
        document.getElementById('settingsBtn')?.addEventListener('click', () => this.openModal('settingsModal'));

        // Search functionality
        const searchInput = document.getElementById('searchInput');
        const clearSearchBtn = document.getElementById('clearSearch');

        searchInput?.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.trim().toLowerCase();
            this.handleSearch();
        });

        clearSearchBtn?.addEventListener('click', () => {
            searchInput.value = '';
            this.searchQuery = '';
            this.handleSearch();
            searchInput.focus();
        });

        // Filter button and dropdown
        document.getElementById('filterBtn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const filterDropdown = document.getElementById('filterDropdown');
            const sortDropdown = document.getElementById('sortDropdown');
            sortDropdown?.classList.add('hidden');
            document.getElementById('sortBtn')?.classList.remove('active');
            filterDropdown?.classList.toggle('hidden');
            e.currentTarget.classList.toggle('active');
        });

        // Sort button and dropdown
        document.getElementById('sortBtn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const sortDropdown = document.getElementById('sortDropdown');
            const filterDropdown = document.getElementById('filterDropdown');
            filterDropdown?.classList.add('hidden');
            document.getElementById('filterBtn')?.classList.remove('active');
            sortDropdown?.classList.toggle('hidden');
            e.currentTarget.classList.toggle('active');
        });

        // Sort options
        document.querySelectorAll('#sortDropdown .control-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const sortValue = e.currentTarget.dataset.sort;
                this.sortBy = sortValue;

                // Update active state
                document.querySelectorAll('#sortDropdown .control-option').forEach(opt => opt.classList.remove('active'));
                e.currentTarget.classList.add('active');

                // Close dropdown and re-render
                document.getElementById('sortDropdown')?.classList.add('hidden');
                document.getElementById('sortBtn')?.classList.remove('active');
                this.sortAndRenderWines();
            });
        });

        // Filter options (event delegation for dynamic grape options)
        document.getElementById('filterDropdown')?.addEventListener('click', (e) => {
            const option = e.target.closest('.control-option');
            if (!option) return;

            const filterType = option.dataset.filter;
            const filterValue = option.dataset.value;

            if (filterType === 'type') {
                this.typeFilter = filterValue;
                document.querySelectorAll('[data-filter="type"]').forEach(opt => opt.classList.remove('active'));
            } else if (filterType === 'drinkability') {
                this.drinkabilityFilter = filterValue;
                document.querySelectorAll('[data-filter="drinkability"]').forEach(opt => opt.classList.remove('active'));
            } else if (filterType === 'grape') {
                this.grapeFilter = filterValue;
                document.querySelectorAll('[data-filter="grape"]').forEach(opt => opt.classList.remove('active'));
            }

            option.classList.add('active');

            // Re-render with filters
            this.renderWineList();
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            const sortDropdown = document.getElementById('sortDropdown');
            const filterDropdown = document.getElementById('filterDropdown');
            const sortBtn = document.getElementById('sortBtn');
            const filterBtn = document.getElementById('filterBtn');

            if (sortDropdown && !sortDropdown.classList.contains('hidden') &&
                !sortDropdown.contains(e.target) && !sortBtn?.contains(e.target)) {
                sortDropdown.classList.add('hidden');
                sortBtn?.classList.remove('active');
            }

            if (filterDropdown && !filterDropdown.classList.contains('hidden') &&
                !filterDropdown.contains(e.target) && !filterBtn?.contains(e.target)) {
                filterDropdown.classList.add('hidden');
                filterBtn?.classList.remove('active');
            }
        });

        // FAB button
        document.getElementById('addWineBtn')?.addEventListener('click', () => this.openAddModal());

        // Close buttons
        document.querySelectorAll('[data-close]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalId = e.currentTarget.dataset.close;
                this.closeModal(modalId);
            });
        });

        // Modal backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });

        // Destination tiles (add wine flow)
        document.querySelectorAll('.destination-tile').forEach(tile => {
            tile.addEventListener('click', () => {
                this.addDestination = tile.dataset.destination;
                document.getElementById('addPhotoInput')?.click();
            });
        });

        // Photo input for add flow
        document.getElementById('addPhotoInput')?.addEventListener('change', (e) => this.handleImageUpload(e));

        // Edit mode: image preview click + photo input
        document.getElementById('imagePreview')?.addEventListener('click', () => {
            document.getElementById('editPhotoInput')?.click();
        });
        document.getElementById('editPhotoInput')?.addEventListener('change', (e) => this.handleEditImageUpload(e));

        // Wishlist header button
        document.getElementById('wishlistBtn')?.addEventListener('click', () => this.openWishlistModal());

        // Wishlist detail actions
        document.getElementById('moveWishlistToCellarBtn')?.addEventListener('click', () => this.moveWishlistToCellar());
        document.getElementById('deleteWishlistBtn')?.addEventListener('click', () => this.deleteFromWishlistConfirm());

        // Form submission
        document.getElementById('wineForm')?.addEventListener('submit', (e) => this.handleFormSubmit(e));

        // Characteristic sliders
        ['boldness', 'tannins', 'acidity'].forEach(id => {
            const slider = document.getElementById(id);
            const value = document.getElementById(`${id}Value`);
            slider?.addEventListener('input', () => {
                if (value) value.textContent = slider.value;
            });
        });

        // Quantity controls in form
        document.querySelectorAll('.quantity-control .qty-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = document.getElementById('wineQuantity');
                const action = btn.dataset.action;
                let val = parseInt(input.value) || 1;
                if (action === 'increase') val++;
                if (action === 'decrease' && val > 1) val--;
                input.value = val;
            });
        });

        // Detail modal quantity controls
        document.getElementById('detailIncrease')?.addEventListener('click', () => this.updateDetailQuantity(1));
        document.getElementById('detailDecrease')?.addEventListener('click', () => this.updateDetailQuantity(-1));

        // Store popup modal
        document.getElementById('storeModalChips').addEventListener('click', (e) => {
            const chip = e.target.closest('.store-chip')
            if (!chip) return
            this.saveStoreFromModal(chip.dataset.store)
        })
        document.getElementById('storeModalSave').addEventListener('click', () => {
            this.saveStoreFromModal(document.getElementById('storeModalInput').value.trim())
        })
        document.getElementById('storeModalInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.saveStoreFromModal(e.target.value.trim())
        })
        document.getElementById('storeModalDiscard').addEventListener('click', () => {
            this.dismissStorePrompt()
        })
        // Detail modal - store edit button opens popup
        document.getElementById('detailStoreEditBtn').addEventListener('click', () => {
            this.promptForStore(true)
        })

        // Detail modal actions
        document.getElementById('editWineBtn')?.addEventListener('click', () => this.editCurrentWine());
        document.getElementById('deleteWineBtn')?.addEventListener('click', () => this.openDeleteModal());

        // Google Sign-In / Sign-Out buttons
        document.getElementById('googleSignInBtn')?.addEventListener('click', () => this.signInWithGoogle());
        document.getElementById('loginGoogleBtn')?.addEventListener('click', () => this.signInWithGoogle());
        document.getElementById('signOutBtn')?.addEventListener('click', () => this.signOut());

        // Email/Password Authentication
        document.getElementById('emailAuthForm')?.addEventListener('submit', (e) => this.handleEmailAuth(e));
        document.getElementById('toggleRegisterBtn')?.addEventListener('click', () => this.toggleAuthMode());
        document.getElementById('forgotPasswordBtn')?.addEventListener('click', () => this.handleForgotPassword());

        // Archive button
        document.getElementById('archiveBtn')?.addEventListener('click', () => this.openArchiveList());

        // Detail modal - Rating slider
        document.getElementById('detailRatingInput').addEventListener('input', (e) => {
            this.updateRatingSlider('detail', parseFloat(e.target.value))
        })
        document.getElementById('detailRatingInput').addEventListener('change', (e) => {
            const rating = parseFloat(e.target.value)
            this.updateRatingSlider('detail', rating)
            const wine = this.wines.find(w => w.id === this.currentWineId)
            if (wine) {
                wine.rating = rating || null
                this.saveWines()
                this.renderWineList()
            }
        })

        // Archive modal - Rating slider
        document.getElementById('archiveRatingInput').addEventListener('input', (e) => {
            this.archiveRating = parseFloat(e.target.value)
            this.updateRatingSlider('archive', this.archiveRating)
        });

        // Archive modal - Rebuy options
        document.querySelectorAll('#rebuyOptions .rebuy-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setRebuyOption(btn.dataset.rebuy));
        });

        // Archive modal - Actions
        const skipArchiveBtn = document.getElementById('skipArchive');
        const confirmArchiveBtn = document.getElementById('confirmArchive');

        console.log('Archive buttons found:', { skipArchive: !!skipArchiveBtn, confirmArchive: !!confirmArchiveBtn });

        if (skipArchiveBtn) {
            skipArchiveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Skip archive clicked');
                this.skipArchiveAndDelete();
            });
        }

        if (confirmArchiveBtn) {
            confirmArchiveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Confirm archive clicked');
                this.confirmArchive();
            });
        }

        // Archive list - Search
        const archiveSearchInput = document.getElementById('archiveSearchInput');
        const clearArchiveSearchBtn = document.getElementById('clearArchiveSearch');

        archiveSearchInput?.addEventListener('input', (e) => {
            this.archiveSearchQuery = e.target.value.trim().toLowerCase();
            this.filterAndRenderArchive();
        });

        clearArchiveSearchBtn?.addEventListener('click', () => {
            archiveSearchInput.value = '';
            this.archiveSearchQuery = '';
            this.filterAndRenderArchive();
        });

        // Archive list - Filters
        document.getElementById('archiveTypeFilter')?.addEventListener('change', () => this.filterAndRenderArchive());
        document.getElementById('archiveRebuyFilter')?.addEventListener('change', () => this.filterAndRenderArchive());

        // Archive detail - Actions
        document.getElementById('restoreWineBtn')?.addEventListener('click', () => this.restoreWineFromArchive());
        document.getElementById('deleteArchiveBtn')?.addEventListener('click', () => this.deleteFromArchiveConfirm());
    }

    // ============================
    // Modal Management
    // ============================

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Scroll modal content to top
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.scrollTop = 0;
        }
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
        document.body.style.overflow = '';

        if (modalId === 'addModal') {
            this.resetForm();
            this.addDestination = null;
        }
    }

    openAddModal() {
        this.editMode = false;
        this.currentWineId = null;
        this.addDestination = null;
        this.resetForm();
        document.getElementById('addModalTitle').textContent = 'Add Wine';
        // Show destination tiles, hide edit form
        document.getElementById('addDestinationStep')?.classList.remove('hidden');
        document.getElementById('addStepEdit')?.classList.add('hidden');
        this.openModal('addModal');
    }

    resetForm() {
        document.getElementById('wineForm').reset();
        document.getElementById('imagePreview').classList.remove('has-image');
        document.getElementById('previewImg').src = '';
        this.currentImage = null;

        ['boldness', 'tannins', 'acidity'].forEach(id => {
            document.getElementById(id).value = 3;
            document.getElementById(`${id}Value`).textContent = '3';
        });

        document.getElementById('wineQuantity').value = 1;
        document.getElementById('drinkFrom').value = '';
        document.getElementById('drinkUntil').value = '';
        document.getElementById('scanningIndicator').classList.add('hidden');
    }

    // ============================
    // Image Handling & AI Analysis
    // ============================

    handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Hide tiles, show scanning indicator
        document.getElementById('addDestinationStep')?.classList.add('hidden');

        this.compressImage(file, (compressedImageData) => {
            this.currentImage = compressedImageData;
            this.analyzeWineLabel(compressedImageData);
        });

        e.target.value = '';
    }

    handleEditImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        this.compressImage(file, (compressedImageData) => {
            this.currentImage = compressedImageData;
            document.getElementById('previewImg').src = compressedImageData;
            document.getElementById('imagePreview').classList.add('has-image');
        });

        e.target.value = '';
    }

    compressImage(file, callback) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxSize = 800; // Max width/height
                let { width, height } = img;

                // Resize if needed
                if (width > maxSize || height > maxSize) {
                    if (width > height) {
                        height = (height / width) * maxSize;
                        width = maxSize;
                    } else {
                        width = (width / height) * maxSize;
                        height = maxSize;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Compress to JPEG with 0.7 quality
                const compressedData = canvas.toDataURL('image/jpeg', 0.7);
                callback(compressedData);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    async analyzeWineLabel(imageData) {
        const indicator = document.getElementById('scanningIndicator');
        const indicatorText = indicator.querySelector('p');

        indicator.classList.remove('hidden');

        // Check if Cloud Functions are available
        if (!this.cloudFunctionsAvailable) {
            indicatorText.textContent = 'AI not available - demo mode...';
            setTimeout(() => {
                indicator.classList.add('hidden');
                const wineData = this.generateDemoWineData();
                this.populateForm(wineData);
                this.showToast('Demo mode: Cloud Functions not configured yet');
            }, 1500);
            return;
        }

        indicatorText.textContent = 'Analyzing wine label...';

        try {
            const quickResult = await this.callChatGPTVision(imageData);
            const wineData = quickResult.data;
            const quickScanLog = quickResult._log;

            // Consistente naamgeving: vergelijk met bestaande wijnen in kelder
            const existingWine = this.matchExistingWine(wineData);
            if (existingWine) {
                wineData.name = existingWine.name;
                wineData.producer = existingWine.producer;
                console.log('🔄 Naam overgenomen van bestaande wijn:', existingWine.name, existingWine.producer);
            }

            // Auto-save: sla wijn direct op en sluit modal
            indicator.classList.add('hidden');

            const enrichId = Date.now().toString();
            const chars = wineData.characteristics || {};
            const estWindow = wineData.year ? this.estimateDrinkWindow(wineData) : {};
            // Build drinkingWindow from new format, old format, or local estimate
            let drinkingWindow = null;
            let drinkFrom = null;
            let drinkUntil = null;
            if (wineData.drinking_window) {
                drinkingWindow = wineData.drinking_window;
                drinkFrom = drinkingWindow.bestFrom;
                drinkUntil = drinkingWindow.bestUntil;
            } else if (wineData.drinkFrom) {
                drinkFrom = wineData.drinkFrom;
                drinkUntil = wineData.drinkUntil;
                drinkingWindow = this.mapLegacyDrinkWindow(drinkFrom, drinkUntil);
            } else if (estWindow.from) {
                drinkFrom = estWindow.from;
                drinkUntil = estWindow.until;
                drinkingWindow = this.mapLegacyDrinkWindow(drinkFrom, drinkUntil);
            }
            const savedWine = {
                id: enrichId,
                enrichId: enrichId,
                name: wineData.name || 'Unknown wine',
                producer: wineData.producer || null,
                type: wineData.type || 'red',
                year: wineData.year || null,
                region: wineData.region || null,
                grape: wineData.grape || null,
                boldness: chars.boldness || 3,
                tannins: chars.tannins || 3,
                acidity: chars.acidity || 3,
                price: null,
                quantity: 1,
                store: null,
                drinkFrom: drinkFrom,
                drinkUntil: drinkUntil,
                drinkingWindow: drinkingWindow,
                notes: wineData.notes || null,
                image: this.currentImage,
                addedAt: new Date().toISOString()
            };

            if (this.addDestination === 'wishlist') {
                this.wishlist.unshift(savedWine);
                this.saveWishlist();
                this.closeModal('addModal');
                this.showToast('Wine added to wishlist!');
            } else {
                this.wines.unshift(savedWine);
                this.saveWines();
                this.renderWineList();
                this.updateStats();
                this.closeModal('addModal');
                this.showToast('Wine recognized and saved!');
            }

            // Start prijs + foto ophalen op de achtergrond
            // (image upload happens inside enrichment after Serper search)
            this.enrichWineInBackground(enrichId, wineData, quickScanLog);

        } catch (error) {
            console.error('Vision API error:', error);
            indicator.classList.add('hidden');

            if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                this.showToast('Not authorized. Please sign in again.');
            } else if (error.message.includes('429')) {
                this.showToast('Too many requests. Please try again later.');
            } else if (error.message.includes('not configured')) {
                this.showToast('AI service not configured.');
            } else {
                this.showToast('Could not analyze image. Please enter manually.');
            }
        }
    }

    async enrichWineInBackground(enrichId, wineData, quickScanLog) {
        console.log('🔄 Background enrichment started for:', wineData.name);

        // Track welke wijn we verrijken (3 parallel tasks)
        // enrichmentLog collects metadata from each step, saved when all done
        const enrichmentLog = { timestamp: new Date().toISOString() }
        if (quickScanLog) {
            enrichmentLog.quickScan = {
                ...quickScanLog,
                result: { name: wineData.name, producer: wineData.producer, year: wineData.year, region: wineData.region, grape: wineData.grape, type: wineData.type }
            }
        }
        this.backgroundProcessing.set(enrichId, { details: true, price: true, image: true, enrichmentLog });
        this.renderWineList(); // Toon spinner als wijn al opgeslagen is

        // Deep analysis: characteristics, notes, drink window via Gemini + Search
        const detailsPromise = wineData.name ? this.deepAnalyzeWine(wineData).catch(e => {
            console.log('Background deep analysis failed:', e);
            return null;
        }) : Promise.resolve(null);

        // Prijs en foto parallel ophalen
        const pricePromise = wineData.name ? this.lookupWinePrice(wineData).catch(e => {
            console.log('Background price lookup failed:', e);
            return null;
        }) : Promise.resolve(null);

        // Skip image search if wine already has a Storage URL (not base64)
        const hasProductImage = wineData.image && !this.isBase64Image(wineData.image);
        const imagePromise = (wineData.name && !hasProductImage) ? this.searchWineImage(wineData).catch(e => {
            console.log('Background image search failed:', e);
            return null;
        }) : Promise.resolve(null);

        // Deep analysis verwerken wanneer klaar
        detailsPromise.then(result => {
            const proc = this.backgroundProcessing.get(enrichId);
            if (proc) proc.details = false;

            if (result) {
                const deepData = result.data
                if (result._log) {
                    enrichmentLog.deepAnalysis = {
                        ...result._log,
                        result: {
                            name: deepData.name, producer: deepData.producer, type: deepData.type,
                            grape: deepData.grape, region: deepData.region,
                            expertRatings: deepData.expert_ratings || null,
                            drinkFrom: deepData.drinking_window?.bestFrom, drinkUntil: deepData.drinking_window?.bestUntil,
                            peakFrom: deepData.drinking_window?.peakFrom, peakUntil: deepData.drinking_window?.peakUntil
                        }
                    }
                }
                const updates = {};
                if (deepData.characteristics) {
                    if (deepData.characteristics.boldness) updates.boldness = deepData.characteristics.boldness;
                    if (deepData.characteristics.tannins) updates.tannins = deepData.characteristics.tannins;
                    if (deepData.characteristics.acidity) updates.acidity = deepData.characteristics.acidity;
                    if (deepData.characteristics.alcohol_pct) updates.alcohol = deepData.characteristics.alcohol_pct;
                }
                if (deepData.notes) updates.notes = deepData.notes;
                // Drinking window: new format or fallback from old drinkFrom/drinkUntil
                if (deepData.drinking_window) {
                    updates.drinkingWindow = deepData.drinking_window;
                    updates.drinkFrom = deepData.drinking_window.bestFrom;
                    updates.drinkUntil = deepData.drinking_window.bestUntil;
                } else if (deepData.drinkFrom) {
                    updates.drinkFrom = deepData.drinkFrom;
                    updates.drinkUntil = deepData.drinkUntil;
                    updates.drinkingWindow = this.mapLegacyDrinkWindow(deepData.drinkFrom, deepData.drinkUntil);
                }
                if (deepData.expert_ratings && deepData.expert_ratings.length > 0) {
                    updates.expertRatings = deepData.expert_ratings;
                }
                if (deepData.type) updates.type = deepData.type;
                if (deepData.grape) updates.grape = deepData.grape;
                if (deepData.region) updates.region = deepData.region;
                // If quick scan missed producer and deep analysis found both name + producer,
                // the quick scan likely used the producer name as wine name — fix both
                if (deepData.name && deepData.producer && !wineData.producer) {
                    updates.name = deepData.name;
                    updates.producer = deepData.producer;
                }

                if (Object.keys(updates).length > 0) {
                    console.log('📝 Deep analysis klaar (achtergrond):', Object.keys(updates).join(', '));
                    this.updateSavedWine(enrichId, updates);
                }
            }
            this.checkEnrichmentDone(enrichId);
        });

        // Prijs verwerken wanneer klaar
        pricePromise.then(result => {
            const proc = this.backgroundProcessing.get(enrichId);
            if (proc) proc.price = false;

            if (result) {
                if (result._log) {
                    enrichmentLog.priceLookup = {
                        ...result._log,
                        result: result.data ? { price: result.data.price, source: result.data.source, confidence: result.data.confidence, priceRange: result.data.priceRange } : null
                    }
                }
                if (result.data && result.data.price) {
                    const roundedPrice = Math.round(result.data.price);
                    console.log('💰 Prijs gevonden (achtergrond):', roundedPrice);
                    this.updateSavedWine(enrichId, { price: roundedPrice });
                }
            }
            this.checkEnrichmentDone(enrichId);
        });

        // Foto verwerken wanneer klaar
        imagePromise.then(async (result) => {
            const proc = this.backgroundProcessing.get(enrichId);
            if (proc) proc.image = false;

            const imageBase64 = result ? result.imageBase64 : null
            if (result && result._log) enrichmentLog.imageSearch = result._log

            if (imageBase64) {
                console.log('🖼️ Productfoto gevonden (achtergrond)');
                const url = await this.uploadImageToStorage(enrichId, imageBase64);
                const newImageUrl = url || imageBase64

                // Targeted update + crossfade animatie i.p.v. full re-render
                const wine = this.wines.find(w => w.enrichId === enrichId)
                if (wine) {
                    const hadCameraPhoto = wine.image && wine.image !== newImageUrl
                    wine.image = newImageUrl
                    this.saveWines()
                    if (hadCameraPhoto) {
                        this.animateImageTransition(wine.id, newImageUrl)
                    }
                }
            } else {
                // No product image found — upload camera photo to Storage
                const wine = this.wines.find(w => w.enrichId === enrichId)
                    || this.wishlist.find(w => w.enrichId === enrichId);
                if (wine && this.isBase64Image(wine.image)) {
                    const url = await this.uploadImageToStorage(enrichId, wine.image);
                    if (url) {
                        wine.image = url
                        this.saveWines()
                    }
                }
            }
            this.checkEnrichmentDone(enrichId);
        });
    }

    updateSavedWine(enrichId, updates) {
        // Search in wines first, then wishlist
        let wine = this.wines.find(w => w.enrichId === enrichId);
        let collection = 'wines';

        if (!wine) {
            wine = this.wishlist.find(w => w.enrichId === enrichId);
            collection = 'wishlist';
        }

        if (!wine) return;

        Object.assign(wine, updates);

        if (collection === 'wines') {
            this.saveWines();
            this.renderWineList();
        } else {
            this.saveWishlist();
        }
    }

    checkEnrichmentDone(enrichId) {
        const proc = this.backgroundProcessing.get(enrichId);
        if (proc && !proc.details && !proc.price && !proc.image) {
            // Save enrichment log when all tasks are done
            if (proc.enrichmentLog) {
                this.updateSavedWine(enrichId, { enrichmentLog: proc.enrichmentLog })
            }
            this.backgroundProcessing.delete(enrichId);
            this.renderWineList(); // Verwijder spinner
        }
    }

    async lookupWinePrice(wineData) {
        console.log('🍷 Starting Gemini price lookup for:', wineData.name, wineData.producer, wineData.year);

        // Use Cloud Function to lookup wine price via Gemini with Google Search
        if (!CONFIG.FUNCTIONS?.lookupWinePrice) {
            console.log('❌ Price lookup not configured in CONFIG');
            return null;
        }

        console.log('🍷 Price endpoint:', CONFIG.FUNCTIONS.lookupWinePrice);

        const idToken = await this.getIdToken();
        if (!idToken) {
            console.log('Not authenticated for price lookup');
            return null;
        }

        try {
            const response = await fetch(CONFIG.FUNCTIONS.lookupWinePrice, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    name: wineData.name,
                    producer: wineData.producer,
                    year: wineData.year,
                    region: wineData.region
                })
            });

            if (!response.ok) {
                console.error('Price lookup API error:', response.status);
                return null;
            }

            const result = await response.json();
            console.log('🍷 Price lookup result:', result);

            return { data: result.data, _log: result._log };
        } catch (error) {
            console.error('Price lookup error:', error);
            return null;
        }
    }

    async searchWineImage(wineData) {
        console.log('🖼️ Starting Serper image search for:', wineData.name, wineData.producer, wineData.year);

        if (!CONFIG.FUNCTIONS?.searchWineImage) {
            console.log('❌ Image search not configured in CONFIG');
            return null;
        }

        const idToken = await this.getIdToken();
        if (!idToken) {
            console.log('Not authenticated for image search');
            return null;
        }

        try {
            const response = await fetch(CONFIG.FUNCTIONS.searchWineImage, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    name: wineData.name,
                    producer: wineData.producer,
                    year: wineData.year,
                    type: wineData.type
                })
            });

            if (!response.ok) {
                console.error('Image search API error:', response.status);
                return null;
            }

            const result = await response.json();
            console.log('🖼️ Image search result:', result);

            return { imageBase64: result.data?.imageBase64 || null, _log: result._log };
        } catch (error) {
            console.error('Image search error:', error);
            return null;
        }
    }

    async deepAnalyzeWine(wineData) {
        if (!CONFIG.FUNCTIONS?.deepAnalyzeWineLabel) return null;

        const idToken = await this.getIdToken();
        if (!idToken) return null;

        const response = await fetch(CONFIG.FUNCTIONS.deepAnalyzeWineLabel, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
                name: wineData.name,
                producer: wineData.producer,
                year: wineData.year,
                grape: wineData.grape,
                region: wineData.region
            })
        });

        if (!response.ok) return null;

        const result = await response.json();
        return result.success ? { data: result.data, _log: result._log } : null;
    }

    matchExistingWine(wineData) {
        if (!this.wines.length || !wineData.name) return null;

        const normalize = (str) => (str || '').toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
            .replace(/[''`]/g, '')
            .replace(/ch[aâ]teau|chateau|domaine|tenuta|bodega|weingut|maison|cave/gi, '')
            .replace(/\s+/g, ' ')
            .trim();

        const scanName = normalize(wineData.name);
        const scanProducer = normalize(wineData.producer);

        return this.wines.find(wine => {
            const existingName = normalize(wine.name);
            const existingProducer = normalize(wine.producer);

            // Naam moet matchen (exact of bevat)
            const nameMatch = existingName === scanName
                || existingName.includes(scanName)
                || scanName.includes(existingName);

            if (!nameMatch) return false;

            // Als beide een producer hebben, moet die ook matchen
            if (wine.producer && wineData.producer) {
                const producerMatch = existingProducer === scanProducer
                    || existingProducer.includes(scanProducer)
                    || scanProducer.includes(existingProducer);
                return producerMatch;
            }

            return true;
        });
    }

    promptForYear(wineId) {
        return new Promise((resolve) => {
            const modal = document.getElementById('yearModal');
            const currentYear = new Date().getFullYear();
            const buttonsContainer = modal.querySelector('.year-picker-buttons');

            // Generate year buttons: last 10 years + "Sans Année" + "Overig"
            let html = '';
            for (let y = currentYear; y >= currentYear - 9; y--) {
                html += `<button class="year-pick-btn" data-year="${y}">${y}</button>`;
            }
            html += `<button class="year-pick-btn year-pick-nv" data-year="NV">Non Vintage</button>`;
            html += `<button class="year-pick-btn year-pick-other">Overig</button>`;
            buttonsContainer.innerHTML = html;

            modal.classList.add('active');

            const cleanup = () => {
                modal.classList.remove('active');
                buttonsContainer.innerHTML = '';
            };

            // Year button clicks
            buttonsContainer.addEventListener('click', function handler(e) {
                const btn = e.target.closest('.year-pick-btn');
                if (!btn) return;

                buttonsContainer.removeEventListener('click', handler);

                if (btn.classList.contains('year-pick-other')) {
                    // Show custom input
                    buttonsContainer.innerHTML = `
                        <div class="year-custom-input">
                            <input type="number" class="form-input year-custom-field" placeholder="Bijv. 2015" min="1900" max="2099" inputmode="numeric">
                            <button class="year-pick-btn year-pick-confirm">Bevestig</button>
                        </div>
                    `;
                    const input = buttonsContainer.querySelector('.year-custom-field');
                    const confirmBtn = buttonsContainer.querySelector('.year-pick-confirm');
                    setTimeout(() => input.focus(), 100);

                    confirmBtn.addEventListener('click', () => {
                        const year = parseInt(input.value);
                        cleanup();
                        resolve(year && year >= 1900 && year <= 2099 ? year : null);
                    });

                    input.addEventListener('keydown', (ev) => {
                        if (ev.key === 'Enter') {
                            const year = parseInt(input.value);
                            cleanup();
                            resolve(year && year >= 1900 && year <= 2099 ? year : null);
                        }
                    });
                } else {
                    const raw = btn.dataset.year;
                    const year = raw === 'NV' ? 'NV' : parseInt(raw);
                    cleanup();
                    resolve(year);
                }
            });

            // Skip button
            modal.querySelector('.year-pick-skip')?.addEventListener('click', function handler() {
                modal.querySelector('.year-pick-skip')?.removeEventListener('click', handler);
                cleanup();
                resolve(null);
            });
        });
    }

    estimateDrinkWindow(wineData) {
        const year = parseInt(wineData.year);
        if (!year) return { from: null, until: null };

        const type = (wineData.type || 'red').toLowerCase();
        const grape = (wineData.grape || '').toLowerCase();

        switch (type) {
            case 'white':
                // Kwaliteitswijnen langer houdbaar
                if (grape.includes('riesling') || grape.includes('chardonnay')) {
                    return { from: year + 1, until: year + 8 };
                }
                return { from: year, until: year + 3 };
            case 'rosé':
                return { from: year, until: year + 2 };
            case 'sparkling':
                return { from: year, until: year + 5 };
            case 'dessert':
                return { from: year + 2, until: year + 20 };
            case 'red':
            default:
                // Full-bodied reds langer houdbaar
                if (grape.includes('cabernet') || grape.includes('nebbiolo') || grape.includes('sangiovese')) {
                    return { from: year + 3, until: year + 15 };
                }
                return { from: year + 2, until: year + 10 };
        }
    }

    async loadExternalImage(imageUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            const timeout = setTimeout(() => {
                reject(new Error('Image load timeout'));
            }, 8000);

            img.onload = () => {
                clearTimeout(timeout);
                try {
                    // Converteer naar canvas om als base64 op te slaan
                    const canvas = document.createElement('canvas');
                    const maxSize = 800;
                    let { width, height } = img;

                    if (width > maxSize || height > maxSize) {
                        if (width > height) {
                            height = (height / width) * maxSize;
                            width = maxSize;
                        } else {
                            width = (width / height) * maxSize;
                            height = maxSize;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    const compressedData = canvas.toDataURL('image/jpeg', 0.8);

                    // Update preview en currentImage
                    this.currentImage = compressedData;
                    const preview = document.getElementById('previewImg');
                    preview.src = compressedData;
                    document.getElementById('imagePreview').classList.add('has-image');

                    resolve(compressedData);
                } catch (e) {
                    reject(e);
                }
            };

            img.onerror = () => {
                clearTimeout(timeout);
                reject(new Error('Failed to load image'));
            };

            img.src = imageUrl;
        });
    }

    async callChatGPTVision(imageData) {
        // Use quick scan endpoint for fast label recognition (6 fields only)
        const endpoint = CONFIG.FUNCTIONS?.quickAnalyzeWineLabel || CONFIG.FUNCTIONS?.analyzeWineLabel;
        if (!endpoint) {
            throw new Error('Cloud Functions not configured');
        }

        const idToken = await this.getIdToken();
        if (!idToken) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
                imageBase64: imageData
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `API error: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Failed to analyze image');
        }

        return { data: result.data, _log: result._log };
    }

    generateDemoWineData() {
        const currentYear = new Date().getFullYear();
        const wines = [
            { name: 'Grand Vin', producer: 'Château Margaux', type: 'red', year: 2015, region: 'Margaux, Bordeaux, France', grape: 'Cabernet Sauvignon, Merlot', boldness: 4, tannins: 4, acidity: 3, price: 450, description: 'Elegant with blackcurrant, violet, and cedar notes.', drinkFrom: 2025, drinkUntil: 2050 },
            { name: 'Sauvignon Blanc', producer: 'Cloudy Bay', type: 'white', year: 2022, region: 'Marlborough, New Zealand', grape: 'Sauvignon Blanc', boldness: 2, tannins: 1, acidity: 4, price: 28, description: 'Crisp with citrus and passion fruit.', drinkFrom: 2022, drinkUntil: 2025 },
            { name: 'Whispering Angel', producer: 'Château d\'Esclans', type: 'rosé', year: 2023, region: 'Provence, France', grape: 'Grenache, Cinsault', boldness: 2, tannins: 1, acidity: 3, price: 22, description: 'Delicate strawberry and peach flavors.', drinkFrom: 2023, drinkUntil: 2026 },
            { name: 'Tignanello', producer: 'Antinori', type: 'red', year: 2019, region: 'Tuscany, Italy', grape: 'Sangiovese, Cabernet Sauvignon', boldness: 5, tannins: 4, acidity: 4, price: 120, description: 'Rich with cherry, plum, and spicy oak.', drinkFrom: 2024, drinkUntil: 2040 },
            { name: 'Brut Vintage', producer: 'Dom Pérignon', type: 'sparkling', year: 2012, region: 'Champagne, France', grape: 'Chardonnay, Pinot Noir', boldness: 3, tannins: 1, acidity: 4, price: 200, description: 'Fine bubbles with brioche and citrus.', drinkFrom: 2020, drinkUntil: 2035 }
        ];
        return wines[Math.floor(Math.random() * wines.length)];
    }

    populateForm(data) {
        console.log('📝 populateForm received data:', JSON.stringify(data, null, 2));

        document.getElementById('wineName').value = data.name || '';
        document.getElementById('wineProducer').value = data.producer || '';
        document.getElementById('wineType').value = data.type || 'red';
        document.getElementById('wineYear').value = data.year || '';
        document.getElementById('wineRegion').value = data.region || '';
        document.getElementById('wineGrape').value = data.grape || '';

        // Handle price - can be number or string like "€25-30" or "25-40 euros"
        let priceValue = data.price || data.estimatedPrice || '';
        console.log('💰 Raw price value:', priceValue, 'Type:', typeof priceValue);
        if (priceValue) {
            if (typeof priceValue === 'string') {
                // Extract first number from string like "€25-30" or "25 euros"
                const priceMatch = priceValue.match(/(\d+)/);
                priceValue = priceMatch ? priceMatch[1] : '';
            }
            document.getElementById('winePrice').value = priceValue;
            console.log('💰 Parsed price:', priceValue);
        }

        document.getElementById('drinkFrom').value = data.drinkFrom || '';
        document.getElementById('drinkUntil').value = data.drinkUntil || '';

        // Handle tasting notes - AI returns as "notes", demo data as "description"
        const notesValue = data.notes || data.description || '';
        if (notesValue) {
            document.getElementById('wineNotes').value = notesValue;
        }

        // Support both flat and nested characteristics from AI
        const chars = data.characteristics || {};
        console.log('📊 Characteristics:', chars);
        ['boldness', 'tannins', 'acidity'].forEach(id => {
            // Check nested first (AI response), then flat (demo data)
            const value = chars[id] || data[id] || 3;
            console.log(`📊 ${id}:`, value);
            document.getElementById(id).value = value;
            document.getElementById(`${id}Value`).textContent = value;
        });
    }

    // ============================
    // Form Handling
    // ============================

    handleFormSubmit(e) {
        e.preventDefault();

        const wineData = {
            id: this.editMode ? this.currentWineId : Date.now().toString(),
            name: document.getElementById('wineName').value,
            producer: document.getElementById('wineProducer').value || null,
            type: document.getElementById('wineType').value,
            year: document.getElementById('wineYear').value || null,
            region: document.getElementById('wineRegion').value || null,
            grape: document.getElementById('wineGrape').value || null,
            boldness: parseInt(document.getElementById('boldness').value),
            tannins: parseInt(document.getElementById('tannins').value),
            acidity: parseInt(document.getElementById('acidity').value),
            price: parseFloat(document.getElementById('winePrice').value) || null,
            quantity: parseInt(document.getElementById('wineQuantity').value) || 1,
            store: document.getElementById('wineStore').value || null,
            drinkFrom: parseInt(document.getElementById('drinkFrom').value) || null,
            drinkUntil: parseInt(document.getElementById('drinkUntil').value) || null,
            notes: document.getElementById('wineNotes').value || null,
            image: this.currentImage,
            addedAt: this.editMode ? this.wines.find(w => w.id === this.currentWineId)?.addedAt : new Date().toISOString()
        };
        // Preserve existing drinkingWindow or build from drinkFrom/drinkUntil
        if (this.editMode) {
            const existing = this.wines.find(w => w.id === this.currentWineId);
            wineData.drinkingWindow = existing?.drinkingWindow || null;
        }
        if (wineData.drinkFrom && wineData.drinkUntil) {
            wineData.drinkingWindow = this.mapLegacyDrinkWindow(wineData.drinkFrom, wineData.drinkUntil);
        }

        if (this.editMode) {
            const index = this.wines.findIndex(w => w.id === this.currentWineId);
            if (index !== -1) {
                const enrichId = 'enrich_' + Date.now();
                wineData.enrichId = enrichId;
                this.wines[index] = wineData;
            }
            this.showToast('Wine updated!');

            this.saveWines();
            this.renderWineList();
            this.updateStats();
            this.closeModal('addModal');

            // Re-enrich in background (deep analysis + price + photo)
            this.enrichWineInBackground(wineData.enrichId, wineData);
        } else {
            this.wines.unshift(wineData);
            this.showToast('Wine added to cellar!');

            this.saveWines();
            this.renderWineList();
            this.updateStats();
            this.closeModal('addModal');
        }
    }

    // ============================
    // Search Functionality
    // ============================

    updateSearchVisibility() {
        const filterBar = document.getElementById('filterBar');
        if (this.wines.length > 0) {
            filterBar?.classList.remove('hidden');
        } else {
            filterBar?.classList.add('hidden');
        }
        this.updateGrapeFilterOptions();
    }

    updateGrapeFilterOptions() {
        const section = document.getElementById('grapeFilterSection');
        if (!section) return;

        // Collect unique grapes from wines
        const grapes = new Map();
        this.wines.forEach(wine => {
            if (wine.grape) {
                // Take first grape if comma-separated
                const primary = wine.grape.split(',')[0].trim();
                const key = primary.toLowerCase();
                if (!grapes.has(key)) grapes.set(key, primary);
            }
        });

        // Sort alphabetically
        const sorted = [...grapes.entries()].sort((a, b) => a[1].localeCompare(b[1]));

        if (sorted.length === 0) {
            section.classList.add('hidden');
            return;
        }

        section.classList.remove('hidden');
        const buttonsHtml = sorted.map(([key, label]) =>
            `<button class="control-option${this.grapeFilter === key ? ' active' : ''}" data-filter="grape" data-value="${key}">${label}</button>`
        ).join('');

        section.innerHTML = `
            <h4>Grape</h4>
            <button class="control-option${this.grapeFilter === 'all' ? ' active' : ''}" data-filter="grape" data-value="all">All</button>
            ${buttonsHtml}
        `;
    }

    sortAndRenderWines() {
        // Sort wines based on current sort option
        if (this.sortBy === 'drinkability') {
            // Sort by drinkability: wines that are ready now first, then by urgency
            this.wines.sort((a, b) => {
                const statusA = this.getDrinkStatus(a);
                const statusB = this.getDrinkStatus(b);

                // Priority order: perfect > soon > early > past > unknown
                const priority = { 'peak': 0, 'ready': 1, 'drink-soon': 2, 'past-peak': 3, 'opening': 4, 'too-young': 5, 'decline': 6, 'unknown': 7 };
                const prioA = priority[statusA.status] ?? 7;
                const prioB = priority[statusB.status] ?? 7;

                if (prioA !== prioB) {
                    return prioA - prioB;
                }

                // Within same status, sort by drinkUntil (earliest first for peak/drink-soon)
                if (statusA.status === 'peak' || statusA.status === 'drink-soon') {
                    return (a.drinkUntil || 9999) - (b.drinkUntil || 9999);
                }

                // For young wines, sort by drinkFrom (soonest first)
                if (statusA.status === 'too-young' || statusA.status === 'opening') {
                    return (a.drinkFrom || 9999) - (b.drinkFrom || 9999);
                }

                // Default: by addedAt
                return new Date(b.addedAt) - new Date(a.addedAt);
            });
        } else if (this.sortBy === 'name_asc') {
            this.wines.sort((a, b) => {
                const nameA = (a.name || '').toLowerCase();
                const nameB = (b.name || '').toLowerCase();
                return nameA.localeCompare(nameB) || new Date(b.addedAt) - new Date(a.addedAt);
            });
        } else if (this.sortBy === 'grape_asc') {
            this.wines.sort((a, b) => {
                if (!a.grape && !b.grape) return new Date(b.addedAt) - new Date(a.addedAt);
                if (!a.grape) return 1;
                if (!b.grape) return -1;
                return a.grape.toLowerCase().localeCompare(b.grape.toLowerCase()) || (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase());
            });
        } else if (this.sortBy === 'price_asc') {
            // Sort by price ascending (cheapest first, wines without price at the end)
            this.wines.sort((a, b) => {
                if (!a.price && !b.price) return new Date(b.addedAt) - new Date(a.addedAt);
                if (!a.price) return 1;
                if (!b.price) return -1;
                return a.price - b.price;
            });
        } else if (this.sortBy === 'price_desc') {
            // Sort by price descending (most expensive first, wines without price at the end)
            this.wines.sort((a, b) => {
                if (!a.price && !b.price) return new Date(b.addedAt) - new Date(a.addedAt);
                if (!a.price) return 1;
                if (!b.price) return -1;
                return b.price - a.price;
            });
        } else {
            // Sort by addedAt (newest first)
            this.wines.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
        }

        this.renderWineList();
    }

    handleSearch() {
        const clearBtn = document.getElementById('clearSearch');
        const resultsDiv = document.getElementById('searchResults');
        const resultCount = document.getElementById('searchResultCount');

        if (this.searchQuery) {
            clearBtn?.classList.remove('hidden');
            resultsDiv?.classList.remove('hidden');

            // Filter wines by name, producer, region, or grape
            this.filteredWines = this.wines.filter(wine => {
                const name = (wine.name || '').toLowerCase();
                const producer = (wine.producer || '').toLowerCase();
                const region = (wine.region || '').toLowerCase();
                const grape = (wine.grape || '').toLowerCase();

                return name.includes(this.searchQuery) ||
                       producer.includes(this.searchQuery) ||
                       region.includes(this.searchQuery) ||
                       grape.includes(this.searchQuery);
            });

            resultCount.textContent = `${this.filteredWines.length} result${this.filteredWines.length !== 1 ? 's' : ''}`;
        } else {
            clearBtn?.classList.add('hidden');
            resultsDiv?.classList.add('hidden');
            this.filteredWines = [];
        }

        this.renderWineList();
    }

    // ============================
    // Wine List Rendering
    // ============================

    renderWineList() {
        const list = document.getElementById('wineList');
        const emptyState = document.getElementById('emptyState');

        // Determine which wines to show
        let winesToShow = this.searchQuery ? this.filteredWines : this.wines;

        // Apply type filter
        if (this.typeFilter !== 'all') {
            winesToShow = winesToShow.filter(wine => wine.type === this.typeFilter);
        }

        // Apply drinkability filter
        if (this.drinkabilityFilter !== 'all') {
            winesToShow = winesToShow.filter(wine => {
                const status = this.getDrinkStatus(wine);
                return status.status === this.drinkabilityFilter;
            });
        }

        // Apply grape filter
        if (this.grapeFilter !== 'all') {
            winesToShow = winesToShow.filter(wine => {
                const grape = (wine.grape || '').toLowerCase();
                return grape.includes(this.grapeFilter.toLowerCase());
            });
        }

        if (this.wines.length === 0) {
            list.innerHTML = '';
            emptyState.classList.remove('hidden');
            this.updateSearchVisibility();
            // Destroy swipe handler if exists
            if (this.wineListSwipeHandler) {
                this.wineListSwipeHandler.destroy();
                this.wineListSwipeHandler = null;
            }
            return;
        }

        emptyState.classList.add('hidden');
        this.updateSearchVisibility();

        // Show no results message if search returned nothing
        if (this.searchQuery && winesToShow.length === 0) {
            list.innerHTML = `
                <div class="no-results">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="11" cy="11" r="8"/>
                        <path d="M21 21l-4.35-4.35"/>
                    </svg>
                    <p>No wines found for "${this.escapeHtml(this.searchQuery)}"</p>
                </div>
            `;
            return;
        }

        list.innerHTML = winesToShow.map(wine => {
            const drinkStatus = this.getDrinkStatus(wine);
            const isProcessing = wine.enrichId && this.backgroundProcessing.has(wine.enrichId);

            return `
            <div class="swipe-container" data-id="${wine.id}">
                <div class="swipe-action swipe-action--archive">
                    <div class="swipe-action-content">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 8v13H3V8"/>
                            <path d="M1 3h22v5H1z"/>
                            <path d="M10 12h4"/>
                        </svg>
                        <span>Archiveer</span>
                    </div>
                </div>
                <div class="swipe-content">
                    <div class="wine-card${isProcessing ? ' enriching' : ''}">
                        <div class="wine-card-image">
                            ${wine.image
                                ? `<img src="${wine.image}" alt="${wine.name}">`
                                : `<div class="placeholder-image ${wine.type}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><path d="M8 22h8"/><path d="M12 17v5"/><path d="M17 2H7l1 7c0 2.8 1.8 5 4 5s4-2.2 4-5l1-7z"/></svg></div>`
                            }
                        </div>
                        <div class="wine-card-info">
                            <h3 class="wine-card-name">${this.highlightMatch(wine.name)}</h3>
                            ${wine.producer ? `<p class="wine-card-producer">${this.highlightMatch(wine.producer)}</p>` : ''}
                            <p class="wine-card-meta">${this.highlightMatch([wine.grape, wine.year].filter(Boolean).join(' · ') || wine.region || 'No details')}</p>
                            <div class="wine-card-footer">
                                <span class="wine-type-tag ${wine.type}">${wine.type}</span>
                                <div class="wine-card-footer-right">
                                    ${wine.quantity > 1 ? `<span class="wine-quantity-badge">${wine.quantity}x</span>` : ''}
                                    ${wine.price ? `<span class="wine-price-tag">€${wine.price}</span>` : ''}
                                    ${isProcessing ? '<span class="wine-enriching-tag"><span class="enriching-spinner"></span>enriching...</span>' : (!wine.year ? '<span class="wine-year-missing-tag">+ year</span>' : (drinkStatus.label ? `<span class="wine-drink-status ${drinkStatus.class}">${drinkStatus.label}</span>` : ''))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        }).join('');

        // Bind click events for opening detail modal
        list.querySelectorAll('.swipe-content').forEach(content => {
            content.addEventListener('click', async (e) => {
                // Only open if not swiped
                const transform = content.style.transform;
                if (!transform || transform === 'translateX(0px)' || transform === 'translateX(0)') {
                    const container = content.closest('.swipe-container');
                    if (container) {
                        const wineId = container.dataset.id;
                        const wine = this.wines.find(w => w.id === wineId);

                        // If no year, show year picker first
                        if (wine && !wine.year) {
                            const year = await this.promptForYear(wineId);
                            if (year) {
                                wine.year = year;
                                const estWindow = this.estimateDrinkWindow(wine);
                                wine.drinkFrom = estWindow.from;
                                wine.drinkUntil = estWindow.until;
                                wine.drinkingWindow = this.mapLegacyDrinkWindow(estWindow.from, estWindow.until);
                                const enrichId = 'enrich_' + Date.now();
                                wine.enrichId = enrichId;
                                await this.saveWines();
                                this.renderWineList();
                                this.enrichWineInBackground(enrichId, wine);
                            }
                        }

                        this.openDetailModal(wineId);

                        // Store prompt after detail modal opens (if needed)
                        setTimeout(() => this.promptForStore(), 300)
                    }
                }
            });
        });

        // Bind click events for action buttons
        list.querySelectorAll('.swipe-action').forEach(action => {
            action.addEventListener('click', () => {
                const container = action.closest('.swipe-container');
                if (container) {
                    this.currentWineId = container.dataset.id;
                    this.openDeleteModal();
                }
            });
        });

        // Initialize swipe handler
        this.initWineListSwipeHandler();
    }

    initWineListSwipeHandler() {
        const list = document.getElementById('wineList');
        if (!list) return;

        // Destroy existing handler
        if (this.wineListSwipeHandler) {
            this.wineListSwipeHandler.destroy();
        }

        // Create new handler
        this.wineListSwipeHandler = new SwipeHandler({
            container: list,
            onAction: (id) => {
                this.currentWineId = id;
                this.openDeleteModal();
            }
        });
    }

    highlightMatch(text) {
        if (!this.searchQuery || !text) return this.escapeHtml(text || '');

        const escaped = this.escapeHtml(text);
        const regex = new RegExp(`(${this.escapeRegex(this.searchQuery)})`, 'gi');
        return escaped.replace(regex, '<mark>$1</mark>');
    }

    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    updateStats() {
        const totalBottles = this.wines.reduce((sum, wine) => sum + wine.quantity, 0);
        document.getElementById('totalBottles').textContent = totalBottles;
    }

    // ============================
    // Detail Modal
    // ============================

    openDetailModal(wineId) {
        const wine = this.wines.find(w => w.id === wineId);
        if (!wine) return;

        this.currentWineId = wineId;

        // Hero content: product photo or vineyard landscape fallback
        const heroContent = document.getElementById('detailHeroContent');
        if (wine.image) {
            heroContent.innerHTML = `<img src="${wine.image}" alt="${wine.name}">`;
        } else {
            heroContent.innerHTML = `
                <svg class="vineyard-landscape" viewBox="0 0 375 380" preserveAspectRatio="xMidYMax slice">
                    <defs>
                        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#c8dbb8"/><stop offset="60%" stop-color="#e4d49e"/><stop offset="100%" stop-color="#dbb978"/>
                        </linearGradient>
                        <linearGradient id="hill1" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#8fb36a"/><stop offset="100%" stop-color="#6a9148"/>
                        </linearGradient>
                        <linearGradient id="hill2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#a4c47a"/><stop offset="100%" stop-color="#7da858"/>
                        </linearGradient>
                        <linearGradient id="hill3" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#b8d48e"/><stop offset="100%" stop-color="#94b86a"/>
                        </linearGradient>
                    </defs>
                    <rect fill="url(#sky)" width="375" height="380"/>
                    <ellipse fill="url(#hill1)" cx="100" cy="240" rx="200" ry="60" opacity="0.6"/>
                    <ellipse fill="url(#hill1)" cx="320" cy="250" rx="160" ry="50" opacity="0.5"/>
                    <ellipse fill="url(#hill2)" cx="60" cy="290" rx="180" ry="55"/>
                    <ellipse fill="url(#hill2)" cx="340" cy="280" rx="140" ry="50"/>
                    <g stroke="#7da858" stroke-width="1" opacity="0.4">
                        <path d="M-20,270 Q60,252 140,270" fill="none"/><path d="M-20,278 Q60,260 140,278" fill="none"/>
                        <path d="M-20,286 Q60,268 140,286" fill="none"/><path d="M240,265 Q320,248 400,265" fill="none"/>
                    </g>
                    <path fill="url(#hill3)" d="M-20,310 Q80,270 187,295 Q300,320 400,290 L400,380 L-20,380 Z"/>
                    <g stroke="#88a862" stroke-width="1.2" opacity="0.35">
                        <path d="M-20,315 Q80,280 187,300 Q300,322 400,295" fill="none"/>
                        <path d="M-20,325 Q80,290 187,310 Q300,332 400,305" fill="none"/>
                        <path d="M-20,335 Q80,300 187,320 Q300,342 400,315" fill="none"/>
                    </g>
                    <g opacity="0.7">
                        <path d="M50,260 Q52,230 54,260 Z" fill="#5a7d3a"/><path d="M48,265 Q52,225 56,265 Z" fill="#4a6d2a"/>
                        <path d="M310,250 Q312,225 314,250 Z" fill="#5a7d3a"/><path d="M308,255 Q312,220 316,255 Z" fill="#4a6d2a"/>
                        <rect x="154" y="248" width="18" height="14" fill="#e8d5a3" rx="1"/>
                        <path d="M152,248 L163,240 L174,248 Z" fill="#c45a3c"/>
                    </g>
                    <ellipse cx="187" cy="365" rx="30" ry="6" fill="rgba(60,30,10,0.12)"/>
                </svg>`;
        }

        // Hero info overlay
        document.getElementById('detailTypeBadge').textContent = wine.type;
        document.getElementById('detailName').textContent = wine.name;

        const producerEl = document.getElementById('detailProducer');
        if (wine.producer) {
            producerEl.textContent = wine.producer;
            producerEl.style.display = 'block';
        } else {
            producerEl.style.display = 'none';
        }

        document.getElementById('detailRegion').textContent = wine.region || '';

        // Facts row
        document.getElementById('detailYear').textContent = wine.year || '—';
        document.getElementById('detailGrape').textContent = wine.grape || '—';
        document.getElementById('detailPrice').textContent = wine.price ? `€${Math.round(wine.price)}` : '—';

        // Alcohol
        const alcoholFact = document.getElementById('detailAlcoholFact');
        if (wine.alcohol) {
            alcoholFact.style.display = '';
            document.getElementById('detailAlcohol').textContent = wine.alcohol;
        } else {
            alcoholFact.style.display = 'none';
        }

        // Expert ratings
        const expertSection = document.getElementById('detailExpertSection');
        if (wine.expertRatings && wine.expertRatings.length > 0) {
            expertSection.style.display = '';
            document.getElementById('detailExpertRatings').innerHTML = wine.expertRatings
                .map(r => `<div class="detail-expert-row"><span class="detail-expert-source">${r.source}</span><span class="detail-expert-score">${r.score}</span></div>`)
                .join('');
        } else {
            expertSection.style.display = 'none';
        }

        // Profile bars
        document.getElementById('detailBoldness').style.width = `${wine.boldness * 20}%`;
        document.getElementById('detailTannins').style.width = `${wine.tannins * 20}%`;
        document.getElementById('detailAcidity').style.width = `${wine.acidity * 20}%`;

        // Drink window — dot timeline
        const drinkWindowSection = document.getElementById('detailDrinkWindowSection');
        const timelineContainer = document.getElementById('detailDrinkTimeline');
        const w = this.getWineWindow(wine);
        if (w) {
            drinkWindowSection.style.display = '';
            timelineContainer.innerHTML = '';
            this.renderDotTimeline(timelineContainer, wine);
        } else {
            drinkWindowSection.style.display = 'none';
        }

        // Store
        this.showStoreSection(wine)

        // Notes
        const notesSection = document.getElementById('detailNotesSection');
        const notesText = document.getElementById('detailNotes');
        if (wine.notes) {
            notesSection.style.display = 'block';
            notesText.textContent = wine.notes;
        } else {
            notesSection.style.display = 'none';
        }

        // Rating slider
        const ratingInput = document.getElementById('detailRatingInput')
        ratingInput.value = wine.rating || 0
        this.updateRatingSlider('detail', wine.rating || 0)

        // Enrichment Log (admin only)
        const enrichSection = document.getElementById('detailEnrichmentSection')
        if (this.isAdmin && wine.enrichmentLog) {
            enrichSection.style.display = ''
            const content = document.getElementById('enrichmentLogContent')
            const log = wine.enrichmentLog
            content.innerHTML = this.renderEnrichmentLog(log)
            // Reset toggle state
            content.style.display = 'none'
            const icon = enrichSection.querySelector('.enrichment-toggle-icon')
            icon.textContent = '\u25B6'
            document.getElementById('enrichmentToggle').onclick = () => {
                if (content.style.display === 'none') {
                    content.style.display = ''
                    icon.textContent = '\u25BC'
                } else {
                    content.style.display = 'none'
                    icon.textContent = '\u25B6'
                }
            }
        } else {
            enrichSection.style.display = 'none'
        }

        // Quantity
        document.getElementById('detailQuantity').textContent = wine.quantity;
        this.openModal('detailModal');
    }

    renderEnrichmentLog(log) {
        const dur = (ms) => ms ? `${(ms / 1000).toFixed(1)}s` : '?'
        const val = (v) => v || '—'
        const sections = []

        // Quick Scan
        if (log.quickScan) {
            const q = log.quickScan
            const r = q.result || {}
            sections.push(`
                <div class="enrichment-log-section">
                    <div class="enrichment-log-section-header">Quick Scan <span class="enrichment-log-dur">${dur(q.duration)}</span></div>
                    <div class="enrichment-log-detail">Name: ${val(r.name)}, Producer: ${val(r.producer)}, Year: ${val(r.year)}</div>
                    <div class="enrichment-log-detail">Region: ${val(r.region)}, Grape: ${val(r.grape)}, Type: ${val(r.type)}</div>
                </div>
            `)
        }

        // Deep Analysis
        if (log.deepAnalysis) {
            const d = log.deepAnalysis
            const r = d.result || {}
            let confLine = `Confidence: ${d.step1Confidence !== undefined ? d.step1Confidence : '?'}`
            if (d.groundingUsed) confLine += ` → grounding (${d.groundingMethod || 'search'})`
            else if (d.step1Confidence >= 70) confLine += ' (geen grounding nodig)'

            const details = [`<div class="enrichment-log-detail">${confLine}</div>`]
            if (r.type || r.grape || r.region) {
                details.push(`<div class="enrichment-log-detail">Type: ${val(r.type)}, Grape: ${val(r.grape)}, Region: ${val(r.region)}</div>`)
            }
            if (r.producer) details.push(`<div class="enrichment-log-detail">Producer: ${r.producer}</div>`)
            if (r.expertRatings && r.expertRatings.length > 0) {
                const ratings = r.expertRatings.map(e => `${e.source}: ${e.score}`).join(', ')
                details.push(`<div class="enrichment-log-detail">Ratings: ${ratings}</div>`)
            }
            if (r.drinkFrom || r.drinkUntil) {
                let window = `${r.drinkFrom || '?'}–${r.drinkUntil || '?'}`
                if (r.peakFrom || r.peakUntil) window += ` (peak ${r.peakFrom || '?'}–${r.peakUntil || '?'})`
                details.push(`<div class="enrichment-log-detail">Drinking window: ${window}</div>`)
            }

            sections.push(`
                <div class="enrichment-log-section">
                    <div class="enrichment-log-section-header">Deep Analysis <span class="enrichment-log-dur">${dur(d.duration)}</span></div>
                    ${details.join('')}
                </div>
            `)
        }

        // Price Lookup
        if (log.priceLookup) {
            const p = log.priceLookup
            const r = p.result || {}
            const details = []
            let method = p.searchMethod || '?'
            if (p.shoppingResults) method += ' + shop'
            if (p.webResults) method += ' + web'
            details.push(`<div class="enrichment-log-detail">Search: ${method}</div>`)
            if (r.price) {
                details.push(`<div class="enrichment-log-detail">Price: €${r.price}${r.priceRange ? ` (${r.priceRange})` : ''} · ${r.source || '?'}</div>`)
            } else {
                details.push(`<div class="enrichment-log-detail enrichment-log-warn">No price found${r.confidence ? ` (${r.confidence})` : ''}</div>`)
            }

            sections.push(`
                <div class="enrichment-log-section">
                    <div class="enrichment-log-section-header">Price Lookup <span class="enrichment-log-dur">${dur(p.duration)}</span></div>
                    ${details.join('')}
                </div>
            `)
        }

        // Image Search
        if (log.imageSearch) {
            const i = log.imageSearch
            const details = []
            if (i.found) {
                details.push(`<div class="enrichment-log-detail">${i.candidatesFiltered}/${i.candidatesTotal} candidates · ${i.imageSource || 'found'}</div>`)
            } else {
                details.push(`<div class="enrichment-log-detail enrichment-log-warn">Not found (${i.candidatesTotal || 0} results)</div>`)
            }

            sections.push(`
                <div class="enrichment-log-section">
                    <div class="enrichment-log-section-header">Image Search <span class="enrichment-log-dur">${dur(i.duration)}</span></div>
                    ${details.join('')}
                </div>
            `)
        }

        const time = log.timestamp ? new Date(log.timestamp).toLocaleString('nl-NL') : ''
        return `<div class="enrichment-log-time">${time}</div>${sections.join('')}`
    }

    updateDetailQuantity(change) {
        const wine = this.wines.find(w => w.id === this.currentWineId);
        if (!wine) return;

        const newQty = wine.quantity + change;
        if (newQty < 1) return;

        wine.quantity = newQty;
        this.saveWines();

        document.getElementById('detailQuantity').textContent = newQty;
        this.renderWineList();
        this.updateStats();
    }

    // ============================
    // Store Nudge
    // ============================

    getFrequentStores() {
        const counts = {}
        const canonical = {}
        ;[...this.wines, ...this.archive].forEach(w => {
            if (w.store) {
                const key = w.store.toLowerCase().trim()
                counts[key] = (counts[key] || 0) + 1
                if (!canonical[key]) canonical[key] = w.store
            }
        })
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([key]) => canonical[key])
    }

    showStoreSection(wine) {
        const section = document.getElementById('detailStoreSection')
        const display = document.getElementById('detailStoreDisplay')

        if (wine.store) {
            section.style.display = ''
            display.style.display = 'flex'
            document.getElementById('detailStore').textContent = wine.store
        } else {
            section.style.display = 'none'
        }
    }

    promptForStore(force = false) {
        const wine = this.wines.find(w => w.id === this.currentWineId)
        if (!wine) return
        if (!force && (wine.store || wine.storePromptDismissed)) return

        // Render chips in popup
        const container = document.getElementById('storeModalChips')
        const stores = this.getFrequentStores()
        if (stores.length > 0) {
            container.style.display = 'flex'
            container.innerHTML = stores.map(s =>
                `<button class="store-chip" data-store="${s}">${s}</button>`
            ).join('')
        } else {
            container.style.display = 'none'
        }
        document.getElementById('storeModalInput').value = ''
        this.openModal('storeModal')
    }

    saveStoreFromModal(storeName) {
        if (!storeName) return
        const wine = this.wines.find(w => w.id === this.currentWineId)
        if (!wine) return
        wine.store = storeName
        this.saveWines()
        this.showStoreSection(wine)
        this.renderWineList()
        this.closeModal('storeModal')
    }

    dismissStorePrompt() {
        const wine = this.wines.find(w => w.id === this.currentWineId)
        if (wine) {
            wine.storePromptDismissed = true
            this.saveWines()
        }
        this.closeModal('storeModal')
    }

    // ============================
    // Edit Wine
    // ============================

    editCurrentWine() {
        const wine = this.wines.find(w => w.id === this.currentWineId);
        if (!wine) return;

        this.closeModal('detailModal');

        setTimeout(() => {
            this.editMode = true;
            this.resetForm();

            // Hide tiles, show edit form
            document.getElementById('addDestinationStep')?.classList.add('hidden');
            document.getElementById('addStepEdit')?.classList.remove('hidden');
            document.getElementById('addModalTitle').textContent = 'Edit Wine';

            document.getElementById('wineName').value = wine.name;
            document.getElementById('wineProducer').value = wine.producer || '';
            document.getElementById('wineType').value = wine.type;
            document.getElementById('wineYear').value = wine.year || '';
            document.getElementById('wineRegion').value = wine.region || '';
            document.getElementById('wineGrape').value = wine.grape || '';
            document.getElementById('winePrice').value = wine.price || '';
            document.getElementById('wineQuantity').value = wine.quantity;
            document.getElementById('wineStore').value = wine.store || '';
            document.getElementById('drinkFrom').value = wine.drinkFrom || '';
            document.getElementById('drinkUntil').value = wine.drinkUntil || '';
            document.getElementById('wineNotes').value = wine.notes || '';

            ['boldness', 'tannins', 'acidity'].forEach(id => {
                document.getElementById(id).value = wine[id];
                document.getElementById(`${id}Value`).textContent = wine[id];
            });

            if (wine.image) {
                this.currentImage = wine.image;
                document.getElementById('previewImg').src = wine.image;
                document.getElementById('imagePreview').classList.add('has-image');
            }

            this.openModal('addModal');
        }, 300);
    }

    // ============================
    // Delete Wine / Archive
    // ============================

    openDeleteModal() {
        const wine = this.wines.find(w => w.id === this.currentWineId);
        if (!wine) return;

        // Pre-fill archive modal with existing wine data
        this.archiveRating = wine.rating || 0;
        this.archiveRebuy = null;

        // Update UI
        document.getElementById('archiveWineName').textContent = wine.producer
            ? `${wine.name} - ${wine.producer}`
            : wine.name;

        // Set rating slider to existing rating
        document.getElementById('archiveRatingInput').value = this.archiveRating
        this.updateRatingSlider('archive', this.archiveRating)

        // Reset rebuy buttons
        document.querySelectorAll('#rebuyOptions .rebuy-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Clear notes
        document.getElementById('archiveNotes').value = '';

        this.openModal('archiveModal');
    }

    updateRatingSlider(prefix, value) {
        const pct = (value / 5) * 100
        document.getElementById(`${prefix}RatingFill`).style.width = `${pct}%`
        document.getElementById(`${prefix}RatingThumb`).style.left = `${pct}%`

        const valueEl = document.getElementById(`${prefix}RatingValue`)
        const badgeEl = document.getElementById(`${prefix}RatingBadge`)

        if (value === 0) {
            valueEl.textContent = ''
            badgeEl.textContent = 'Not rated'
            badgeEl.className = 'rating-badge'
        } else {
            valueEl.innerHTML = `${value.toFixed(1)} <span class="star-icon">★</span>`
            const { label, cls } = this.getRatingLabel(value)
            badgeEl.textContent = label
            badgeEl.className = `rating-badge ${cls}`
        }
    }

    getRatingLabel(value) {
        if (value < 2) return { label: 'Poor', cls: '' }
        if (value < 3) return { label: 'Fair', cls: '' }
        if (value < 4) return { label: 'Good', cls: 'good' }
        if (value < 4.5) return { label: 'Very Good', cls: 'very-good' }
        return { label: 'Excellent', cls: 'excellent' }
    }

    getStarDisplay(rating) {
        return `${Number(rating).toFixed(1)} ★`
    }

    setRebuyOption(option) {
        this.archiveRebuy = option;
        document.querySelectorAll('#rebuyOptions .rebuy-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.rebuy === option);
        });
    }

    async skipArchiveAndDelete() {
        console.log('skipArchiveAndDelete called');
        try {
            // Clean up image from Storage
            this.deleteImageFromStorage(this.currentWineId);
            // Just delete without archiving
            await this.deleteCurrentWine();
            this.closeModal('archiveModal');
            this.showToast('Wine deleted');
        } catch (error) {
            console.error('Error in skipArchiveAndDelete:', error);
        }
    }

    async confirmArchive() {
        console.log('confirmArchive called');
        const wine = this.wines.find(w => w.id === this.currentWineId);
        if (!wine) {
            console.log('No wine found with id:', this.currentWineId);
            return;
        }

        // Create archive entry
        const archivedWine = {
            ...wine,
            rating: this.archiveRating,
            rebuy: this.archiveRebuy,
            archiveNotes: document.getElementById('archiveNotes').value.trim() || null,
            archivedAt: new Date().toISOString()
        };

        // Add to archive
        await this.pushToArchive(archivedWine);

        // Delete from cellar
        await this.deleteCurrentWine();

        this.closeModal('archiveModal');
        this.showToast('Wijn gearchiveerd!');
    }

    async deleteCurrentWine() {
        const wineIdToDelete = this.currentWineId;
        const wineName = this.wines.find(w => w.id === wineIdToDelete)?.name || 'Unknown';

        console.log('🍷 Starting delete process for:', wineName, '(ID:', wineIdToDelete, ')');

        // Set flag to prevent Firebase listener from re-adding the wine
        this.syncInProgress = true;

        // Remove from local array
        this.wines = this.wines.filter(w => w.id !== wineIdToDelete);
        console.log('  Removed from local array. Wines remaining:', this.wines.length);

        // Delete from Firebase and wait for it to complete
        if (this.firebaseEnabled) {
            console.log('  Firebase is enabled, deleting from cloud...');
            const deleteSuccess = await this.deleteWineFromFirebase(wineIdToDelete);
            console.log('  Firebase delete result:', deleteSuccess ? 'SUCCESS' : 'FAILED');
        } else {
            console.log('  Firebase not enabled, skip cloud delete');
        }

        this.renderWineList();
        this.updateStats();
        this.updateSearchVisibility();

        this.closeModal('detailModal');

        // Reset flag after a short delay to allow Firebase to sync
        setTimeout(() => {
            this.syncInProgress = false;
            console.log('  Sync flag reset');
        }, 2000);
    }

    // ============================
    // Archive List & Detail
    // ============================

    openArchiveList() {
        // Reset search and filters
        document.getElementById('archiveSearchInput').value = '';
        document.getElementById('archiveTypeFilter').value = '';
        document.getElementById('archiveRebuyFilter').value = '';
        this.archiveSearchQuery = '';

        this.filterAndRenderArchive();
        this.openModal('archiveListModal');
    }

    filterAndRenderArchive() {
        const typeFilter = document.getElementById('archiveTypeFilter')?.value || '';
        const rebuyFilter = document.getElementById('archiveRebuyFilter')?.value || '';
        const clearBtn = document.getElementById('clearArchiveSearch');

        // Show/hide clear button
        if (this.archiveSearchQuery) {
            clearBtn?.classList.remove('hidden');
        } else {
            clearBtn?.classList.add('hidden');
        }

        // Filter archive
        this.filteredArchive = this.archive.filter(wine => {
            // Type filter
            if (typeFilter && wine.type !== typeFilter) return false;

            // Rebuy filter
            if (rebuyFilter && wine.rebuy !== rebuyFilter) return false;

            // Search query
            if (this.archiveSearchQuery) {
                const searchFields = [
                    wine.name,
                    wine.producer,
                    wine.region,
                    wine.grape,
                    wine.store
                ].filter(Boolean).join(' ').toLowerCase();

                if (!searchFields.includes(this.archiveSearchQuery)) return false;
            }

            return true;
        });

        this.renderArchiveList();
    }

    renderArchiveList() {
        const list = document.getElementById('archiveList');
        const emptyState = document.getElementById('archiveEmptyState');
        const statsEl = document.getElementById('archiveCount');

        // Update count
        statsEl.textContent = `${this.filteredArchive.length} wine${this.filteredArchive.length !== 1 ? 's' : ''}`;

        if (this.archive.length === 0) {
            list.innerHTML = '';
            emptyState.classList.remove('hidden');
            // Destroy swipe handler if exists
            if (this.archiveListSwipeHandler) {
                this.archiveListSwipeHandler.destroy();
                this.archiveListSwipeHandler = null;
            }
            return;
        }

        emptyState.classList.add('hidden');

        if (this.filteredArchive.length === 0) {
            list.innerHTML = `
                <div class="no-results">
                    <p>No wines found</p>
                </div>
            `;
            return;
        }

        list.innerHTML = this.filteredArchive.map(wine => {
            const stars = this.getStarDisplay(wine.rating || 0);
            const rebuyLabels = { yes: 'Rebuy', maybe: 'Maybe', no: 'Don\'t rebuy' };
            const rebuyLabel = rebuyLabels[wine.rebuy] || '';

            return `
                <div class="swipe-container" data-id="${wine.id}">
                    <div class="swipe-action swipe-action--delete">
                        <div class="swipe-action-content">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M3 6h18"/>
                                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/>
                                <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                                <line x1="10" y1="11" x2="10" y2="17"/>
                                <line x1="14" y1="11" x2="14" y2="17"/>
                            </svg>
                            <span>Delete</span>
                        </div>
                    </div>
                    <div class="swipe-content">
                        <div class="archive-card">
                            <div class="archive-card-image">
                                ${wine.image
                                    ? `<img src="${wine.image}" alt="${wine.name}">`
                                    : `<div class="placeholder-image ${wine.type}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><path d="M8 22h8"/><path d="M12 17v5"/><path d="M17 2H7l1 7c0 2.8 1.8 5 4 5s4-2.2 4-5l1-7z"/></svg></div>`
                                }
                            </div>
                            <div class="archive-card-info">
                                <h4 class="archive-card-name">${this.escapeHtml(wine.name)}</h4>
                                ${wine.producer ? `<p class="archive-card-producer">${this.escapeHtml(wine.producer)}</p>` : ''}
                                <div class="archive-card-meta">
                                    ${wine.rating ? `<span class="archive-card-stars">${stars}</span>` : ''}
                                    ${wine.rebuy ? `<span class="archive-card-rebuy ${wine.rebuy}">${rebuyLabel}</span>` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Bind click events for opening detail modal
        list.querySelectorAll('.swipe-content').forEach(content => {
            content.addEventListener('click', (e) => {
                // Only open if not swiped
                const transform = content.style.transform;
                if (!transform || transform === 'translateX(0px)' || transform === 'translateX(0)') {
                    const container = content.closest('.swipe-container');
                    if (container) {
                        this.openArchiveDetail(container.dataset.id);
                    }
                }
            });
        });

        // Bind click events for action buttons
        list.querySelectorAll('.swipe-action').forEach(action => {
            action.addEventListener('click', () => {
                const container = action.closest('.swipe-container');
                if (container) {
                    this.currentArchiveId = container.dataset.id;
                    this.deleteFromArchiveConfirm();
                }
            });
        });

        // Initialize swipe handler for archive
        this.initArchiveSwipeHandler();
    }

    initArchiveSwipeHandler() {
        const list = document.getElementById('archiveList');
        if (!list) return;

        // Destroy existing handler
        if (this.archiveListSwipeHandler) {
            this.archiveListSwipeHandler.destroy();
        }

        // Create new handler
        this.archiveListSwipeHandler = new SwipeHandler({
            container: list,
            onAction: (id) => {
                this.currentArchiveId = id;
                this.deleteFromArchiveConfirm();
            }
        });
    }

    openArchiveDetail(archiveId) {
        const wine = this.archive.find(w => w.id === archiveId);
        if (!wine) return;

        this.currentArchiveId = archiveId;

        // Hero content: product photo or vineyard landscape fallback
        const heroContent = document.getElementById('archiveDetailHeroContent');
        if (wine.image) {
            heroContent.innerHTML = `<img src="${wine.image}" alt="${wine.name}">`;
        } else {
            heroContent.innerHTML = `
                <svg class="vineyard-landscape" viewBox="0 0 375 380" preserveAspectRatio="xMidYMax slice">
                    <defs>
                        <linearGradient id="archSky" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#c8dbb8"/><stop offset="60%" stop-color="#e4d49e"/><stop offset="100%" stop-color="#dbb978"/>
                        </linearGradient>
                        <linearGradient id="archHill1" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#8fb36a"/><stop offset="100%" stop-color="#6a9148"/>
                        </linearGradient>
                        <linearGradient id="archHill2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#a4c47a"/><stop offset="100%" stop-color="#7da858"/>
                        </linearGradient>
                        <linearGradient id="archHill3" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#b8d48e"/><stop offset="100%" stop-color="#94b86a"/>
                        </linearGradient>
                    </defs>
                    <rect fill="url(#archSky)" width="375" height="380"/>
                    <ellipse fill="url(#archHill1)" cx="100" cy="240" rx="200" ry="60" opacity="0.6"/>
                    <ellipse fill="url(#archHill1)" cx="320" cy="250" rx="160" ry="50" opacity="0.5"/>
                    <ellipse fill="url(#archHill2)" cx="60" cy="290" rx="180" ry="55"/>
                    <ellipse fill="url(#archHill2)" cx="340" cy="280" rx="140" ry="50"/>
                    <path fill="url(#archHill3)" d="M-20,310 Q80,270 187,295 Q300,320 400,290 L400,380 L-20,380 Z"/>
                </svg>`;
        }

        // Hero info overlay
        document.getElementById('archiveDetailTypeBadge').textContent = wine.type;
        document.getElementById('archiveDetailName').textContent = wine.name;

        const producerEl = document.getElementById('archiveDetailProducer');
        if (wine.producer) {
            producerEl.textContent = wine.producer;
            producerEl.style.display = 'block';
        } else {
            producerEl.style.display = 'none';
        }

        document.getElementById('archiveDetailRegion').textContent = wine.region || '';

        // Rating display
        const starsEl = document.getElementById('archiveDetailStars');
        if (wine.rating) {
            const { label } = this.getRatingLabel(wine.rating)
            starsEl.innerHTML = `<span class="rating-value">${Number(wine.rating).toFixed(1)} <span class="star-icon">★</span></span> <span style="font-size:11px;color:#8A8278;margin-left:4px">${label}</span>`;
            starsEl.parentElement.style.display = 'flex';
        } else {
            starsEl.parentElement.style.display = 'none';
        }

        // Rebuy badge
        const rebuyEl = document.getElementById('archiveDetailRebuy');
        if (wine.rebuy) {
            const rebuyConfig = {
                yes: { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>', text: 'Rebuy', class: 'yes' },
                maybe: { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><circle cx="12" cy="12" r="10"/><line x1="8" y1="15" x2="16" y2="15"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>', text: 'Maybe', class: 'maybe' },
                no: { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M10 15V19a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/></svg>', text: 'Don\'t rebuy', class: 'no' }
            };
            const config = rebuyConfig[wine.rebuy];
            rebuyEl.innerHTML = `<span class="rebuy-icon">${config.icon}</span><span>${config.text}</span>`;
            rebuyEl.className = `rebuy-badge ${config.class}`;
            rebuyEl.style.display = 'flex';
        } else {
            rebuyEl.style.display = 'none';
        }

        // Meta info
        document.getElementById('archiveDetailYear').textContent = wine.year || '—';
        document.getElementById('archiveDetailGrape').textContent = wine.grape || '—';
        document.getElementById('archiveDetailPrice').textContent = wine.price ? `€${Math.round(wine.price)}` : '—';

        // Store
        const storeSection = document.getElementById('archiveDetailStoreSection');
        if (wine.store) {
            storeSection.style.display = 'flex';
            document.getElementById('archiveDetailStore').textContent = wine.store;
        } else {
            storeSection.style.display = 'none';
        }

        // Characteristics
        document.getElementById('archiveDetailBoldness').style.width = `${(wine.boldness || 3) * 20}%`;
        document.getElementById('archiveDetailTannins').style.width = `${(wine.tannins || 3) * 20}%`;
        document.getElementById('archiveDetailAcidity').style.width = `${(wine.acidity || 3) * 20}%`;

        // Tasting notes
        const notesSection = document.getElementById('archiveDetailNotesSection');
        if (wine.notes) {
            notesSection.style.display = 'block';
            document.getElementById('archiveDetailNotes').textContent = wine.notes;
        } else {
            notesSection.style.display = 'none';
        }

        // Archive review
        const reviewSection = document.getElementById('archiveDetailReviewSection');
        if (wine.archiveNotes) {
            reviewSection.style.display = 'block';
            document.getElementById('archiveDetailReview').textContent = wine.archiveNotes;
        } else {
            reviewSection.style.display = 'none';
        }

        // Archive date
        const dateEl = document.getElementById('archiveDetailDate');
        if (wine.archivedAt) {
            const date = new Date(wine.archivedAt);
            dateEl.textContent = `Gearchiveerd op ${date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}`;
        } else {
            dateEl.textContent = '';
        }

        this.openModal('archiveDetailModal');
    }

    async restoreWineFromArchive() {
        const archivedWine = this.archive.find(w => w.id === this.currentArchiveId);
        if (!archivedWine) return;

        // Create a new wine entry (without archive-specific fields)
        const restoredWine = {
            id: Date.now().toString(), // New ID
            name: archivedWine.name,
            producer: archivedWine.producer,
            type: archivedWine.type,
            year: archivedWine.year,
            region: archivedWine.region,
            grape: archivedWine.grape,
            boldness: archivedWine.boldness,
            tannins: archivedWine.tannins,
            acidity: archivedWine.acidity,
            price: archivedWine.price,
            quantity: 1,
            store: archivedWine.store,
            notes: archivedWine.notes,
            image: archivedWine.image,
            addedAt: new Date().toISOString()
        };

        // Add to wines
        this.wines.unshift(restoredWine);

        if (this.firebaseEnabled) {
            await this.pushWineToFirebase(restoredWine);
        }

        // Remove from archive
        await this.deleteFromArchive(this.currentArchiveId);

        this.renderWineList();
        this.updateStats();
        this.filterAndRenderArchive();

        this.closeModal('archiveDetailModal');
        this.showToast('Wine moved back to cellar!');
    }

    async deleteFromArchiveConfirm() {
        if (!confirm('Are you sure you want to permanently delete this wine from the archive?')) {
            return;
        }

        // Clean up image from Storage
        this.deleteImageFromStorage(this.currentArchiveId, 'wines');
        await this.deleteFromArchive(this.currentArchiveId);
        this.filterAndRenderArchive();

        this.closeModal('archiveDetailModal');
        this.showToast('Wine deleted from archive');
    }

    // ============================
    // Wishlist
    // ============================

    saveWishlist() {
        if (this.firebaseEnabled && this.db && this.userId) {
            const wishlistObject = {};
            this.wishlist.forEach(wine => {
                wishlistObject[wine.id] = wine;
            });
            this.db.ref(`users/${this.userId}/wishlist`).set(wishlistObject)
                .catch(err => console.error('Error saving wishlist:', err));
        }
    }

    openWishlistModal() {
        this.renderWishlist();
        this.openModal('wishlistModal');
    }

    renderWishlist() {
        const list = document.getElementById('wishlistList');
        const empty = document.getElementById('wishlistEmptyState');

        if (this.wishlist.length === 0) {
            empty?.classList.remove('hidden');
            if (list) list.innerHTML = '';
            return;
        }

        empty?.classList.add('hidden');
        list.innerHTML = this.wishlist.map(wine => `
            <div class="archive-card" data-wishlist-id="${wine.id}">
                <div class="archive-card-image">
                    ${wine.image
                        ? `<img src="${wine.image}" alt="${wine.name}">`
                        : `<div class="placeholder-image ${wine.type || 'red'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><path d="M8 22h8"/><path d="M12 17v5"/><path d="M17 2H7l1 7c0 2.8 1.8 5 4 5s4-2.2 4-5l1-7z"/></svg></div>`}
                </div>
                <div class="archive-card-info">
                    <div class="archive-card-name">${wine.name || 'Unknown'}</div>
                    ${wine.producer ? `<div class="archive-card-producer">${wine.producer}</div>` : ''}
                    <div class="archive-card-meta">
                        ${[wine.type, wine.grape, wine.year].filter(Boolean).join(' · ')}
                        ${wine.price ? ` · €${Math.round(wine.price)}` : ''}
                    </div>
                </div>
            </div>
        `).join('');

        list.querySelectorAll('.archive-card').forEach(card => {
            card.addEventListener('click', () => {
                this.openWishlistDetail(card.dataset.wishlistId);
            });
        });
    }

    openWishlistDetail(wineId) {
        const wine = this.wishlist.find(w => w.id === wineId);
        if (!wine) return;

        this.currentWishlistId = wineId;

        // Hero image
        const heroContent = document.getElementById('wishlistDetailHeroContent');
        if (wine.image) {
            heroContent.innerHTML = `<img src="${wine.image}" alt="${wine.name}" style="width:100%;height:100%;object-fit:contain;padding:16px;background:#ffffff">`;
        } else {
            heroContent.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;opacity:0.3"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="64" height="64"><path d="M8 22h8"/><path d="M12 17v5"/><path d="M17 2H7l1 7c0 2.8 1.8 5 4 5s4-2.2 4-5l1-7z"/></svg></div>`;
        }

        document.getElementById('wishlistDetailTypeBadge').textContent = wine.type || '';
        document.getElementById('wishlistDetailName').textContent = wine.name || 'Unknown';

        const producerEl = document.getElementById('wishlistDetailProducer');
        if (wine.producer) {
            producerEl.textContent = wine.producer;
            producerEl.style.display = 'block';
        } else {
            producerEl.style.display = 'none';
        }

        document.getElementById('wishlistDetailRegion').textContent = wine.region || '';
        document.getElementById('wishlistDetailYear').textContent = wine.year || '—';
        document.getElementById('wishlistDetailGrape').textContent = wine.grape || '—';
        document.getElementById('wishlistDetailPrice').textContent = wine.price ? `€${Math.round(wine.price)}` : '—';

        const notesSection = document.getElementById('wishlistDetailNotesSection');
        if (wine.notes) {
            notesSection.style.display = '';
            document.getElementById('wishlistDetailNotes').textContent = wine.notes;
        } else {
            notesSection.style.display = 'none';
        }

        this.openModal('wishlistDetailModal');
    }

    moveWishlistToCellar() {
        const wine = this.wishlist.find(w => w.id === this.currentWishlistId);
        if (!wine) return;

        // Remove from wishlist
        this.wishlist = this.wishlist.filter(w => w.id !== this.currentWishlistId);
        if (this.firebaseEnabled && this.db && this.userId) {
            this.db.ref(`users/${this.userId}/wishlist/${this.currentWishlistId}`).remove();
        }

        // Add to cellar
        wine.addedAt = new Date().toISOString();
        wine.quantity = 1;
        this.wines.unshift(wine);
        this.saveWines();
        this.renderWineList();
        this.updateStats();

        this.closeModal('wishlistDetailModal');
        this.renderWishlist();
        this.showToast('Wine moved to cellar!');
    }

    deleteFromWishlistConfirm() {
        if (!confirm('Remove this wine from your wishlist?')) return;

        this.wishlist = this.wishlist.filter(w => w.id !== this.currentWishlistId);
        if (this.firebaseEnabled && this.db && this.userId) {
            this.db.ref(`users/${this.userId}/wishlist/${this.currentWishlistId}`).remove();
        }

        // Clean up image from Storage
        this.deleteImageFromStorage(this.currentWishlistId, 'wines');

        this.closeModal('wishlistDetailModal');
        this.renderWishlist();
        this.showToast('Wine removed from wishlist');
    }

    // ============================
    // Drink Window Helpers
    // ============================

    getWineWindow(wine) {
        if (wine.drinkingWindow) return wine.drinkingWindow;
        if (wine.drinkFrom || wine.drinkUntil) {
            return this.mapLegacyDrinkWindow(wine.drinkFrom, wine.drinkUntil);
        }
        return null;
    }

    mapLegacyDrinkWindow(drinkFrom, drinkUntil) {
        if (!drinkFrom && !drinkUntil) return null;
        const from = drinkFrom || drinkUntil - 5;
        const until = drinkUntil || drinkFrom + 10;
        const range = until - from;
        return {
            canDrinkFrom: from - 2,
            bestFrom: from,
            peakFrom: Math.round(from + range * 0.3),
            peakUntil: Math.round(from + range * 0.7),
            bestUntil: until,
            canDrinkUntil: until + 3
        };
    }

    getDrinkStatus(wine) {
        const w = this.getWineWindow(wine);
        if (!w) return { status: 'unknown', label: null, class: '' };

        const now = new Date().getFullYear();
        if (now < w.canDrinkFrom) return { status: 'too-young', label: 'Too Young', class: 'dw-too-young' };
        if (now < w.bestFrom)     return { status: 'opening', label: 'Opening Up', class: 'dw-opening' };
        if (now < w.peakFrom)     return { status: 'ready', label: 'Ready', class: 'dw-ready' };
        if (now <= w.peakUntil)   return { status: 'peak', label: 'At Peak', class: 'dw-peak' };
        if (now <= w.bestUntil)   return { status: 'past-peak', label: 'Past Peak', class: 'dw-past-peak' };
        if (now <= w.canDrinkUntil) return { status: 'drink-soon', label: 'Drink Soon', class: 'dw-drink-soon' };
        return { status: 'decline', label: 'In Decline', class: 'dw-decline' };
    }

    getDrinkHint(wine) {
        const w = this.getWineWindow(wine);
        if (!w) return '';
        const now = new Date().getFullYear();
        const yearsToPeak = w.peakFrom - now;
        if (yearsToPeak > 0) return `${yearsToPeak} yr to peak`;
        if (now <= w.peakUntil) return 'drink now';
        if (now <= w.bestUntil) return 'drink soon';
        return 'past prime';
    }

    getDrinkWindowDisplay(wine) {
        const w = this.getWineWindow(wine);
        if (!w) return null;
        return `${w.bestFrom} — ${w.bestUntil}`;
    }

    renderDotTimeline(container, wine) {
        const w = this.getWineWindow(wine);
        if (!w) {
            container.innerHTML = '<span class="dw-no-data">No window data</span>';
            return;
        }

        const currentYear = new Date().getFullYear();
        const total = w.canDrinkUntil - w.canDrinkFrom;
        if (total <= 0) return;
        const pct = (year) => Math.max(0, Math.min(100, ((year - w.canDrinkFrom) / total) * 100));

        const status = this.getDrinkStatus(wine);
        const hint = this.getDrinkHint(wine);

        // Header row: status badge + hint
        const header = document.createElement('div');
        header.className = 'dw-header';
        header.innerHTML = `
            <span class="dw-status ${status.class}">${status.label}</span>
            <span class="dw-hint">${hint}</span>
        `;
        container.appendChild(header);

        // Timeline track
        const track = document.createElement('div');
        track.className = 'dw-track';

        // Best range band
        const bestLeft = pct(w.bestFrom);
        const bestWidth = pct(w.bestUntil) - bestLeft;
        track.innerHTML += `<div class="dw-best" style="left:${bestLeft}%;width:${bestWidth}%"></div>`;

        // Peak range band
        const peakLeft = pct(w.peakFrom);
        const peakWidth = pct(w.peakUntil) - peakLeft;
        track.innerHTML += `<div class="dw-peak-band" style="left:${peakLeft}%;width:${peakWidth}%"></div>`;

        // Milestone dots with year labels underneath
        const dots = [
            { year: w.canDrinkFrom, cls: 'minor' },
            { year: w.bestFrom, cls: 'minor' },
            { year: w.peakFrom, cls: 'pk' },
            { year: w.peakUntil, cls: 'pk' },
            { year: w.bestUntil, cls: 'minor' },
            { year: w.canDrinkUntil, cls: 'minor' },
        ];
        // Deduplicate dots at same year
        const seen = new Set();
        dots.forEach(d => {
            if (seen.has(d.year)) return;
            seen.add(d.year);
            track.innerHTML += `<div class="dw-dot ${d.cls}" style="left:${pct(d.year)}%"><span class="dw-dot-year">${d.year}</span></div>`;
        });

        // NOW diamond marker
        const clamped = Math.max(w.canDrinkFrom, Math.min(w.canDrinkUntil, currentYear));
        if (currentYear >= w.canDrinkFrom - 3 && currentYear <= w.canDrinkUntil + 5) {
            track.innerHTML += `<div class="dw-now" style="left:${pct(clamped)}%"><div class="dw-diamond"></div><div class="dw-stem"></div></div>`;
        }

        container.appendChild(track);
    }

    // ============================
    // Utilities
    // ============================

    showToast(message) {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');

        toastMessage.textContent = message;
        toast.classList.add('show');

        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.wineCellar = new WineCellar();
});
