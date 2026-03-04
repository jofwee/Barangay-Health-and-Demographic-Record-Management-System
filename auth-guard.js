// ──────────────────────────────────────────────────────────
// Auth Guard — loads user profile into sidebar & protects pages
// Include Firebase SDKs + firebase-config.js BEFORE this script.
//
// Usage: add data-auth-role="staff" or data-auth-role="bhw" on <body>
//        to restrict the page to that role.
// ──────────────────────────────────────────────────────────

(function () {
    const requiredRole = document.body.getAttribute('data-auth-role'); // "staff", "bhw", "admin", or null

    // ── Hide page until auth is verified (prevents content flash) ──
    if (requiredRole) {
        const antiFlash = document.createElement('style');
        antiFlash.id = 'auth-guard-antiflash';
        antiFlash.textContent = '.dashboard{opacity:0;pointer-events:none;transition:opacity .2s}';
        document.head.appendChild(antiFlash);
    }
    function revealPage() {
        const af = document.getElementById('auth-guard-antiflash');
        if (af) {
            document.querySelector('.dashboard').style.opacity = '1';
            document.querySelector('.dashboard').style.pointerEvents = '';
            setTimeout(() => af.remove(), 300);
        }
    }

    // ── Instant UI fill from cache (no flicker) ────────
    const roleLabels = {
        staff: 'Barangay Staff',
        bhw: 'Barangay Health Worker',
        admin: 'Administrator'
    };

    function populateUI(fullName, email, role) {
        const sidebarName = document.querySelector('.profile-card h2');
        const sidebarRole = document.querySelector('.profile-card p');
        if (sidebarName) sidebarName.textContent = fullName;
        if (sidebarRole) sidebarRole.textContent = roleLabels[role] || role;

        const userPill = document.querySelector('.user-pill span');
        if (userPill) {
            const initials = fullName
                .split(' ')
                .map(w => w[0])
                .join('')
                .substring(0, 2)
                .toUpperCase();
            userPill.textContent = initials;
        }

        const bannerName = document.querySelector('.profile-banner__info h2');
        const bannerEmail = document.querySelector('.profile-banner__info p');
        const bannerRole = document.querySelector('.profile-banner__role');
        const bannerAvatar = document.querySelector('.profile-banner__avatar img');
        if (bannerName) bannerName.textContent = fullName;
        if (bannerEmail) bannerEmail.textContent = email;
        if (bannerRole) bannerRole.textContent = roleLabels[role] || role;
        if (bannerAvatar) bannerAvatar.alt = fullName;
    }

    // Pre-fill from sessionStorage so the name & avatar never flicker
    const cached = JSON.parse(sessionStorage.getItem('authUser') || 'null');
    if (cached) {
        populateUI(cached.fullName, cached.email, cached.role);

        // Show admin nav item immediately from cache
        if (cached.role === 'admin') {
            const adminNav = document.getElementById('adminNavItem');
            if (adminNav) adminNav.style.display = '';
        }

        // Restore cached avatar immediately
        const cachedAvatar = sessionStorage.getItem('authAvatar');
        if (cachedAvatar) {
            const sidebarImg = document.querySelector('.profile-card img');
            const bannerImg = document.querySelector('.profile-banner__avatar img');
            if (sidebarImg) sidebarImg.src = cachedAvatar;
            if (bannerImg) bannerImg.src = cachedAvatar;
        }

        // Reveal immediately from cache if role matches (don't wait for Firebase)
        if (!requiredRole ||
            cached.role === requiredRole ||
            (requiredRole === 'staff' && cached.role === 'admin')) {
            revealPage();
        }
    }

    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            // Not logged in — redirect to home
            window.location.href = 'index.html';
            return;
        }

        try {
            const doc = await db.collection('users').doc(user.uid).get();
            if (!doc.exists) {
                auth.signOut();
                window.location.href = 'index.html';
                return;
            }

            const data = doc.data();
            const role = data.role;         // "staff", "bhw", or "admin"
            const fullName = data.fullName || user.displayName || 'User';
            const email = data.email || user.email || '';

            // Role check — admin can access staff pages AND admin-only pages
            if (requiredRole) {
                const allowed =
                    role === requiredRole ||
                    (requiredRole === 'staff' && role === 'admin');

                if (!allowed) {
                    // Redirect to their correct dashboard instead of signing out
                    if (role === 'bhw') {
                        window.location.href = 'bhw-dashboard.html';
                    } else if (role === 'staff') {
                        window.location.href = 'staff-dashboard.html';
                    } else {
                        auth.signOut();
                        window.location.href = 'index.html';
                    }
                    return;
                }
            }

            // ── Cache & populate UI ────────────────────
            sessionStorage.setItem('authUser', JSON.stringify({ fullName, email, role }));
            populateUI(fullName, email, role);

            // ── Show admin-only nav item if admin ──
            if (role === 'admin') {
                const adminNav = document.getElementById('adminNavItem');
                if (adminNav) adminNav.style.display = '';
            }

            // ── Load avatar into sidebar & banner (+ cache) ──
            if (data.photoURL) {
                const sidebarImg = document.querySelector('.profile-card img');
                const bannerImg = document.querySelector('.profile-banner__avatar img');
                if (sidebarImg) sidebarImg.src = data.photoURL;
                if (bannerImg) bannerImg.src = data.photoURL;
                sessionStorage.setItem('authAvatar', data.photoURL);
            }

            // ── Reveal the page now that auth is confirmed ──
            revealPage();

            // ── Log login activity (once per session) ──
            if (!sessionStorage.getItem('loginLogged')) {
                sessionStorage.setItem('loginLogged', '1');
                db.collection('activityLogs').add({
                    userEmail: email,
                    action: 'Logged in',
                    location: 'Authentication',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                }).catch(() => {});
            }

        } catch (err) {
            console.error('Auth guard error:', err);
        }
    });

    // ── Wire user-pill button to navigate to profile ──
    const userPillBtn = document.querySelector('.user-pill');
    if (userPillBtn) {
        userPillBtn.style.cursor = 'pointer';
        userPillBtn.addEventListener('click', () => {
            const cachedUser = JSON.parse(sessionStorage.getItem('authUser') || '{}');
            const role = cachedUser.role || '';
            if (role === 'bhw') {
                window.location.href = 'bhw-profile.html';
            } else {
                window.location.href = 'staff-profile.html';
            }
        });
    }

    // ── Logout handler ─────────────────────────────────
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            auth.signOut().then(() => {
                sessionStorage.removeItem('authUser');
                sessionStorage.removeItem('authAvatar');
                window.location.href = 'index.html';
            });
        });
    }
})();
