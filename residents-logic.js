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
                        <button class="inventory-action-btn inventory-action-btn--danger" onclick="deleteResident('${resident.id}')">Delete</button>
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
    window.deleteResident = async function(docId) {
        if (confirm('Are you sure you want to completely delete this resident?')) {
            try {
                await db.collection('residents').doc(docId).delete();

                // --- RECORD ACTIVITY LOG ---
                if (auth.currentUser) {
                    await db.collection('activityLogs').add({
                        userEmail: auth.currentUser.email,
                        action: 'Deleted a resident record',
                        location: 'Residents\' Management',
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }

                loadResidents(); 
            } catch (error) {
                console.error('Error deleting:', error);
                alert('Could not delete resident.');
            }
        }
    };

    // Open the Edit Modal and fill it with data
    window.editResident = function(docId) {
        const resident = allResidents.find(r => r.id === docId);
        if (!resident) return;

        document.getElementById('edit-doc-id').value = resident.id;
        document.getElementById('edit-firstname').value = resident.firstName || '';
        document.getElementById('edit-surname').value = resident.surname || '';
        document.getElementById('edit-age').value = resident.age || '';
        
        // Match the exact case in your dropdown or default to 'Male'/'Female'
        const sexField = document.getElementById('edit-sex');
        if (Array.from(sexField.options).some(opt => opt.value === resident.sex)) {
            sexField.value = resident.sex;
        }

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
                surname: document.getElementById('edit-surname').value.trim(),
                age: parseInt(document.getElementById('edit-age').value.trim(), 10),
                sex: document.getElementById('edit-sex').value,
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

    function escapeHTML(str) {
        if (str === null || str === undefined) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Run the fetch when the page loads
    loadResidents();
});