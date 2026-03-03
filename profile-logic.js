// profile-logic.js — Recent Activities + Edit Profile (email, password, avatar)

document.addEventListener('DOMContentLoaded', () => {
    const activityTableBody = document.querySelector('.activity-table tbody');
    const editProfileBtn = document.getElementById('editProfileBtn');
    const editProfilePanel = document.getElementById('editProfilePanel');
    const editProfileForm = document.getElementById('editProfileForm');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const editProfileMsg = document.getElementById('editProfileMsg');
    const avatarInput = document.getElementById('avatarInput');
    const bannerAvatar = document.querySelector('.profile-banner__avatar img');

    // ── Wait for Auth ─────────────────────────────────────────
    auth.onAuthStateChanged(async (user) => {
        if (!user) return;

        loadRecentActivities(user.email);
        prefillEditForm(user);
        loadAvatar(user);

        // Populate Health / User ID
        const idEl = document.getElementById('profileHealthId');
        if (idEl) {
            const shortId = user.uid.substring(0, 8).toUpperCase();
            const cached = JSON.parse(sessionStorage.getItem('authUser') || 'null');
            const role = (cached && cached.role) || 'staff';
            const prefix = role === 'bhw' ? 'BHW' : 'STF';
            idEl.textContent = `ID: ${prefix}-${shortId}`;
        }
    });

    // ══════════════════════════════════════════════════════════
    // 1. RECENT ACTIVITIES
    // ══════════════════════════════════════════════════════════
    async function loadRecentActivities(userEmail) {
        if (!activityTableBody) return;

        activityTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#888;">Loading activities...</td></tr>';

        try {
            const snap = await db.collection('activityLogs')
                .where('userEmail', '==', userEmail)
                .orderBy('timestamp', 'desc')
                .limit(10)
                .get();

            if (snap.empty) {
                activityTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#666;">No recent activities found.</td></tr>';
                return;
            }

            activityTableBody.innerHTML = '';

            snap.forEach(doc => {
                const data = doc.data();
                const tr = document.createElement('tr');

                let timeString = 'Just now';
                if (data.timestamp) {
                    const dateObj = data.timestamp.toDate();
                    timeString = dateObj.toLocaleDateString('en-US', {
                        month: '2-digit', day: '2-digit', year: 'numeric'
                    }) + ' | ' + dateObj.toLocaleTimeString('en-US', {
                        hour: '2-digit', minute: '2-digit'
                    });
                }

                tr.innerHTML = `
                    <td>${escapeHTML(timeString)}</td>
                    <td>${escapeHTML(data.action || '')}</td>
                    <td>${escapeHTML(data.location || '')}</td>
                `;
                activityTableBody.appendChild(tr);
            });

        } catch (error) {
            console.error('Error loading activities:', error);
            activityTableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:red;">Could not load activities. If this is the first time, click the Firestore index link in the browser console to enable the query.</td></tr>`;
        }
    }

    // ══════════════════════════════════════════════════════════
    // 2. LOAD AVATAR FROM FIRESTORE
    // ══════════════════════════════════════════════════════════
    async function loadAvatar(user) {
        try {
            const doc = await db.collection('users').doc(user.uid).get();
            if (doc.exists && doc.data().photoURL) {
                const url = doc.data().photoURL;
                if (bannerAvatar) bannerAvatar.src = url;
                const sidebarImg = document.querySelector('.profile-card img');
                if (sidebarImg) sidebarImg.src = url;
            }
        } catch (err) {
            console.error('Error loading avatar:', err);
        }
    }

    // ══════════════════════════════════════════════════════════
    // 3. EDIT PROFILE — Toggle Panel
    // ══════════════════════════════════════════════════════════
    if (editProfileBtn && editProfilePanel) {
        editProfileBtn.addEventListener('click', () => {
            editProfilePanel.style.display = editProfilePanel.style.display === 'none' ? 'block' : 'none';
            if (editProfilePanel.style.display === 'block') {
                editProfilePanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }

    if (cancelEditBtn && editProfilePanel) {
        cancelEditBtn.addEventListener('click', () => {
            editProfilePanel.style.display = 'none';
            clearMsg();
        });
    }

    function prefillEditForm(user) {
        const nameInput = document.getElementById('editFullName');
        const emailInput = document.getElementById('editEmail');
        if (!nameInput || !emailInput) return;

        const cached = JSON.parse(sessionStorage.getItem('authUser') || 'null');
        nameInput.value = (cached && cached.fullName) || user.displayName || '';
        emailInput.value = user.email || '';
    }

    // ══════════════════════════════════════════════════════════
    // 4. EDIT PROFILE — Save Changes
    // ══════════════════════════════════════════════════════════
    if (editProfileForm) {
        editProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearMsg();

            const saveBtn = document.getElementById('saveProfileBtn');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';

            const newName = document.getElementById('editFullName').value.trim();
            const newEmail = document.getElementById('editEmail').value.trim();
            const currentPassword = document.getElementById('editCurrentPassword').value;
            const newPassword = document.getElementById('editNewPassword').value;
            const confirmPassword = document.getElementById('editConfirmPassword').value;

            if (!newName) {
                showMsg('Full name cannot be empty.', 'error');
                resetBtn(saveBtn);
                return;
            }

            if (newPassword && newPassword !== confirmPassword) {
                showMsg('New passwords do not match.', 'error');
                resetBtn(saveBtn);
                return;
            }

            if (newPassword && newPassword.length < 6) {
                showMsg('New password must be at least 6 characters.', 'error');
                resetBtn(saveBtn);
                return;
            }

            try {
                const user = auth.currentUser;
                if (!user) throw new Error('Not logged in.');

                // Re-authenticate (required for sensitive ops)
                const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
                await user.reauthenticateWithCredential(credential);

                // Update name in Firestore
                await db.collection('users').doc(user.uid).update({ fullName: newName });

                // Update email if changed
                if (newEmail !== user.email) {
                    if (typeof user.verifyBeforeUpdateEmail === 'function') {
                        await user.verifyBeforeUpdateEmail(newEmail);
                        alert('A verification email has been sent to your new address. Please verify it to complete the email change.');
                    } else {
                        await user.updateEmail(newEmail);
                    }
                    await db.collection('users').doc(user.uid).update({ email: newEmail });
                }

                // Update password if provided
                if (newPassword) {
                    await user.updatePassword(newPassword);
                }

                // Update session cache + UI
                const cached = JSON.parse(sessionStorage.getItem('authUser') || '{}');
                cached.fullName = newName;
                cached.email = newEmail || cached.email;
                sessionStorage.setItem('authUser', JSON.stringify(cached));

                const bannerName = document.querySelector('.profile-banner__info h2');
                const bannerEmail = document.querySelector('.profile-banner__info p');
                const sidebarName = document.querySelector('.profile-card h2');
                if (bannerName) bannerName.textContent = newName;
                if (bannerEmail) bannerEmail.textContent = newEmail || user.email;
                if (sidebarName) sidebarName.textContent = newName;

                // Log activity
                await db.collection('activityLogs').add({
                    userEmail: newEmail || user.email,
                    action: 'Updated profile',
                    location: 'User Profile',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });

                showMsg('Profile updated successfully!', 'success');
                document.getElementById('editCurrentPassword').value = '';
                document.getElementById('editNewPassword').value = '';
                document.getElementById('editConfirmPassword').value = '';

                loadRecentActivities(newEmail || user.email);

            } catch (error) {
                console.error('Profile update error:', error);
                if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                    showMsg('Current password is incorrect.', 'error');
                } else if (error.code === 'auth/email-already-in-use') {
                    showMsg('That email is already used by another account.', 'error');
                } else if (error.code === 'auth/requires-recent-login') {
                    showMsg('Session expired. Please log out and log back in, then try again.', 'error');
                } else {
                    showMsg('Error: ' + error.message, 'error');
                }
            } finally {
                resetBtn(saveBtn);
            }
        });
    }

    // ══════════════════════════════════════════════════════════
    // 5. PROFILE PICTURE UPLOAD
    // ══════════════════════════════════════════════════════════
    if (avatarInput) {
        avatarInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!file.type.startsWith('image/')) {
                alert('Please select an image file.');
                return;
            }
            if (file.size > 2 * 1024 * 1024) {
                alert('Image must be under 2 MB.');
                return;
            }

            const user = auth.currentUser;
            if (!user) return;

            // Resize & compress image, then save as base64 in Firestore
            try {
                const dataURL = await resizeImage(file, 300, 300);
                await db.collection('users').doc(user.uid).update({ photoURL: dataURL });

                if (bannerAvatar) bannerAvatar.src = dataURL;
                const sidebarImg = document.querySelector('.profile-card img');
                if (sidebarImg) sidebarImg.src = dataURL;

                // Also cache it so other pages can pick it up
                sessionStorage.setItem('authAvatar', dataURL);

                alert('Profile picture updated!');
            } catch (err) {
                console.error('Error saving avatar:', err);
                alert('Could not save profile picture: ' + err.message);
            }
        });
    }

    /**
     * Resize an image file to fit within maxW × maxH and return a base64 data URL.
     * This keeps the file size small enough for Firestore (< 1 MB doc limit).
     */
    function resizeImage(file, maxW, maxH) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('Could not read file.'));
            reader.onload = (ev) => {
                const img = new Image();
                img.onerror = () => reject(new Error('Invalid image.'));
                img.onload = () => {
                    let w = img.width, h = img.height;
                    if (w > maxW || h > maxH) {
                        const ratio = Math.min(maxW / w, maxH / h);
                        w = Math.round(w * ratio);
                        h = Math.round(h * ratio);
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    // ══════════════════════════════════════════════════════════
    // Helpers
    // ══════════════════════════════════════════════════════════
    function showMsg(text, type) {
        if (!editProfileMsg) return;
        editProfileMsg.textContent = text;
        editProfileMsg.className = 'edit-profile-msg' + (type === 'error' ? ' msg--error' : ' msg--success');
    }

    function clearMsg() {
        if (!editProfileMsg) return;
        editProfileMsg.textContent = '';
        editProfileMsg.className = 'edit-profile-msg';
    }

    function resetBtn(btn) {
        btn.disabled = false;
        btn.textContent = 'Save Changes';
    }
});