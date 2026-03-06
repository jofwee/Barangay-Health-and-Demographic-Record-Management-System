// residents-logic.js

document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.querySelector('.inventory-table tbody');
    const searchInput = document.querySelector('.inventory-search input');
    const filterPills = document.querySelectorAll('.filter-pill');
    
    // Modal Elements
    const editModal = document.getElementById('editResidentModal');
    const editForm = document.getElementById('editResidentForm');
    
    let allResidents = []; 
    let currentFilter = 'All';

    // ── 1. Fetch Data from Firestore ──────────────────────────
    async function loadResidents() {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Loading residents...</td></tr>';
        
        try {
            const snapshot = await db.collection('residents').orderBy('createdAt', 'desc').get();
            
            allResidents = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            applyFiltersAndRender();
        } catch (error) {
            console.error('Error fetching residents:', error);
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">Failed to load data.</td></tr>';
        }
    }

    // ── 2. Render the Table ───────────────────────────────────
    function renderTable(dataToRender) {
        tableBody.innerHTML = '';

        if (dataToRender.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No residents found.</td></tr>';
            return;
        }

        dataToRender.forEach(resident => {
            const tr = document.createElement('tr');
            const fullName = `${resident.firstName} ${resident.surname}`.trim();
            const contact = resident.contactNumber || 'N/A';
            const healthId = resident.healthId || 'Pending';
            const classification = resident.classification || getClassification(resident.age);

            tr.innerHTML = `
                <td>${escapeHTML(healthId)}</td>
                <td>${escapeHTML(fullName)}</td>
                <td>${escapeHTML(resident.age.toString())}</td>
                <td>${escapeHTML(resident.sex)}</td>
                <td>${escapeHTML(classification)}</td>
                <td>${escapeHTML(contact)}</td>
                <td>
                    <div class="inventory-row-actions">
                        <button class="inventory-action-btn" onclick="editResident('${resident.id}')">Edit</button>
                        <button class="inventory-action-btn inventory-action-btn--danger" onclick="deleteResident('${resident.id}', this)">Delete</button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    // ── 3. Search and Filter Logic ────────────────────────────
    function applyFiltersAndRender() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        
        const filteredData = allResidents.filter(resident => {
            const fullName = `${resident.firstName} ${resident.surname}`.toLowerCase();
            const healthId = (resident.healthId || '').toLowerCase();
            const matchesSearch = fullName.includes(searchTerm) || healthId.includes(searchTerm);
            
            const classification = resident.classification || getClassification(resident.age);
            const matchesFilter = currentFilter === 'All' || classification === currentFilter;
            
            return matchesSearch && matchesFilter;
        });

        renderTable(filteredData);
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

    // ── 4. Global Actions (Delete / Edit) ─────────────────────
    window.deleteResident = async function(docId, btn) {
        if (confirm('Are you sure you want to completely delete this resident?\n\nThis will also remove any related maintenance logs.')) {
            if (btn) { btn.disabled = true; btn.textContent = 'Deleting...'; }
            try {
                const resident = allResidents.find(r => r.id === docId);

                // Collect all refs to delete
                const refsToDelete = [db.collection('residents').doc(docId)];

                if (resident && resident.healthId) {
                    const logsSnap = await db.collection('maintenanceLogs')
                        .where('healthId', '==', resident.healthId).get();
                    logsSnap.forEach(doc => refsToDelete.push(doc.ref));
                }

                // Chunk into batches of 499 (Firestore limit is 500 ops per batch)
                const CHUNK = 499;
                for (let i = 0; i < refsToDelete.length; i += CHUNK) {
                    const chunk = refsToDelete.slice(i, i + CHUNK);
                    const batch = db.batch();
                    chunk.forEach(ref => batch.delete(ref));
                    await batch.commit();
                }

                // --- RECORD ACTIVITY LOG ---
                if (auth.currentUser) {
                    await db.collection('activityLogs').add({
                        userEmail: auth.currentUser.email,
                        action: `Deleted resident: ${resident ? resident.firstName + ' ' + resident.surname : 'Unknown'}`,
                        location: 'Residents\' Management',
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }

                loadResidents(); 
            } catch (error) {
                console.error('Error deleting:', error);
                alert('Could not delete resident.');
                if (btn) { btn.disabled = false; btn.textContent = 'Delete'; }
            }
        }
    };

    // Open the Edit Modal and fill it with data
    window.editResident = function(docId) {
        const resident = allResidents.find(r => r.id === docId);
        if (!resident) return;

        document.getElementById('edit-doc-id').value = resident.id;
        document.getElementById('edit-firstname').value = resident.firstName || '';
        document.getElementById('edit-middlename').value = resident.middleName || '';
        document.getElementById('edit-surname').value = resident.surname || '';
        document.getElementById('edit-suffix').value = resident.suffix || '';
        document.getElementById('edit-age').value = resident.age || '';
        
        // Match the exact case in your dropdown or default to 'Male'/'Female'
        const sexField = document.getElementById('edit-sex');
        if (Array.from(sexField.options).some(opt => opt.value === resident.sex)) {
            sexField.value = resident.sex;
        }

        document.getElementById('edit-address').value = resident.address || '';
        document.getElementById('edit-contact').value = resident.contactNumber || '';
        
        const classification = resident.classification || getClassification(resident.age);
        const classField = document.getElementById('edit-classification');
        if (Array.from(classField.options).some(opt => opt.value === classification)) {
            classField.value = classification;
        }

        editModal.style.display = 'flex';
    };

    // Close the Modal
    window.closeEditModal = function() {
        editModal.style.display = 'none';
        editForm.reset();
    };

    // Handle the Form Submission to Update Firestore
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const saveBtn = document.getElementById('saveEditBtn');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';

            const docId = document.getElementById('edit-doc-id').value;
            const updatedData = {
                firstName: document.getElementById('edit-firstname').value.trim(),
                middleName: document.getElementById('edit-middlename').value.trim(),
                surname: document.getElementById('edit-surname').value.trim(),
                suffix: document.getElementById('edit-suffix').value.trim(),
                age: parseInt(document.getElementById('edit-age').value.trim(), 10),
                sex: document.getElementById('edit-sex').value,
                address: document.getElementById('edit-address').value.trim(),
                contactNumber: document.getElementById('edit-contact').value.trim(),
                classification: document.getElementById('edit-classification').value,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            try {
                await db.collection('residents').doc(docId).update(updatedData);

                // --- RECORD ACTIVITY LOG ---
                if (auth.currentUser) {
                    await db.collection('activityLogs').add({
                        userEmail: auth.currentUser.email,
                        action: `Edited resident: ${updatedData.firstName} ${updatedData.surname}`,
                        location: 'Residents\' Management',
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }

                closeEditModal();
                loadResidents(); // Refresh the table to show the new changes
            } catch (error) {
                console.error('Error updating resident:', error);
                alert('Error updating record: ' + error.message);
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Changes';
            }
        });
    }

    // ── Helpers ───────────────────────────────────────────────
    function getClassification(ageStr) {
        const ageNum = parseInt(ageStr, 10);
        if (isNaN(ageNum)) return 'Unknown';
        if (ageNum < 5) return 'Infant';
        if (ageNum <= 12) return 'Kids';
        if (ageNum <= 19) return 'Teenagers';
        if (ageNum <= 59) return 'Adults';
        return 'Senior Citizens';
    }

    // ── 5. Add New Resident Modal ──────────────────────────
    const addModal = document.getElementById('addResidentModal');
    const addForm = document.getElementById('addResidentForm');

    window.openAddResidentModal = function() {
        if (addForm) addForm.reset();
        if (addModal) addModal.style.display = 'flex';
    };

    window.closeAddResidentModal = function() {
        if (addModal) addModal.style.display = 'none';
        if (addForm) addForm.reset();
    };

    // Close on backdrop click
    if (addModal) {
        addModal.addEventListener('click', (e) => {
            if (e.target === addModal) closeAddResidentModal();
        });
    }

    if (addForm) {
        addForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('addResidentBtn');
            btn.disabled = true;
            btn.textContent = 'Registering...';

            const firstname = document.getElementById('add-firstname').value.trim();
            const middlename = document.getElementById('add-middlename').value.trim();
            const surname = document.getElementById('add-surname').value.trim();
            const suffix = document.getElementById('add-suffix').value.trim();
            const age = parseInt(document.getElementById('add-age').value.trim(), 10);
            const sex = document.getElementById('add-sex').value;
            const address = document.getElementById('add-address').value.trim();
            const contact = document.getElementById('add-contact').value.trim();
            const isPwd = document.getElementById('add-pwd').checked;

            // Classification
            let classification = 'Adults';
            if (isPwd) {
                classification = 'PWDs';
            } else if (age < 5) {
                classification = 'Infant';
            } else if (age <= 12) {
                classification = 'Kids';
            } else if (age <= 19) {
                classification = 'Teenagers';
            } else if (age <= 59) {
                classification = 'Adults';
            } else {
                classification = 'Senior Citizens';
            }

            // Generate Health ID
            const initials = (firstname.charAt(0) + surname.charAt(0)).toUpperCase();
            const yearSuffix = new Date().getFullYear().toString().slice(-2);
            let healthId = `B86${initials}${age}${yearSuffix}`;

            try {
                // Ensure unique Health ID
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
                    age,
                    sex,
                    address,
                    contactNumber: contact,
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

    // Run the fetch when the page loads
    loadResidents();
});