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

        // Sort state
        this.sortBy = 'recent'; // 'recent' or 'drinkability'

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
            this.updateSyncStatus('connecting');

            // Handle redirect result (for mobile sign-in)
            try {
                const result = await firebase.auth().getRedirectResult();
                if (result.user) {
                    console.log('Redirect sign-in successful:', result.user.displayName);
                    this.showToast(`Ingelogd als ${result.user.displayName}`);
                }
            } catch (redirectError) {
                console.error('Redirect result error:', redirectError);
                // Don't show error for initial page load (no redirect pending)
                if (redirectError.code !== 'auth/null-user') {
                    this.showToast('Inloggen mislukt: ' + redirectError.message);
                }
            }

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

            // Check if we're on a mobile device - use redirect for better compatibility
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

            if (isMobile) {
                // Use redirect for mobile (more reliable on iOS Safari)
                await firebase.auth().signInWithRedirect(provider);
                // Note: page will redirect, result handled in initFirebase
            } else {
                // Use popup for desktop (faster UX)
                const result = await firebase.auth().signInWithPopup(provider);
                this.showToast(`Ingelogd als ${result.user.displayName}`);
            }
        } catch (error) {
            console.error('Google sign-in error:', error);
            if (error.code !== 'auth/popup-closed-by-user') {
                this.showToast('Inloggen mislukt: ' + error.message);
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
            btn.textContent = 'Registreren';
            toggleBtn.innerHTML = 'Al een account? <span>Inloggen</span>';
            forgotBtn.style.display = 'none';
        } else {
            btn.textContent = 'Inloggen';
            toggleBtn.innerHTML = 'Nog geen account? <span>Registreren</span>';
            forgotBtn.style.display = 'block';
        }
    }

    async handleEmailAuth(e) {
        e.preventDefault();

        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            this.showToast('Vul e-mailadres en wachtwoord in');
            return;
        }

        this.updateSyncStatus('connecting');

        try {
            if (this.isRegisterMode) {
                // Register new user
                const result = await firebase.auth().createUserWithEmailAndPassword(email, password);
                this.showToast('Account aangemaakt!');
                console.log('User registered:', result.user.email);
            } else {
                // Sign in existing user
                const result = await firebase.auth().signInWithEmailAndPassword(email, password);
                this.showToast(`Ingelogd als ${result.user.email}`);
                console.log('User signed in:', result.user.email);
            }
        } catch (error) {
            console.error('Email auth error:', error);
            this.updateSyncStatus('disconnected');

            // User-friendly error messages in Dutch
            const errorMessages = {
                'auth/email-already-in-use': 'Dit e-mailadres is al in gebruik',
                'auth/invalid-email': 'Ongeldig e-mailadres',
                'auth/operation-not-allowed': 'Email/wachtwoord login is niet ingeschakeld',
                'auth/weak-password': 'Wachtwoord moet minimaal 6 tekens zijn',
                'auth/user-disabled': 'Dit account is uitgeschakeld',
                'auth/user-not-found': 'Geen account gevonden met dit e-mailadres',
                'auth/wrong-password': 'Onjuist wachtwoord',
                'auth/invalid-credential': 'Ongeldige inloggegevens',
                'auth/too-many-requests': 'Te veel pogingen. Probeer later opnieuw'
            };

            const message = errorMessages[error.code] || error.message;
            this.showToast(message);
        }
    }

    async handleForgotPassword() {
        const email = document.getElementById('loginEmail').value.trim();

        if (!email) {
            this.showToast('Vul eerst je e-mailadres in');
            return;
        }

        try {
            await firebase.auth().sendPasswordResetEmail(email);
            this.showToast('Wachtwoord reset e-mail verstuurd!');
        } catch (error) {
            console.error('Password reset error:', error);

            const errorMessages = {
                'auth/invalid-email': 'Ongeldig e-mailadres',
                'auth/user-not-found': 'Geen account gevonden met dit e-mailadres'
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
            }
            await firebase.auth().signOut();
            this.firebaseEnabled = false;
            this.userId = null;
            this.wines = [];
            this.archive = [];
            this.renderWineList();
            this.updateStats();
            this.showToast('Uitgelogd');
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
        const searchContainer = document.getElementById('searchContainer');

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
            if (searchContainer) searchContainer.classList.add('hidden');
        }
    }

    updateAuthUI(user) {
        const userInfo = document.getElementById('userInfo');
        const signInBtn = document.getElementById('googleSignInBtn');
        const signOutBtn = document.getElementById('signOutBtn');

        if (user && !user.isAnonymous) {
            // User is signed in with Google
            if (userInfo) {
                userInfo.innerHTML = `✓ Ingelogd als <strong>${user.displayName || user.email}</strong>`;
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

        const statusMap = {
            'local': { icon: '💾', text: 'Lokale opslag', class: 'status-local', settingsText: 'Niet geconfigureerd - Data wordt alleen lokaal opgeslagen' },
            'connecting': { icon: '🔄', text: 'Verbinden...', class: 'status-connecting', settingsText: 'Verbinden met cloud...' },
            'synced': { icon: '☁️', text: 'Cloud sync', class: 'status-synced', settingsText: '✓ Verbonden - Je wijnen worden automatisch gesynchroniseerd' },
            'syncing': { icon: '🔄', text: 'Syncing...', class: 'status-syncing', settingsText: 'Synchroniseren...' },
            'error': { icon: '⚠️', text: 'Sync error', class: 'status-error', settingsText: '⚠️ Synchronisatie fout - Probeer later opnieuw' },
            'disconnected': { icon: '📴', text: 'Offline', class: 'status-disconnected', settingsText: 'Offline - Data wordt lokaal opgeslagen' }
        };

        const s = statusMap[status] || statusMap['local'];

        if (statusEl) {
            statusEl.innerHTML = `<span class="${s.class}">${s.icon} ${s.text}</span>`;
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

        // Sort functionality
        document.getElementById('sortSelect')?.addEventListener('change', (e) => {
            this.sortBy = e.target.value;
            this.sortAndRenderWines();
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

        // Image upload
        document.getElementById('imagePreview')?.addEventListener('click', () => {
            document.getElementById('galleryInput')?.click();
        });

        document.getElementById('cameraBtn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('cameraInput')?.click();
        });

        document.getElementById('galleryBtn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('galleryInput')?.click();
        });

        document.getElementById('cameraInput')?.addEventListener('change', (e) => this.handleImageUpload(e));
        document.getElementById('galleryInput')?.addEventListener('change', (e) => this.handleImageUpload(e));

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

        // Archive modal - Star rating (5 stars)
        document.querySelectorAll('#archiveRating .star').forEach(star => {
            star.addEventListener('click', () => this.setArchiveRating(parseInt(star.dataset.rating)));
            star.addEventListener('mouseenter', () => this.previewRating(parseInt(star.dataset.rating)));
            star.addEventListener('mouseleave', () => this.previewRating(0));
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
        document.getElementById(modalId).classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
        document.body.style.overflow = '';

        if (modalId === 'addModal') {
            this.resetForm();
        }
    }

    openAddModal() {
        this.editMode = false;
        this.currentWineId = null;
        this.resetForm();
        document.querySelector('#addModal .modal-header h2').textContent = 'Add Wine';
        document.querySelector('#addModal .submit-btn').textContent = 'Add to Cellar';
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

        this.compressImage(file, (compressedImageData) => {
            this.currentImage = compressedImageData;

            const preview = document.getElementById('previewImg');
            preview.src = compressedImageData;
            document.getElementById('imagePreview').classList.add('has-image');

            this.analyzeWineLabel(compressedImageData);
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
            indicatorText.textContent = 'AI niet beschikbaar - demo modus...';
            setTimeout(() => {
                indicator.classList.add('hidden');
                const wineData = this.generateDemoWineData();
                this.populateForm(wineData);
                this.showToast('Demo modus: Cloud Functions nog niet geconfigureerd');
            }, 1500);
            return;
        }

        indicatorText.textContent = 'Wijn analyseren met AI...';

        try {
            const wineData = await this.callChatGPTVision(imageData);

            // Consistente naamgeving: vergelijk met bestaande wijnen in kelder
            const existingWine = this.matchExistingWine(wineData);
            if (existingWine) {
                wineData.name = existingWine.name;
                wineData.producer = existingWine.producer;
                console.log('🔄 Naam overgenomen van bestaande wijn:', existingWine.name, existingWine.producer);
            }

            // Als jaartal ontbreekt, vraag de gebruiker
            if (!wineData.year) {
                indicator.classList.add('hidden');
                const userYear = await this.promptForYear();
                if (userYear) {
                    wineData.year = userYear;
                }
            }

            // Auto-save: sla wijn direct op en sluit modal
            indicator.classList.add('hidden');

            const enrichId = Date.now().toString();
            const chars = wineData.characteristics || {};
            const drinkWindow = wineData.year ? this.estimateDrinkWindow(wineData) : {};
            const savedWine = {
                id: enrichId,
                enrichId: enrichId,
                name: wineData.name || 'Onbekende wijn',
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
                drinkFrom: wineData.drinkFrom || drinkWindow.from || null,
                drinkUntil: wineData.drinkUntil || drinkWindow.until || null,
                notes: wineData.notes || null,
                image: this.currentImage,
                addedAt: new Date().toISOString()
            };

            this.wines.unshift(savedWine);
            this.saveWines();
            this.renderWineList();
            this.updateStats();
            this.closeModal('addModal');
            this.showToast('Wijn herkend en opgeslagen!');

            // Start prijs + foto ophalen op de achtergrond
            this.enrichWineInBackground(enrichId, wineData);

        } catch (error) {
            console.error('Vision API error:', error);
            indicator.classList.add('hidden');

            if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                this.showToast('Niet geautoriseerd. Log opnieuw in.');
            } else if (error.message.includes('429')) {
                this.showToast('Te veel verzoeken. Probeer het later.');
            } else if (error.message.includes('not configured')) {
                this.showToast('AI service niet geconfigureerd.');
            } else {
                this.showToast('Kan afbeelding niet analyseren. Voer handmatig in.');
            }
        }
    }

    async enrichWineInBackground(enrichId, wineData) {
        console.log('🔄 Background enrichment started for:', wineData.name);

        // Track welke wijn we verrijken
        this.backgroundProcessing.set(enrichId, { price: true, image: true });
        this.renderWineList(); // Toon spinner als wijn al opgeslagen is

        // Prijs en foto parallel ophalen
        const pricePromise = wineData.name ? this.lookupWinePrice(wineData).catch(e => {
            console.log('Background price lookup failed:', e);
            return null;
        }) : Promise.resolve(null);

        const imagePromise = wineData.name ? this.searchWineImage(wineData).catch(e => {
            console.log('Background image search failed:', e);
            return null;
        }) : Promise.resolve(null);

        // Prijs verwerken wanneer klaar
        pricePromise.then(priceData => {
            const proc = this.backgroundProcessing.get(enrichId);
            if (proc) proc.price = false;

            if (priceData && priceData.price) {
                const roundedPrice = Math.round(priceData.price);
                console.log('💰 Prijs gevonden (achtergrond):', roundedPrice);
                this.updateSavedWine(enrichId, { price: roundedPrice });
            }
            this.checkEnrichmentDone(enrichId);
        });

        // Foto verwerken wanneer klaar
        imagePromise.then(imageBase64 => {
            const proc = this.backgroundProcessing.get(enrichId);
            if (proc) proc.image = false;

            if (imageBase64) {
                console.log('🖼️ Productfoto gevonden (achtergrond)');
                this.updateSavedWine(enrichId, { image: imageBase64 });
            }
            this.checkEnrichmentDone(enrichId);
        });
    }

    updateSavedWine(enrichId, updates) {
        // Zoek wijn met dit enrichId
        const wine = this.wines.find(w => w.enrichId === enrichId);
        if (!wine) return;

        Object.assign(wine, updates);
        this.saveWines();
        this.renderWineList();
    }

    checkEnrichmentDone(enrichId) {
        const proc = this.backgroundProcessing.get(enrichId);
        if (proc && !proc.price && !proc.image) {
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

            return result.data;
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

            return result.data?.imageBase64 || null;
        } catch (error) {
            console.error('Image search error:', error);
            return null;
        }
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

    promptForYear() {
        return new Promise((resolve) => {
            const modal = document.getElementById('yearModal');
            const input = document.getElementById('yearInput');
            const confirmBtn = document.getElementById('yearConfirmBtn');
            const skipBtn = document.getElementById('yearSkipBtn');

            input.value = '';
            modal.classList.add('active');
            setTimeout(() => input.focus(), 350); // Wait for modal animation

            const cleanup = () => {
                modal.classList.remove('active');
                confirmBtn.onclick = null;
                skipBtn.onclick = null;
            };

            confirmBtn.onclick = () => {
                const year = parseInt(input.value);
                cleanup();
                resolve(year && year >= 1900 && year <= 2099 ? year : null);
            };

            skipBtn.onclick = () => {
                cleanup();
                resolve(null);
            };
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
        // Use Cloud Function for API call (keys are stored securely on server)
        if (!CONFIG.FUNCTIONS?.analyzeWineLabel) {
            throw new Error('Cloud Functions not configured');
        }

        const idToken = await this.getIdToken();
        if (!idToken) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(CONFIG.FUNCTIONS.analyzeWineLabel, {
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

        return result.data;
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

        if (this.editMode) {
            const index = this.wines.findIndex(w => w.id === this.currentWineId);
            if (index !== -1) this.wines[index] = wineData;
            this.showToast('Wine updated!');
        } else {
            this.wines.unshift(wineData);
            this.showToast('Wine added to cellar!');
        }

        this.saveWines();
        this.renderWineList();
        this.updateStats();
        this.closeModal('addModal');
    }

    // ============================
    // Search Functionality
    // ============================

    updateSearchVisibility() {
        const searchContainer = document.getElementById('searchContainer');
        const sortBar = document.getElementById('sortBar');
        if (this.wines.length > 0) {
            searchContainer?.classList.remove('hidden');
            sortBar?.classList.remove('hidden');
        } else {
            searchContainer?.classList.add('hidden');
            sortBar?.classList.add('hidden');
        }
    }

    sortAndRenderWines() {
        // Sort wines based on current sort option
        if (this.sortBy === 'drinkability') {
            // Sort by drinkability: wines that are ready now first, then by urgency
            this.wines.sort((a, b) => {
                const statusA = this.getDrinkStatus(a);
                const statusB = this.getDrinkStatus(b);

                // Priority order: perfect > soon > early > past > unknown
                const priority = { perfect: 0, soon: 1, early: 2, past: 3, unknown: 4 };
                const prioA = priority[statusA.status];
                const prioB = priority[statusB.status];

                if (prioA !== prioB) {
                    return prioA - prioB;
                }

                // Within same status, sort by drinkUntil (earliest first for perfect/soon)
                if (statusA.status === 'perfect' || statusA.status === 'soon') {
                    return (a.drinkUntil || 9999) - (b.drinkUntil || 9999);
                }

                // For early wines, sort by drinkFrom (soonest first)
                if (statusA.status === 'early') {
                    return (a.drinkFrom || 9999) - (b.drinkFrom || 9999);
                }

                // Default: by addedAt
                return new Date(b.addedAt) - new Date(a.addedAt);
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
        const winesToShow = this.searchQuery ? this.filteredWines : this.wines;

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
                                : `<div class="placeholder-image ${wine.type}">🍷</div>`
                            }
                        </div>
                        <div class="wine-card-info">
                            <h3 class="wine-card-name">${this.highlightMatch(wine.name)}</h3>
                            ${wine.producer ? `<p class="wine-card-producer">${this.highlightMatch(wine.producer)}</p>` : ''}
                            <p class="wine-card-meta">${this.highlightMatch([wine.grape, wine.year].filter(Boolean).join(' · ') || wine.region || 'No details')}</p>
                            <div class="wine-card-footer">
                                <span class="wine-type-tag ${wine.type}">${wine.type}</span>
                                ${wine.price ? `<span class="wine-price-tag">€${wine.price}</span>` : ''}
                                ${isProcessing ? '<span class="wine-enriching-tag"><span class="enriching-spinner"></span>verrijken...</span>' : ''}
                                ${drinkStatus.label ? `<span class="wine-drink-status ${drinkStatus.class}">${drinkStatus.label}</span>` : ''}
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
                        this.openDetailModal(container.dataset.id);
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

        const detailImage = document.getElementById('detailImage');
        if (wine.image) {
            detailImage.innerHTML = `<img src="${wine.image}" alt="${wine.name}"><div class="wine-type-badge">${wine.type}</div>`;
        } else {
            detailImage.innerHTML = `<div class="placeholder-bg ${wine.type}"><span style="font-size: 3rem;">🍷</span></div><div class="wine-type-badge">${wine.type}</div>`;
        }

        document.getElementById('detailName').textContent = wine.name;

        const producerEl = document.getElementById('detailProducer');
        if (wine.producer) {
            producerEl.textContent = wine.producer;
            producerEl.style.display = 'block';
        } else {
            producerEl.style.display = 'none';
        }

        document.getElementById('detailRegion').textContent = wine.region || 'Region not specified';
        document.getElementById('detailYear').textContent = wine.year || '—';
        document.getElementById('detailGrape').textContent = wine.grape || '—';
        document.getElementById('detailPrice').textContent = wine.price ? `€${wine.price.toFixed(2)}` : '—';

        document.getElementById('detailBoldness').style.width = `${wine.boldness * 20}%`;
        document.getElementById('detailTannins').style.width = `${wine.tannins * 20}%`;
        document.getElementById('detailAcidity').style.width = `${wine.acidity * 20}%`;

        // Drink window
        const drinkWindowSection = document.getElementById('detailDrinkWindowSection');
        const drinkWindowDisplay = this.getDrinkWindowDisplay(wine);
        if (drinkWindowDisplay) {
            drinkWindowSection.style.display = 'block';
            document.getElementById('detailDrinkWindow').textContent = drinkWindowDisplay;

            const drinkStatus = this.getDrinkStatus(wine);
            const statusBadge = document.getElementById('detailDrinkStatus');
            if (drinkStatus.label) {
                statusBadge.textContent = drinkStatus.label;
                statusBadge.className = `drink-status-badge ${drinkStatus.class}`;
                statusBadge.style.display = 'inline-block';
            } else {
                statusBadge.style.display = 'none';
            }
        } else {
            drinkWindowSection.style.display = 'none';
        }

        const storeSection = document.getElementById('detailStoreSection');
        const storeText = document.getElementById('detailStore');
        if (wine.store) {
            storeSection.style.display = 'flex';
            storeText.textContent = wine.store;
        } else {
            storeSection.style.display = 'none';
        }

        const notesSection = document.getElementById('detailNotesSection');
        const notesText = document.getElementById('detailNotes');
        if (wine.notes) {
            notesSection.style.display = 'block';
            notesText.textContent = wine.notes;
        } else {
            notesSection.style.display = 'none';
        }

        document.getElementById('detailQuantity').textContent = wine.quantity;
        this.openModal('detailModal');
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
    // Edit Wine
    // ============================

    editCurrentWine() {
        const wine = this.wines.find(w => w.id === this.currentWineId);
        if (!wine) return;

        this.closeModal('detailModal');

        setTimeout(() => {
            this.editMode = true;
            document.querySelector('#addModal .modal-header h2').textContent = 'Edit Wine';
            document.querySelector('#addModal .submit-btn').textContent = 'Save Changes';

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

        // Reset archive modal state
        this.archiveRating = 0;
        this.archiveRebuy = null;

        // Update UI
        document.getElementById('archiveWineName').textContent = wine.producer
            ? `${wine.name} - ${wine.producer}`
            : wine.name;

        // Reset stars
        document.querySelectorAll('#archiveRating .star').forEach(star => {
            star.classList.remove('active', 'hover');
        });
        document.getElementById('ratingLabel').textContent = 'Selecteer een beoordeling';

        // Reset rebuy buttons
        document.querySelectorAll('#rebuyOptions .rebuy-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Clear notes
        document.getElementById('archiveNotes').value = '';

        this.openModal('archiveModal');
    }

    setArchiveRating(rating) {
        this.archiveRating = rating;
        // Labels for 5-star ratings
        const labels = {
            0: 'Selecteer een beoordeling',
            1: 'Slecht',
            2: 'Matig',
            3: 'Goed',
            4: 'Heel goed',
            5: 'Uitstekend!'
        };
        document.getElementById('ratingLabel').textContent = labels[rating] || '';
        this.updateStarDisplay(rating, 'active');
    }

    previewRating(rating) {
        if (rating === 0) {
            // Reset to actual rating
            this.clearStarClass('hover');
            this.updateStarDisplay(this.archiveRating, 'active');
        } else {
            this.updateStarDisplay(rating, 'hover');
        }
    }

    updateStarDisplay(rating, className) {
        document.querySelectorAll('#archiveRating .star').forEach(star => {
            const starRating = parseInt(star.dataset.rating);
            star.classList.toggle(className, starRating <= rating);
        });
    }

    clearStarClass(className) {
        document.querySelectorAll('#archiveRating .star').forEach(star => {
            star.classList.remove(className);
        });
    }

    // Helper to generate star display string
    getStarDisplay(rating) {
        const fullStars = Math.round(rating);
        const emptyStars = 5 - fullStars;
        return '★'.repeat(fullStars) + '☆'.repeat(emptyStars);
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
            // Just delete without archiving
            await this.deleteCurrentWine();
            this.closeModal('archiveModal');
            this.showToast('Wijn verwijderd');
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
        statsEl.textContent = `${this.filteredArchive.length} wijn${this.filteredArchive.length !== 1 ? 'en' : ''}`;

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
                    <p>Geen wijnen gevonden</p>
                </div>
            `;
            return;
        }

        list.innerHTML = this.filteredArchive.map(wine => {
            const stars = this.getStarDisplay(wine.rating || 0);
            const rebuyLabels = { yes: 'Opnieuw', maybe: 'Misschien', no: 'Niet meer' };
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
                            <span>Verwijder</span>
                        </div>
                    </div>
                    <div class="swipe-content">
                        <div class="archive-card">
                            <div class="archive-card-image">
                                ${wine.image
                                    ? `<img src="${wine.image}" alt="${wine.name}">`
                                    : `<div class="placeholder-image ${wine.type}">🍷</div>`
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

        // Image
        const detailImage = document.getElementById('archiveDetailImage');
        if (wine.image) {
            detailImage.innerHTML = `<img src="${wine.image}" alt="${wine.name}"><div class="wine-type-badge">${wine.type}</div>`;
        } else {
            detailImage.innerHTML = `<div class="placeholder-bg ${wine.type}"><span style="font-size: 3rem;">🍷</span></div><div class="wine-type-badge">${wine.type}</div>`;
        }

        // Basic info
        document.getElementById('archiveDetailName').textContent = wine.name;

        const producerEl = document.getElementById('archiveDetailProducer');
        if (wine.producer) {
            producerEl.textContent = wine.producer;
            producerEl.style.display = 'block';
        } else {
            producerEl.style.display = 'none';
        }

        document.getElementById('archiveDetailRegion').textContent = wine.region || 'Regio onbekend';

        // Rating display (supports half-stars)
        const starsEl = document.getElementById('archiveDetailStars');
        if (wine.rating) {
            const fullStars = Math.floor(wine.rating);
            const hasHalf = wine.rating % 1 !== 0;
            const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
            const filledPart = '★'.repeat(fullStars) + (hasHalf ? '⯨' : '');
            const emptyPart = '☆'.repeat(emptyStars);
            starsEl.innerHTML = `<span>${filledPart}</span><span class="empty">${emptyPart}</span>`;
            starsEl.parentElement.style.display = 'flex';
        } else {
            starsEl.parentElement.style.display = 'none';
        }

        // Rebuy badge
        const rebuyEl = document.getElementById('archiveDetailRebuy');
        if (wine.rebuy) {
            const rebuyConfig = {
                yes: { icon: '👍', text: 'Opnieuw kopen', class: 'yes' },
                maybe: { icon: '🤔', text: 'Misschien', class: 'maybe' },
                no: { icon: '👎', text: 'Niet meer', class: 'no' }
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
        document.getElementById('archiveDetailPrice').textContent = wine.price ? `€${wine.price.toFixed(2)}` : '—';

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
        this.showToast('Wijn teruggezet naar kelder!');
    }

    async deleteFromArchiveConfirm() {
        if (!confirm('Weet je zeker dat je deze wijn definitief wilt verwijderen uit het archief?')) {
            return;
        }

        await this.deleteFromArchive(this.currentArchiveId);
        this.filterAndRenderArchive();

        this.closeModal('archiveDetailModal');
        this.showToast('Wijn verwijderd uit archief');
    }

    // ============================
    // Drink Window Helpers
    // ============================

    getDrinkStatus(wine) {
        if (!wine.drinkFrom && !wine.drinkUntil) {
            return { status: 'unknown', label: null, class: '' };
        }

        const currentYear = new Date().getFullYear();
        const drinkFrom = wine.drinkFrom || currentYear;
        const drinkUntil = wine.drinkUntil || currentYear + 50;

        if (currentYear < drinkFrom) {
            const yearsToWait = drinkFrom - currentYear;
            return {
                status: 'early',
                label: yearsToWait === 1 ? 'Nog 1 jaar' : `Nog ${yearsToWait} jaar`,
                class: 'status-early'
            };
        } else if (currentYear > drinkUntil) {
            return { status: 'past', label: 'Voorbij optimum', class: 'status-past' };
        } else if (currentYear >= drinkUntil - 1) {
            return { status: 'soon', label: 'Binnenkort drinken', class: 'status-soon' };
        } else {
            return { status: 'perfect', label: 'Nu perfect', class: 'status-perfect' };
        }
    }

    getDrinkWindowDisplay(wine) {
        if (!wine.drinkFrom && !wine.drinkUntil) {
            return null;
        }
        if (wine.drinkFrom && wine.drinkUntil) {
            return `${wine.drinkFrom} — ${wine.drinkUntil}`;
        }
        if (wine.drinkFrom) {
            return `Vanaf ${wine.drinkFrom}`;
        }
        return `Tot ${wine.drinkUntil}`;
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
