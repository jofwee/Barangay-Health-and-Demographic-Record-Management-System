// ──────────────────────────────────────────────────────────
// Auth Guard — loads user profile into sidebar & protects pages
// Include Firebase SDKs + firebase-config.js BEFORE this script.
//
// Usage: add data-auth-role="staff" or data-auth-role="bhw" on <body>
//        to restrict the page to that role.
// ──────────────────────────────────────────────────────────

(function () {
    const requiredRole = document.body.getAttribute('data-auth-role'); // "staff", "bhw", or null

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

        // Restore cached avatar immediately
        const cachedAvatar = sessionStorage.getItem('authAvatar');
        if (cachedAvatar) {
            const sidebarImg = document.querySelector('.profile-card img');
            const bannerImg = document.querySelector('.profile-banner__avatar img');
            if (sidebarImg) sidebarImg.src = cachedAvatar;
            if (bannerImg) bannerImg.src = cachedAvatar;
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

            // Role check — admin can access staff pages too
            if (requiredRole) {
                const allowed =
                    role === requiredRole ||
                    (requiredRole === 'staff' && role === 'admin');

                if (!allowed) {
                    auth.signOut();
                    window.location.href = 'index.html';
                    return;
                }
            }

            // ── Cache & populate UI ────────────────────
            sessionStorage.setItem('authUser', JSON.stringify({ fullName, email, role }));
            populateUI(fullName, email, role);

            // ── Load avatar into sidebar & banner (+ cache) ──
            if (data.photoURL) {
                const sidebarImg = document.querySelector('.profile-card img');
                const bannerImg = document.querySelector('.profile-banner__avatar img');
                if (sidebarImg) sidebarImg.src = data.photoURL;
                if (bannerImg) bannerImg.src = data.photoURL;
                sessionStorage.setItem('authAvatar', data.photoURL);
            }

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
