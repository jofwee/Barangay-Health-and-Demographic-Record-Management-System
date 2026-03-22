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
                <p><strong>Place of Birth:</strong> ${escapeHTML(r.placeOfBirth || '—')}</p>
                <p><strong>Nationality:</strong> ${escapeHTML(r.nationality || 'Filipino')}</p>
                <p><strong>Occupation:</strong> ${escapeHTML(r.occupation || '—')}</p>
                <p><strong>Head of Family:</strong> ${r.isHead ? 'Yes' : 'No'}</p>
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
                <h3>Medical Information</h3>
                ${r.isPwd ? '<p><strong>PWD:</strong> Yes' + (r.disability ? ' — ' + escapeHTML(r.disability) : '') + '</p>' : '<p><strong>PWD:</strong> No</p>'}
                ${r.isMedication ? `<p><strong>Medication:</strong> ${escapeHTML(r.medicationName || '')} ${r.medicationDosage ? '(' + escapeHTML(r.medicationDosage) + ')' : ''} ${r.medicationQty ? 'x' + escapeHTML(String(r.medicationQty)) : ''}</p>
                <p><strong>Condition:</strong> ${escapeHTML(r.condition || '—')}</p>` : '<p><strong>Medication:</strong> None</p>'}
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
        document.getElementById('edit-sex').value = r.sex || '';
        document.getElementById('edit-contact').value = r.contactNumber || '';
        document.getElementById('edit-email').value = r.email || '';
        document.getElementById('edit-bloodtype').value = r.bloodType || '';
        document.getElementById('edit-civil-status').value = r.civilStatus || '';
        document.getElementById('edit-occupation').value = r.occupation || '';

        // DOB — parse YYYY-MM-DD into mm / dd / yyyy fields
        const dob = r.dateOfBirth || '';
        if (dob) {
            const parts = dob.split('-');
            document.getElementById('edit-dob-yyyy').value = parts[0] || '';
            document.getElementById('edit-dob-mm').value = parseInt(parts[1], 10) || '';
            document.getElementById('edit-dob-dd').value = parseInt(parts[2], 10) || '';
        }
        calcEditAge();

        // Address — try to split "streetNo streetName" or just fill streetName
        const addr = r.address || '';
        const addrMatch = addr.match(/^(\S+)\s+(.+)$/);
        if (addrMatch) {
            document.getElementById('edit-street-no').value = addrMatch[1];
            document.getElementById('edit-street-name').value = addrMatch[2];
        } else {
            document.getElementById('edit-street-no').value = '';
            document.getElementById('edit-street-name').value = addr;
        }

        // Place of birth — split "Province, City"
        const pob = r.placeOfBirth || '';
        const pobParts = pob.split(',').map(s => s.trim());
        document.getElementById('edit-pob-province').value = pobParts[0] || '';
        document.getElementById('edit-pob-city').value = pobParts[1] || '';

        // Nationality
        const nat = r.nationality || 'Filipino';
        const outsidePH = !!r.outsidePH;
        const editNatInput = document.getElementById('edit-nationality');
        const editOutsidePH = document.getElementById('edit-outside-ph');
        editNatInput.value = nat;
        editOutsidePH.checked = outsidePH;
        editNatInput.readOnly = !outsidePH;

        // PWD
        const isPwd = !!r.isPwd;
        document.querySelector(`input[name="edit-pwd-radio"][value="${isPwd ? 'yes' : 'no'}"]`).checked = true;
        document.getElementById('editPwdDetailField').style.display = isPwd ? 'flex' : 'none';
        document.getElementById('edit-disability').value = r.disability || '';

        // Medication
        const isMed = !!r.isMedication;
        document.querySelector(`input[name="edit-med-radio"][value="${isMed ? 'yes' : 'no'}"]`).checked = true;
        document.getElementById('editMedicationDetails').style.display = isMed ? 'flex' : 'none';
        document.getElementById('edit-med-name').value = r.medicationName || '';
        document.getElementById('edit-med-dosage').value = r.medicationDosage || '';
        document.getElementById('edit-med-qty').value = r.medicationQty || '';

        // Condition
        const cond = r.condition || '';
        const condSelect = document.getElementById('edit-condition');
        const condOtherField = document.getElementById('editConditionOtherField');
        const knownConditions = [...condSelect.options].map(o => o.value).filter(Boolean);
        if (knownConditions.includes(cond)) {
            condSelect.value = cond;
            condOtherField.style.display = 'none';
        } else if (cond) {
            condSelect.value = 'Other';
            document.getElementById('edit-condition-other').value = cond;
            condOtherField.style.display = 'flex';
        }

        editModal.style.display = 'flex';
    };

    window.closeEditModal = function() {
        editModal.style.display = 'none';
        editForm.reset();
        document.getElementById('editPwdDetailField').style.display = 'none';
        document.getElementById('editMedicationDetails').style.display = 'none';
        document.getElementById('editConditionOtherField').style.display = 'none';
        const editNat = document.getElementById('edit-nationality');
        editNat.value = 'Filipino'; editNat.readOnly = true;
    };
    if (editModal) editModal.addEventListener('click', e => { if (e.target === editModal) closeEditModal(); });

    // ── Edit modal: Auto-calculate age from DOB ──
    const editDobMM = document.getElementById('edit-dob-mm');
    const editDobDD = document.getElementById('edit-dob-dd');
    const editDobYYYY = document.getElementById('edit-dob-yyyy');
    const editAgeInput = document.getElementById('edit-age');

    function calcEditAge() {
        const mm = parseInt(editDobMM?.value, 10);
        const dd = parseInt(editDobDD?.value, 10);
        const yyyy = parseInt(editDobYYYY?.value, 10);
        if (!mm || !dd || !yyyy || yyyy < 1900) { if (editAgeInput) editAgeInput.value = ''; return; }
        const today = new Date();
        const birth = new Date(yyyy, mm - 1, dd);
        if (isNaN(birth.getTime())) { editAgeInput.value = ''; return; }
        let age = today.getFullYear() - birth.getFullYear();
        const mDiff = today.getMonth() - birth.getMonth();
        if (mDiff < 0 || (mDiff === 0 && today.getDate() < birth.getDate())) age--;
        editAgeInput.value = age >= 0 ? age : '';
    }
    if (editDobMM && editDobDD && editDobYYYY) {
        editDobMM.addEventListener('input', calcEditAge);
        editDobDD.addEventListener('input', calcEditAge);
        editDobYYYY.addEventListener('input', calcEditAge);
    }

    // ── Edit modal: PWD toggle ──
    const editPwdRadios = document.querySelectorAll('input[name="edit-pwd-radio"]');
    const editPwdDetailField = document.getElementById('editPwdDetailField');
    editPwdRadios.forEach(r => r.addEventListener('change', () => {
        editPwdDetailField.style.display = r.value === 'yes' && r.checked ? 'flex' : 'none';
    }));

    // ── Edit modal: Medication toggle ──
    const editMedRadios = document.querySelectorAll('input[name="edit-med-radio"]');
    const editMedicationDetails = document.getElementById('editMedicationDetails');
    editMedRadios.forEach(r => r.addEventListener('change', () => {
        editMedicationDetails.style.display = r.value === 'yes' && r.checked ? 'flex' : 'none';
    }));

    // ── Edit modal: Condition "Other" toggle ──
    const editConditionSelect = document.getElementById('edit-condition');
    const editConditionOtherField = document.getElementById('editConditionOtherField');
    if (editConditionSelect) {
        editConditionSelect.addEventListener('change', () => {
            editConditionOtherField.style.display = editConditionSelect.value === 'Other' ? 'flex' : 'none';
        });
    }

    // ── Edit modal: Outside PH toggle ──
    const editOutsidePH = document.getElementById('edit-outside-ph');
    const editNationalityInput = document.getElementById('edit-nationality');
    if (editOutsidePH && editNationalityInput) {
        editOutsidePH.addEventListener('change', () => {
            if (editOutsidePH.checked) {
                editNationalityInput.readOnly = false;
                editNationalityInput.value = '';
                editNationalityInput.placeholder = 'Enter nationality';
                editNationalityInput.focus();
            } else {
                editNationalityInput.readOnly = true;
                editNationalityInput.value = 'Filipino';
                editNationalityInput.placeholder = '';
            }
        });
    }

    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const saveBtn = document.getElementById('saveEditBtn');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';

            const docId = document.getElementById('edit-doc-id').value;

            // Personal info
            const surname = document.getElementById('edit-surname').value.trim();
            const firstname = document.getElementById('edit-firstname').value.trim();
            const middlename = document.getElementById('edit-middlename').value.trim();
            const suffix = document.getElementById('edit-suffix').value;
            const sex = document.getElementById('edit-sex').value;
            const civilStatus = document.getElementById('edit-civil-status').value;
            const bloodType = document.getElementById('edit-bloodtype').value;
            const occupation = (document.getElementById('edit-occupation')?.value || '').trim();
            const streetNo = (document.getElementById('edit-street-no')?.value || '').trim();
            const streetName = (document.getElementById('edit-street-name')?.value || '').trim();
            const address = [streetNo, streetName].filter(Boolean).join(' ');
            const contact = document.getElementById('edit-contact').value.trim();
            const email = document.getElementById('edit-email').value.trim();
            const pobProvince = (document.getElementById('edit-pob-province')?.value || '').trim();
            const pobCity = (document.getElementById('edit-pob-city')?.value || '').trim();
            const placeOfBirth = [pobProvince, pobCity].filter(Boolean).join(', ');
            const nationality = (document.getElementById('edit-nationality')?.value || 'Filipino').trim();
            const outsidePH = document.getElementById('edit-outside-ph')?.checked || false;

            // DOB
            const mm = editDobMM ? editDobMM.value.trim() : '';
            const dd = editDobDD ? editDobDD.value.trim() : '';
            const yyyy = editDobYYYY ? editDobYYYY.value.trim() : '';
            const dateOfBirth = (mm && dd && yyyy) ? `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}` : '';
            const age = editAgeInput ? parseInt(editAgeInput.value, 10) : null;

            // Medical
            const isPwd = document.querySelector('input[name="edit-pwd-radio"]:checked')?.value === 'yes';
            const disability = isPwd ? (document.getElementById('edit-disability')?.value.trim() || '') : '';
            const isMedication = document.querySelector('input[name="edit-med-radio"]:checked')?.value === 'yes';
            const medName = isMedication ? (document.getElementById('edit-med-name')?.value.trim() || '') : '';
            const medDosage = isMedication ? (document.getElementById('edit-med-dosage')?.value.trim() || '') : '';
            const medQty = isMedication ? (document.getElementById('edit-med-qty')?.value.trim() || '') : '';
            const conditionVal = isMedication ? (document.getElementById('edit-condition')?.value || '') : '';
            const conditionOther = isMedication ? (document.getElementById('edit-condition-other')?.value.trim() || '') : '';
            const condition = conditionVal === 'Other' ? conditionOther : conditionVal;

            if (!surname || !firstname || isNaN(age) || age === null || !sex || !address) {
                alert('Please fill in all required fields (Surname, First Name, Date of Birth, Sex, Address).');
                saveBtn.disabled = false;
                saveBtn.textContent = 'SAVE CHANGES';
                return;
            }

            const classification = getClassification(age, isPwd);

            const updatedData = {
                surname,
                suffix,
                firstName: firstname,
                middleName: middlename,
                dateOfBirth,
                placeOfBirth,
                nationality,
                outsidePH,
                age,
                sex,
                civilStatus,
                bloodType,
                occupation,
                address,
                contactNumber: contact,
                email,
                isPwd,
                disability,
                isMedication,
                medicationName: medName,
                medicationDosage: medDosage,
                medicationQty: medQty,
                condition,
                classification,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            try {
                await db.collection('residents').doc(docId).update(updatedData);
                if (auth.currentUser) {
                    await db.collection('activityLogs').add({
                        userEmail: auth.currentUser.email,
                        action: `Edited resident: ${firstname} ${surname}`,
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
                saveBtn.textContent = 'SAVE CHANGES';
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
        // Reset hidden sections
        const addPwdDetail = document.getElementById('addPwdDetailField');
        const addMedDetails = document.getElementById('addMedicationDetails');
        const addCondOther = document.getElementById('addConditionOtherField');
        const addNationality = document.getElementById('add-nationality');
        if (addPwdDetail) addPwdDetail.style.display = 'none';
        if (addMedDetails) addMedDetails.style.display = 'none';
        if (addCondOther) addCondOther.style.display = 'none';
        if (addNationality) { addNationality.value = 'Filipino'; addNationality.readOnly = true; }
        if (addModal) addModal.style.display = 'flex';
    };

    window.closeAddResidentModal = function() {
        if (addModal) addModal.style.display = 'none';
        if (addForm) addForm.reset();
    };
    if (addModal) addModal.addEventListener('click', e => { if (e.target === addModal) closeAddResidentModal(); });

    // ── Add modal: Auto-calculate age from DOB ──
    const addDobMM = document.getElementById('add-dob-mm');
    const addDobDD = document.getElementById('add-dob-dd');
    const addDobYYYY = document.getElementById('add-dob-yyyy');
    const addAgeInput = document.getElementById('add-age');

    function calcAddAge() {
        const mm = parseInt(addDobMM.value, 10);
        const dd = parseInt(addDobDD.value, 10);
        const yyyy = parseInt(addDobYYYY.value, 10);
        if (!mm || !dd || !yyyy || yyyy < 1900) { addAgeInput.value = ''; return; }
        const today = new Date();
        const birth = new Date(yyyy, mm - 1, dd);
        if (isNaN(birth.getTime())) { addAgeInput.value = ''; return; }
        let age = today.getFullYear() - birth.getFullYear();
        const mDiff = today.getMonth() - birth.getMonth();
        if (mDiff < 0 || (mDiff === 0 && today.getDate() < birth.getDate())) age--;
        addAgeInput.value = age >= 0 ? age : '';
    }
    if (addDobMM && addDobDD && addDobYYYY) {
        addDobMM.addEventListener('input', calcAddAge);
        addDobDD.addEventListener('input', calcAddAge);
        addDobYYYY.addEventListener('input', calcAddAge);
    }

    // ── Add modal: PWD toggle ──
    const addPwdRadios = document.querySelectorAll('input[name="add-pwd-radio"]');
    const addPwdDetailField = document.getElementById('addPwdDetailField');
    addPwdRadios.forEach(r => r.addEventListener('change', () => {
        addPwdDetailField.style.display = r.value === 'yes' && r.checked ? 'flex' : 'none';
    }));

    // ── Add modal: Medication toggle ──
    const addMedRadios = document.querySelectorAll('input[name="add-med-radio"]');
    const addMedicationDetails = document.getElementById('addMedicationDetails');
    addMedRadios.forEach(r => r.addEventListener('change', () => {
        addMedicationDetails.style.display = r.value === 'yes' && r.checked ? 'flex' : 'none';
    }));

    // ── Add modal: Condition "Other" toggle ──
    const addConditionSelect = document.getElementById('add-condition');
    const addConditionOtherField = document.getElementById('addConditionOtherField');
    if (addConditionSelect) {
        addConditionSelect.addEventListener('change', () => {
            addConditionOtherField.style.display = addConditionSelect.value === 'Other' ? 'flex' : 'none';
        });
    }

    // ── Add modal: Outside PH toggle ──
    const addOutsidePH = document.getElementById('add-outside-ph');
    const addNationalityInput = document.getElementById('add-nationality');
    if (addOutsidePH && addNationalityInput) {
        addOutsidePH.addEventListener('change', () => {
            if (addOutsidePH.checked) {
                addNationalityInput.readOnly = false;
                addNationalityInput.value = '';
                addNationalityInput.placeholder = 'Enter nationality';
                addNationalityInput.focus();
            } else {
                addNationalityInput.readOnly = true;
                addNationalityInput.value = 'Filipino';
                addNationalityInput.placeholder = '';
            }
        });
    }

    if (addForm) {
        addForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('addResidentBtn');
            btn.disabled = true;
            btn.textContent = 'Submitting...';

            // Personal info
            const surname = document.getElementById('add-surname').value.trim();
            const firstname = document.getElementById('add-firstname').value.trim();
            const middlename = document.getElementById('add-middlename').value.trim();
            const suffix = document.getElementById('add-suffix').value;
            const sex = document.getElementById('add-sex').value;
            const civilStatus = document.getElementById('add-civil-status').value;
            const bloodType = document.getElementById('add-bloodtype').value;
            const occupation = (document.getElementById('add-occupation')?.value || '').trim();
            const streetNo = (document.getElementById('add-street-no')?.value || '').trim();
            const streetName = (document.getElementById('add-street-name')?.value || '').trim();
            const address = [streetNo, streetName].filter(Boolean).join(' ');
            const contact = document.getElementById('add-contact').value.trim();
            const email = document.getElementById('add-email').value.trim();
            const pobProvince = (document.getElementById('add-pob-province')?.value || '').trim();
            const pobCity = (document.getElementById('add-pob-city')?.value || '').trim();
            const placeOfBirth = [pobProvince, pobCity].filter(Boolean).join(', ');
            const nationality = (document.getElementById('add-nationality')?.value || 'Filipino').trim();
            const outsidePH = document.getElementById('add-outside-ph')?.checked || false;

            // DOB
            const mm = addDobMM ? addDobMM.value.trim() : '';
            const dd = addDobDD ? addDobDD.value.trim() : '';
            const yyyy = addDobYYYY ? addDobYYYY.value.trim() : '';
            const dateOfBirth = (mm && dd && yyyy) ? `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}` : '';
            const age = addAgeInput ? parseInt(addAgeInput.value, 10) : null;

            // Medical
            const isPwd = document.querySelector('input[name="add-pwd-radio"]:checked')?.value === 'yes';
            const disability = isPwd ? (document.getElementById('add-disability')?.value.trim() || '') : '';
            const isMedication = document.querySelector('input[name="add-med-radio"]:checked')?.value === 'yes';
            const medName = isMedication ? (document.getElementById('add-med-name')?.value.trim() || '') : '';
            const medDosage = isMedication ? (document.getElementById('add-med-dosage')?.value.trim() || '') : '';
            const medQty = isMedication ? (document.getElementById('add-med-qty')?.value.trim() || '') : '';
            const conditionVal = isMedication ? (document.getElementById('add-condition')?.value || '') : '';
            const conditionOther = isMedication ? (document.getElementById('add-condition-other')?.value.trim() || '') : '';
            const condition = conditionVal === 'Other' ? conditionOther : conditionVal;

            // Validation
            if (!surname || !firstname || isNaN(age) || age === null || !sex || !address) {
                alert('Please fill in all required fields (Surname, First Name, Date of Birth, Sex, Address).');
                btn.disabled = false;
                btn.textContent = 'DONE';
                return;
            }

            const classification = getClassification(age, isPwd);

            // Generate Health ID (B86 + 6 random uppercase letters)
            function randomLetters(n) {
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                let result = '';
                for (let i = 0; i < n; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
                return result;
            }
            let healthId = `B86${randomLetters(6)}`;

            try {
                let isUnique = false;
                let attempts = 0;
                while (!isUnique && attempts < 10) {
                    const existing = await db.collection('residents')
                        .where('healthId', '==', healthId).limit(1).get();
                    if (existing.empty) {
                        isUnique = true;
                    } else {
                        healthId = `B86${randomLetters(6)}`;
                        attempts++;
                    }
                }
                if (!isUnique) {
                    alert('Could not generate a unique Health ID. Please try again.');
                    btn.disabled = false;
                    btn.textContent = 'DONE';
                    return;
                }

                await db.collection('residents').add({
                    healthId,
                    surname,
                    suffix,
                    firstName: firstname,
                    middleName: middlename,
                    dateOfBirth,
                    placeOfBirth,
                    nationality,
                    outsidePH,
                    age,
                    sex,
                    civilStatus,
                    bloodType,
                    occupation,
                    address,
                    contactNumber: contact,
                    email,
                    isPwd,
                    disability,
                    isMedication,
                    medicationName: medName,
                    medicationDosage: medDosage,
                    medicationQty: medQty,
                    condition,
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

                // Auto-create maintenance log if on medication
                if (isMedication && medName) {
                    const medQtyNum = parseInt(medQty, 10) || 0;
                    const residentFullName = [firstname, surname].filter(Boolean).join(' ');
                    const today = new Date();
                    const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

                    const logData = {
                        date: dateStr,
                        residentName: residentFullName,
                        healthId: healthId,
                        indication: condition || 'N/A',
                        medicineName: medName,
                        quantity: medQtyNum,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    };

                    try {
                        const medSnap = await db.collection('medicines').get();
                        const medDoc = medSnap.docs.find(d => (d.data().name || '').toLowerCase() === medName.toLowerCase());

                        if (medDoc && medDoc.data().quantity >= medQtyNum) {
                            const batch = db.batch();
                            batch.update(db.collection('medicines').doc(medDoc.id), {
                                quantity: firebase.firestore.FieldValue.increment(-medQtyNum)
                            });
                            batch.set(db.collection('maintenanceLogs').doc(), logData);
                            await batch.commit();
                        } else if (medDoc) {
                            alert(`Insufficient stock for ${medName}. Available: ${medDoc.data().quantity}, Needed: ${medQtyNum}. Maintenance log was not created.`);
                        } else {
                            alert(`Medicine "${medName}" not found in inventory. Maintenance log was not created.`);
                        }
                    } catch (logErr) {
                        console.warn('Could not create maintenance log:', logErr);
                    }
                }

                closeAddResidentModal();
                loadResidents();
                alert(`Resident registered successfully!\nHealth ID: ${healthId}`);
            } catch (error) {
                console.error('Error adding resident:', error);
                alert('Error saving record: ' + error.message);
            } finally {
                btn.disabled = false;
                btn.textContent = 'DONE';
            }
        });
    }

    // Init
    loadResidents();
});