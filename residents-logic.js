// residents-logic.js

document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.querySelector('.inventory-table tbody');
    const searchInput = document.querySelector('.inventory-search input');
    const filterPills = document.querySelectorAll('.filter-pill');

    // Modals
    const viewModal = document.getElementById('viewResidentModal');
    const editModal = document.getElementById('editResidentModal');
    const editForm = document.getElementById('editResidentForm');
    const deleteModal = document.getElementById('deleteResidentModal');
    const addModal = document.getElementById('addResidentModal');
    const addForm = document.getElementById('addResidentForm');

    let allResidents = [];
    let currentFilter = 'All';
    let pendingDeleteId = null;

    // ══════════════════════════════════════════════════════
    //  Helpers
    // ══════════════════════════════════════════════════════
    function getClassification(age, isPwd) {
        const a = parseInt(age, 10);
        if (isPwd) return 'PWDs';
        if (isNaN(a)) return 'Unknown';
        if (a < 5) return 'Infant';
        if (a <= 12) return 'Kids';
        if (a <= 19) return 'Teenagers';
        if (a <= 59) return 'Adults';
        return 'Senior Citizens';
    }

    function calcAgeFromDate(dateStr) {
        if (!dateStr) return null;
        const birth = new Date(dateStr);
        if (isNaN(birth.getTime())) return null;
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        return age >= 0 ? age : 0;
    }

    function formatDate(ts) {
        if (!ts) return '—';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    function formatBirthdate(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr + 'T00:00:00');
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    // ══════════════════════════════════════════════════════
    //  1. Fetch & Render
    // ══════════════════════════════════════════════════════
    async function loadResidents() {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Loading residents...</td></tr>';
        try {
            const snapshot = await db.collection('residents').orderBy('createdAt', 'desc').get();
            allResidents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            applyFiltersAndRender();
        } catch (error) {
            console.error('Error fetching residents:', error);
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:red;">Failed to load data.</td></tr>';
        }
    }

    function renderTable(data) {
        tableBody.innerHTML = '';
        if (data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No residents found.</td></tr>';
            return;
        }

        data.forEach(r => {
            const tr = document.createElement('tr');
            const fullName = [r.firstName, r.middleName, r.surname, r.suffix].filter(Boolean).join(' ');
            const contact = r.contactNumber || 'N/A';
            const healthId = r.healthId || 'Pending';
            const classification = r.classification || getClassification(r.age, r.isPwd);

            tr.innerHTML = `
                <td>${escapeHTML(healthId)}</td>
                <td>${escapeHTML(fullName)}</td>
                <td>${escapeHTML(String(r.age))}</td>
                <td>${escapeHTML(r.sex)}</td>
                <td>${escapeHTML(classification)}</td>
                <td>${escapeHTML(contact)}</td>
                <td>
                    <div class="resident-actions">
                        <button class="resident-action-btn resident-action-btn--view" title="View" onclick="viewResident('${r.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                        <button class="resident-action-btn resident-action-btn--edit" title="Edit" onclick="editResident('${r.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="resident-action-btn resident-action-btn--delete" title="Delete" onclick="confirmDeleteResident('${r.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    // ══════════════════════════════════════════════════════
    //  2. Search & Filter
    // ══════════════════════════════════════════════════════
    function applyFiltersAndRender() {
        const q = searchInput.value.toLowerCase().trim();
        const filtered = allResidents.filter(r => {
            const fullName = `${r.firstName} ${r.surname}`.toLowerCase();
            const healthId = (r.healthId || '').toLowerCase();
            const matchesSearch = fullName.includes(q) || healthId.includes(q);
            const classification = r.classification || getClassification(r.age, r.isPwd);
            const matchesFilter = currentFilter === 'All' || classification === currentFilter;
            return matchesSearch && matchesFilter;
        });
        renderTable(filtered);
    }

    if (searchInput) searchInput.addEventListener('input', applyFiltersAndRender);
    filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            filterPills.forEach(p => p.classList.remove('is-active'));
            pill.classList.add('is-active');
            currentFilter = pill.textContent.trim();
            applyFiltersAndRender();
        });
    });

    // ══════════════════════════════════════════════════════
    //  3. VIEW Modal
    // ══════════════════════════════════════════════════════
    window.viewResident = function(docId) {
        const r = allResidents.find(x => x.id === docId);
        if (!r) return;

        const fullName = [r.firstName, r.middleName, r.surname, r.suffix].filter(Boolean).join(' ');
        const classification = r.classification || getClassification(r.age, r.isPwd);
        const body = document.getElementById('viewModalBody');

        body.innerHTML = `
            <div class="view-health-id">
                <strong>Health ID:</strong> ${escapeHTML(r.healthId || 'Pending')}
            </div>

            <div class="view-section">
                <h3>Personal Information</h3>
                <p><strong>Name:</strong> ${escapeHTML(fullName)}</p>
                <p><strong>Age:</strong> ${r.age} years old</p>
                <p><strong>Birthdate:</strong> ${formatBirthdate(r.dateOfBirth)}</p>
                <p><strong>Gender:</strong> ${escapeHTML(r.sex || '—')}</p>
                <p><strong>Civil Status:</strong> ${escapeHTML(r.civilStatus || '—')}</p>
                <p><strong>Blood Type:</strong> ${escapeHTML(r.bloodType || '—')}</p>
            </div>

            <div class="view-section">
                <h3>Contact Information</h3>
                <p><strong>Address:</strong> ${escapeHTML(r.address || '—')}</p>
                <p><strong>Contact:</strong> ${escapeHTML(r.contactNumber || '—')}</p>
                <p><strong>Email:</strong> ${escapeHTML(r.email || '—')}</p>
            </div>

            <div class="view-section">
                <h3>Classification</h3>
                <span class="view-badge">${escapeHTML(classification)}</span>
            </div>

            <div class="view-section">
                <h3>Medical Notes</h3>
                <p>${escapeHTML(r.medicalNotes || r.condition || 'None')}</p>
                ${r.isPwd ? '<p><strong>PWD:</strong> Yes' + (r.disability ? ' — ' + escapeHTML(r.disability) : '') + '</p>' : ''}
                ${r.pregnant ? '<p><strong>Pregnant:</strong> Yes</p>' : ''}
                ${r.isMedication ? `<p><strong>Medication:</strong> ${escapeHTML(r.medicationName || '')} ${r.medicationDosage ? '(' + escapeHTML(r.medicationDosage) + ')' : ''}</p>` : ''}
            </div>

            <p class="view-date-added"><strong>Date Added:</strong> ${formatDate(r.createdAt)}</p>
        `;

        viewModal.style.display = 'flex';
    };

    window.closeViewModal = function() {
        viewModal.style.display = 'none';
    };
    if (viewModal) viewModal.addEventListener('click', e => { if (e.target === viewModal) closeViewModal(); });

    // ══════════════════════════════════════════════════════
    //  4. EDIT Modal
    // ══════════════════════════════════════════════════════
    window.editResident = function(docId) {
        const r = allResidents.find(x => x.id === docId);
        if (!r) return;

        document.getElementById('edit-doc-id').value = r.id;
        document.getElementById('edit-firstname').value = r.firstName || '';
        document.getElementById('edit-surname').value = r.surname || '';
        document.getElementById('edit-middlename').value = r.middleName || '';
        document.getElementById('edit-suffix').value = r.suffix || '';
        document.getElementById('edit-birthdate').value = r.dateOfBirth || '';
        document.getElementById('edit-sex').value = r.sex || 'Male';
        document.getElementById('edit-contact').value = r.contactNumber || '';
        document.getElementById('edit-email').value = r.email || '';
        document.getElementById('edit-address').value = r.address || '';
        document.getElementById('edit-bloodtype').value = r.bloodType || '';
        document.getElementById('edit-civil-status').value = r.civilStatus || '';
        document.getElementById('edit-pwd').checked = !!r.isPwd;
        document.getElementById('edit-pregnant').checked = !!r.pregnant;
        document.getElementById('edit-medical-notes').value = r.medicalNotes || '';

        editModal.style.display = 'flex';
    };

    window.closeEditModal = function() {
        editModal.style.display = 'none';
        editForm.reset();
    };
    if (editModal) editModal.addEventListener('click', e => { if (e.target === editModal) closeEditModal(); });

    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const saveBtn = document.getElementById('saveEditBtn');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';

            const docId = document.getElementById('edit-doc-id').value;
            const birthdate = document.getElementById('edit-birthdate').value;
            const age = calcAgeFromDate(birthdate);
            const isPwd = document.getElementById('edit-pwd').checked;

            const updatedData = {
                firstName: document.getElementById('edit-firstname').value.trim(),
                surname: document.getElementById('edit-surname').value.trim(),
                middleName: document.getElementById('edit-middlename').value.trim(),
                suffix: document.getElementById('edit-suffix').value,
                dateOfBirth: birthdate,
                age: age !== null ? age : 0,
                sex: document.getElementById('edit-sex').value,
                contactNumber: document.getElementById('edit-contact').value.trim(),
                email: document.getElementById('edit-email').value.trim(),
                address: document.getElementById('edit-address').value.trim(),
                bloodType: document.getElementById('edit-bloodtype').value,
                civilStatus: document.getElementById('edit-civil-status').value,
                isPwd: isPwd,
                pregnant: document.getElementById('edit-pregnant').checked,
                medicalNotes: document.getElementById('edit-medical-notes').value.trim(),
                classification: getClassification(age, isPwd),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            try {
                await db.collection('residents').doc(docId).update(updatedData);
                if (auth.currentUser) {
                    await db.collection('activityLogs').add({
                        userEmail: auth.currentUser.email,
                        action: `Edited resident: ${updatedData.firstName} ${updatedData.surname}`,
                        location: 'Residents\' Management',
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
                closeEditModal();
                loadResidents();
            } catch (error) {
                console.error('Error updating resident:', error);
                alert('Error updating record: ' + error.message);
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Changes';
            }
        });
    }

    // ══════════════════════════════════════════════════════
    //  5. DELETE Modal
    // ══════════════════════════════════════════════════════
    window.confirmDeleteResident = function(docId) {
        const r = allResidents.find(x => x.id === docId);
        if (!r) return;
        pendingDeleteId = docId;
        const fullName = [r.firstName, r.surname].filter(Boolean).join(' ');
        document.getElementById('deleteResidentName').textContent = fullName;
        deleteModal.style.display = 'flex';
    };

    window.closeDeleteModal = function() {
        deleteModal.style.display = 'none';
        pendingDeleteId = null;
    };
    if (deleteModal) deleteModal.addEventListener('click', e => { if (e.target === deleteModal) closeDeleteModal(); });

    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async () => {
            if (!pendingDeleteId) return;
            confirmDeleteBtn.disabled = true;
            confirmDeleteBtn.textContent = 'Deleting...';

            try {
                const resident = allResidents.find(r => r.id === pendingDeleteId);
                const refsToDelete = [db.collection('residents').doc(pendingDeleteId)];

                if (resident && resident.healthId) {
                    const logsSnap = await db.collection('maintenanceLogs')
                        .where('healthId', '==', resident.healthId).get();
                    logsSnap.forEach(doc => refsToDelete.push(doc.ref));
                }

                const CHUNK = 499;
                for (let i = 0; i < refsToDelete.length; i += CHUNK) {
                    const chunk = refsToDelete.slice(i, i + CHUNK);
                    const batch = db.batch();
                    chunk.forEach(ref => batch.delete(ref));
                    await batch.commit();
                }

                if (auth.currentUser) {
                    await db.collection('activityLogs').add({
                        userEmail: auth.currentUser.email,
                        action: `Deleted resident: ${resident ? resident.firstName + ' ' + resident.surname : 'Unknown'}`,
                        location: 'Residents\' Management',
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }

                closeDeleteModal();
                loadResidents();
            } catch (error) {
                console.error('Error deleting:', error);
                alert('Could not delete resident.');
            } finally {
                confirmDeleteBtn.disabled = false;
                confirmDeleteBtn.textContent = 'Delete';
            }
        });
    }

    // ══════════════════════════════════════════════════════
    //  6. ADD Modal
    // ══════════════════════════════════════════════════════
    window.openAddResidentModal = function() {
        if (addForm) addForm.reset();
        if (addModal) addModal.style.display = 'flex';
    };

    window.closeAddResidentModal = function() {
        if (addModal) addModal.style.display = 'none';
        if (addForm) addForm.reset();
    };
    if (addModal) addModal.addEventListener('click', e => { if (e.target === addModal) closeAddResidentModal(); });

    if (addForm) {
        addForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('addResidentBtn');
            btn.disabled = true;
            btn.textContent = 'Registering...';

            const firstname = document.getElementById('add-firstname').value.trim();
            const surname = document.getElementById('add-surname').value.trim();
            const middlename = document.getElementById('add-middlename').value.trim();
            const suffix = document.getElementById('add-suffix').value;
            const birthdate = document.getElementById('add-birthdate').value;
            const sex = document.getElementById('add-sex').value;
            const contact = document.getElementById('add-contact').value.trim();
            const email = document.getElementById('add-email').value.trim();
            const address = document.getElementById('add-address').value.trim();
            const bloodType = document.getElementById('add-bloodtype').value;
            const civilStatus = document.getElementById('add-civil-status').value;
            const isPwd = document.getElementById('add-pwd').checked;
            const pregnant = document.getElementById('add-pregnant').checked;
            const medicalNotes = document.getElementById('add-medical-notes').value.trim();
            const age = calcAgeFromDate(birthdate);

            if (age === null) {
                alert('Please enter a valid birthdate.');
                btn.disabled = false;
                btn.textContent = 'Register Resident';
                return;
            }

            const classification = getClassification(age, isPwd);

            // Generate Health ID
            const initials = (firstname.charAt(0) + surname.charAt(0)).toUpperCase();
            const yearSuffix = new Date().getFullYear().toString().slice(-2);
            let healthId = `B86${initials}${age}${yearSuffix}`;

            try {
                let isUnique = false;
                let attempts = 0;
                while (!isUnique && attempts < 5) {
                    const existing = await db.collection('residents')
                        .where('healthId', '==', healthId).limit(1).get();
                    if (existing.empty) {
                        isUnique = true;
                    } else {
                        const rnd = Math.floor(Math.random() * 900 + 100);
                        healthId = `B86${initials}${age}${yearSuffix}${rnd}`;
                        attempts++;
                    }
                }
                if (!isUnique) {
                    alert('Could not generate a unique Health ID. Please try again.');
                    btn.disabled = false;
                    btn.textContent = 'Register Resident';
                    return;
                }

                await db.collection('residents').add({
                    healthId,
                    surname,
                    suffix,
                    firstName: firstname,
                    middleName: middlename,
                    dateOfBirth: birthdate,
                    age,
                    sex,
                    address,
                    contactNumber: contact,
                    email,
                    bloodType,
                    civilStatus,
                    isPwd,
                    pregnant,
                    medicalNotes,
                    classification,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    createdBy: auth.currentUser ? auth.currentUser.email : 'Unknown Staff'
                });

                if (auth.currentUser) {
                    await db.collection('activityLogs').add({
                        userEmail: auth.currentUser.email,
                        action: `Registered new resident: ${firstname} ${surname} (${healthId})`,
                        location: 'Residents\' Management',
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }

                closeAddResidentModal();
                loadResidents();
                alert(`Resident registered successfully!\nHealth ID: ${healthId}`);
            } catch (error) {
                console.error('Error adding resident:', error);
                alert('Error saving record: ' + error.message);
            } finally {
                btn.disabled = false;
                btn.textContent = 'Register Resident';
            }
        });
    }

    // Init
    loadResidents();
});