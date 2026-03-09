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
        const displayName = (fullName && fullName.trim()) || (email ? email.split('@')[0] : 'User');
        const sidebarName = document.querySelector('.profile-card h2');
        const sidebarRole = document.querySelector('.profile-card p');
        if (sidebarName) sidebarName.textContent = displayName;
        if (sidebarRole) sidebarRole.textContent = roleLabels[role] || role;



        const bannerName = document.querySelector('.profile-banner__info h2');
        const bannerEmail = document.querySelector('.profile-banner__info p');
        const bannerRole = document.querySelector('.profile-banner__role');
        const bannerAvatar = document.querySelector('.profile-banner__avatar img');
        if (bannerName) bannerName.textContent = displayName;
        if (bannerEmail) bannerEmail.textContent = email;
        if (bannerRole) bannerRole.textContent = roleLabels[role] || role;
        if (bannerAvatar) bannerAvatar.alt = displayName;
    }

    // Pre-fill from sessionStorage so the name & avatar never flicker
    const cached = JSON.parse(sessionStorage.getItem('authUser') || 'null');
    if (cached) {
        populateUI(cached.fullName, cached.email, cached.role);

        // Build admin sidebar from cache
        if (cached.role === 'admin') {
            buildAdminSidebar();
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
            (requiredRole === 'staff' && cached.role === 'admin') ||
            (requiredRole === 'bhw' && cached.role === 'admin')) {
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
            const fullName = (data.fullName && data.fullName.trim()) || user.displayName || (user.email ? user.email.split('@')[0] : 'User');
            const email = data.email || user.email || '';

            // Role check — admin can access staff, bhw, AND admin-only pages
            if (requiredRole) {
                const allowed =
                    role === requiredRole ||
                    (requiredRole === 'staff' && role === 'admin') ||
                    (requiredRole === 'bhw' && role === 'admin');

                if (!allowed) {
                    // Redirect to their correct dashboard instead of signing out
                    if (role === 'bhw') {
                        window.location.href = 'bhw-dashboard.html';
                    } else if (role === 'staff' || role === 'admin') {
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

            // ── Build full admin sidebar ──
            if (role === 'admin') {
                buildAdminSidebar();
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

    // ── Build admin sidebar (replaces nav with full combined items) ──
    function buildAdminSidebar() {
        const sidebarNav = document.querySelector('.sidebar-nav');
        if (!sidebarNav) return;

        // Fix profile link for admin
        const profileLink = document.querySelector('.profile-link');
        if (profileLink) profileLink.href = 'staff-profile.html';

        const currentPage = window.location.pathname.split('/').pop() || 'staff-dashboard.html';

        const navItems = [
            {
                href: 'staff-dashboard.html',
                label: 'Dashboard',
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>'
            },
            {
                href: 'medicine-inventory.html',
                label: 'Medicine Inventory',
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h4a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z"/><path d="M7 12h8"/><path d="M15 6h2a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-2"/></svg>'
            },
            {
                href: 'staff-residents.html',
                label: "Residents' Management",
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="7" r="3"/><path d="M3 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="18" cy="8" r="2.5"/><path d="M21 20v-1.5a3 3 0 0 0-3-3h-.5"/></svg>'
            },
            {
                href: 'residents-maintenance.html',
                label: "Residents' Maintenance",
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="6" r="3"/><path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><rect x="3" y="10" width="5" height="7" rx="1.2"/><path d="M5.5 11.5v4"/><path d="M4 13.5h3"/></svg>'
            },
            {
                href: 'staff-about.html',
                label: 'About',
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h0"/></svg>'
            },
            {
                href: 'admin-accounts.html',
                label: 'Account Requests',
                classes: 'nav-item--admin',
                id: 'adminNavItem',
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8l2 2 4-4"/></svg>'
            }
        ];

        sidebarNav.innerHTML = '';
        navItems.forEach(function(item) {
            var a = document.createElement('a');
            a.href = item.href;
            a.className = 'nav-item' + (item.classes ? ' ' + item.classes : '') + (currentPage === item.href ? ' is-active' : '');
            if (item.id) a.id = item.id;
            a.title = item.label;
            a.innerHTML = '<span class="nav-item__icon" aria-hidden="true">' + item.icon + '</span><span class="nav-item__label">' + item.label + '</span>';
            sidebarNav.appendChild(a);
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
