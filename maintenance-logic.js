// maintenance-logic.js

document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('maintenanceTableBody');
    const searchInput = document.querySelector('.inventory-search input');
    const medsNeedsList = document.getElementById('medsNeedsList');
    
    // Modal Elements
    const maintenanceModal = document.getElementById('maintenanceModal');
    const maintenanceForm = document.getElementById('maintenanceForm');
    const modalTitle = document.getElementById('maintenanceModalTitle');
    
    let allLogs = []; 

    // ── Populate medicine dropdown from Firestore ──
    async function loadMedicineOptions() {
        const medSelect = document.getElementById('log-medname');
        if (!medSelect) return;
        try {
            const snap = await db.collection('medicines').orderBy('name').get();
            snap.forEach(doc => {
                const d = doc.data();
                if (d.name) {
                    const opt = document.createElement('option');
                    opt.value = d.name;
                    opt.textContent = d.name;
                    medSelect.appendChild(opt);
                }
            });
        } catch (err) { console.warn('Could not load medicines:', err); }
    }
    loadMedicineOptions();

    // ── 1. Fetch Data from Firestore ──────────────────────────
    async function loadLogs() {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Loading records...</td></tr>';
        
        try {
            // Fetch logs ordered by date distributed
            const snapshot = await db.collection('maintenanceLogs').orderBy('date', 'desc').get();
            
            allLogs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            applyFiltersAndRender();
            updateMedicationsNeeds(); // Update the progress bars from residents' medication data
        } catch (error) {
            console.error('Error fetching maintenance logs:', error);
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">Failed to load records.</td></tr>';
        }
    }

    // ── 2. Render the Table ───────────────────────────────────
    function renderTable(dataToRender) {
        tableBody.innerHTML = '';

        if (dataToRender.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No records found.</td></tr>';
            return;
        }

        dataToRender.forEach(log => {
            const tr = document.createElement('tr');
            
            // Format the date (MM/DD/YY to match your mockup)
            let formattedDate = 'N/A';
            if (log.date) {
                const parts = log.date.split('-'); // YYYY-MM-DD
                if (parts.length === 3) {
                    formattedDate = `${parts[1]}/${parts[2]}/${parts[0].substring(2)}`;
                }
            }

            tr.innerHTML = `
                <td>${escapeHTML(formattedDate)}</td>
                <td>${escapeHTML(log.residentName)}</td>
                <td>${escapeHTML(log.healthId)}</td>
                <td>${escapeHTML(log.indication)}</td>
                <td>${escapeHTML(log.medicineName)}</td>
                <td>${escapeHTML(log.quantity.toString())}</td>
                <td>
                    <div class="inventory-row-actions">
                        <button class="inventory-action-btn" onclick="editLog('${log.id}')">Edit</button>
                        <button class="inventory-action-btn inventory-action-btn--danger" onclick="deleteLog('${log.id}', this)">Delete</button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    // ── 3. Search Logic ───────────────────────────────────────
    function applyFiltersAndRender() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        
        const filteredData = allLogs.filter(log => {
            const name = (log.residentName || '').toLowerCase();
            const healthId = (log.healthId || '').toLowerCase();
            return name.includes(searchTerm) || healthId.includes(searchTerm);
        });

        renderTable(filteredData);
    }

    if (searchInput) searchInput.addEventListener('input', applyFiltersAndRender);

    // ── 4. Global Actions (Modal, Delete, Edit, Save) ─────────
    window.openMaintenanceModal = function() {
        maintenanceForm.reset();
        document.getElementById('log-doc-id').value = ''; 
        
        // Default to today's date
        document.getElementById('log-date').valueAsDate = new Date();
        
        modalTitle.textContent = 'Add Maintenance Record';
        maintenanceModal.style.display = 'flex';
    };

    window.closeMaintenanceModal = function() {
        maintenanceModal.style.display = 'none';
        maintenanceForm.reset();
        const nameInput = document.getElementById('log-name');
        if (nameInput) { nameInput.readOnly = false; nameInput.style.opacity = ''; }
    };

    // ── Auto-populate resident name from Health ID ──
    const logHealthIdInput = document.getElementById('log-healthid');
    const logNameInput = document.getElementById('log-name');
    let healthIdTimeout = null;

    if (logHealthIdInput && logNameInput) {
        logHealthIdInput.addEventListener('input', () => {
            clearTimeout(healthIdTimeout);
            const hid = logHealthIdInput.value.trim();
            if (!hid) {
                logNameInput.value = '';
                logNameInput.readOnly = false;
                logNameInput.style.opacity = '';
                return;
            }
            healthIdTimeout = setTimeout(async () => {
                try {
                    const snap = await db.collection('residents')
                        .where('healthId', '==', hid).limit(1).get();
                    if (!snap.empty) {
                        const r = snap.docs[0].data();
                        const fullName = [r.firstName, r.surname].filter(Boolean).join(' ');
                        logNameInput.value = fullName;
                        logNameInput.readOnly = true;
                        logNameInput.style.opacity = '0.7';
                    } else {
                        logNameInput.value = '';
                        logNameInput.readOnly = false;
                        logNameInput.style.opacity = '';
                    }
                } catch (err) {
                    console.warn('Health ID lookup failed:', err);
                }
            }, 400);
        });
    }

    window.editLog = function(docId) {
        const log = allLogs.find(l => l.id === docId);
        if (!log) return;

        document.getElementById('log-doc-id').value = log.id;
        document.getElementById('log-date').value = log.date || '';
        document.getElementById('log-name').value = log.residentName || '';
        document.getElementById('log-healthid').value = log.healthId || '';
        document.getElementById('log-indication').value = log.indication || '';
        document.getElementById('log-medname').value = log.medicineName || '';
        document.getElementById('log-qty').value = log.quantity || 1;

        modalTitle.textContent = 'Edit Maintenance Record';
        maintenanceModal.style.display = 'flex';
    };

    // Helper: find medicine doc by name (case-insensitive, cached)
    let _medicinesCache = null;
    let _medicinesCacheTime = 0;
    const CACHE_TTL = 30000; // 30 seconds

    async function findMedicineByName(name) {
        const now = Date.now();
        if (!_medicinesCache || (now - _medicinesCacheTime) > CACHE_TTL) {
            _medicinesCache = await db.collection('medicines').get();
            _medicinesCacheTime = now;
        }
        const lowerName = name.toLowerCase();
        const match = _medicinesCache.docs.find(d => (d.data().name || '').toLowerCase() === lowerName);
        return match || null;
    }

    // Invalidate cache after writes that change medicine data
    function invalidateMedicinesCache() {
        _medicinesCache = null;
        _medicinesCacheTime = 0;
    }

    window.deleteLog = async function(docId, btn) {
        if (confirm('Are you sure you want to delete this log?')) {
            if (btn) { btn.disabled = true; btn.textContent = 'Deleting...'; }
            try {
                const log = allLogs.find(l => l.id === docId);
                const batch = db.batch();

                // Restore stock to inventory
                if (log && log.medicineName) {
                    const medDoc = await findMedicineByName(log.medicineName);
                    if (medDoc) {
                        batch.update(db.collection('medicines').doc(medDoc.id), {
                            quantity: firebase.firestore.FieldValue.increment(log.quantity || 0)
                        });
                    }
                }

                batch.delete(db.collection('maintenanceLogs').doc(docId));
                await batch.commit();
                invalidateMedicinesCache();

                // Activity log
                if (auth.currentUser) {
                    await db.collection('activityLogs').add({
                        userEmail: auth.currentUser.email,
                        action: `Deleted maintenance record${log ? ': ' + log.quantity + 'x ' + log.medicineName + ' for ' + log.residentName : ''}`,
                        location: 'Residents\' Maintenance',
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }

                loadLogs(); 
            } catch (error) {
                console.error('Error deleting:', error);
                alert('Could not delete record.');
                if (btn) { btn.disabled = false; btn.textContent = 'Delete'; }
            }
        }
    };

    // Form Submission (Add and Edit)
    if (maintenanceForm) {
        maintenanceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const saveBtn = document.getElementById('saveLogBtn');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';

            const docId = document.getElementById('log-doc-id').value;
            const medNameInput = document.getElementById('log-medname').value.trim();
            const qtyInput = parseInt(document.getElementById('log-qty').value.trim(), 10);

            const logData = {
                date: document.getElementById('log-date').value,
                residentName: document.getElementById('log-name').value.trim(),
                healthId: document.getElementById('log-healthid').value.trim(),
                indication: document.getElementById('log-indication').value.trim(),
                medicineName: medNameInput,
                quantity: qtyInput,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            try {
                if (docId) {
                    // ── EDIT: Sync inventory (atomic batch) ──────────────────
                    const oldLog = allLogs.find(l => l.id === docId);
                    const newMedDoc = await findMedicineByName(medNameInput);

                    if (newMedDoc) {
                        let available = newMedDoc.data().quantity;
                        if (oldLog && oldLog.medicineName.toLowerCase() === medNameInput.toLowerCase()) {
                            available += oldLog.quantity;
                        }
                        if (available < qtyInput) {
                            alert(`Insufficient stock: Only ${available} ${medNameInput} available.`);
                            saveBtn.disabled = false;
                            saveBtn.textContent = 'Save Record';
                            return;
                        }
                    }

                    const batch = db.batch();

                    // Restore old medicine stock
                    if (oldLog && oldLog.medicineName) {
                        const oldMedDoc = (oldLog.medicineName.toLowerCase() === medNameInput.toLowerCase() && newMedDoc)
                            ? newMedDoc
                            : await findMedicineByName(oldLog.medicineName);
                        if (oldMedDoc) {
                            batch.update(db.collection('medicines').doc(oldMedDoc.id), {
                                quantity: firebase.firestore.FieldValue.increment(oldLog.quantity)
                            });
                        }
                    }

                    // Deduct new medicine stock
                    if (newMedDoc) {
                        batch.update(db.collection('medicines').doc(newMedDoc.id), {
                            quantity: firebase.firestore.FieldValue.increment(-qtyInput)
                        });
                    }

                    // Update the log document
                    batch.update(db.collection('maintenanceLogs').doc(docId), logData);
                    await batch.commit();
                    invalidateMedicinesCache();

                    // Activity log for edit
                    if (auth.currentUser) {
                        await db.collection('activityLogs').add({
                            userEmail: auth.currentUser.email,
                            action: `Edited maintenance: ${qtyInput}x ${medNameInput} for ${logData.residentName}`,
                            location: 'Residents\' Maintenance',
                            timestamp: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    }

                } else {
                    // ── NEW: Deduct stock atomically (block if insufficient) ──
                    const medDoc = await findMedicineByName(medNameInput);
                    
                    if (medDoc) {
                        const currentQty = medDoc.data().quantity;
                        
                        if (currentQty < qtyInput) {
                            alert(`Insufficient stock: Only ${currentQty} ${medNameInput} available. Cannot proceed.`);
                            saveBtn.disabled = false;
                            saveBtn.textContent = 'Save Record';
                            return;
                        }

                        const batch = db.batch();
                        batch.update(db.collection('medicines').doc(medDoc.id), {
                            quantity: firebase.firestore.FieldValue.increment(-qtyInput)
                        });
                        logData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                        const newLogRef = db.collection('maintenanceLogs').doc();
                        batch.set(newLogRef, logData);
                        await batch.commit();
                        invalidateMedicinesCache();
                    } else {
                        alert(`Note: "${medNameInput}" wasn't found in the Inventory. Log saved, but no stock was deducted.`);
                        logData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                        await db.collection('maintenanceLogs').add(logData);
                    }

                    // --- RECORD ACTIVITY LOG ---
                    if (auth.currentUser) {
                        await db.collection('activityLogs').add({
                            userEmail: auth.currentUser.email,
                            action: `Dispensed ${qtyInput}x ${medNameInput} to ${logData.residentName}`,
                            location: 'Residents\' Maintenance',
                            timestamp: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    }
                }
                
                closeMaintenanceModal();
                loadLogs(); // Refresh table and progress bars!
            } catch (error) {
                console.error('Error saving record:', error);
                alert('Error saving record: ' + error.message);
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Record';
            }
        });
    }

    // ── 5. Dynamic Progress Bars (Residents' Medications Needs)
    // Pulls from residents' medication data (RBI form), not maintenance logs
    async function updateMedicationsNeeds() {
        try {
            const snapshot = await db.collection('residents')
                .where('isMedication', '==', true)
                .get();

            if (snapshot.empty) {
                medsNeedsList.innerHTML = '<li><p style="color: #666; font-size: 0.9rem;">No data available yet.</p></li>';
                return;
            }

            // Medicine category mapping (edit as needed) — used for pre-defined lists
            const medicineCategories = {
                'All': ['Cefalexin', 'Alaxan', 'Ceterizine', 'Lagundi', 'Amlodipine', 'Metformin'],
                'PWD': ['Alaxan'],
                'Female': ['Ceterizine'],
                'Male': ['Lagundi'],
                'Kids': ['Ceterizine', 'Lagundi'],
                'Adult': ['Cefalexin', 'Alaxan', 'Ceterizine', 'Lagundi', 'Amlodipine', 'Metformin'],
                'Senior': ['Cefalexin', 'Amlodipine']
            };

            // Determine selected category from button group
            let selectedCategory = 'All';
            const btnGroup = document.getElementById('medsCategoryBtnGroup');
            if (btnGroup) {
                const activeBtn = btnGroup.querySelector('.cat-pill-btn.active');
                if (activeBtn) selectedCategory = activeBtn.getAttribute('data-category') || 'All';
            }

            // Helper: decide whether a resident doc matches the selected category
            function residentMatchesCategory(data, category) {
                if (!category || category === 'All') return true;
                const sex = (data.sex || '').toString().toLowerCase();
                const isPwd = !!data.isPwd;
                const classification = (data.classification || '').toString().toLowerCase();
                const age = Number(data.age) || 0;

                    switch (category) {
                        case 'PWD':
                            return isPwd === true;
                        case 'Female':
                            return sex === 'female';
                        case 'Male':
                            return sex === 'male';
                        case 'Infant':
                            return classification.includes('infant') || age < 5;
                        case 'Kids':
                            return classification.includes('kid') || (age >= 5 && age <= 12);
                        case 'Teenagers':
                            return classification.includes('teen') || (age >= 13 && age <= 19);
                        case 'Adult':
                            return classification.includes('adult') || (age >= 20 && age <= 59);
                        case 'Senior':
                            return classification.includes('senior') || age >= 60;
                        default:
                            return true;
                    }
            }

            // Count frequency of each medication from resident records but only for residents matching the category
            const counts = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                if (!data || !data.isMedication) return;
                if (!residentMatchesCategory(data, selectedCategory)) return;

                const rawMedName = (data.medicationName || '').trim();
                if (!rawMedName) return;
                const meds = rawMedName.split(',').map(m => m.trim()).filter(m => m);
                meds.forEach(raw => {
                    const medName = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
                    counts[medName] = (counts[medName] || 0) + 1;
                });
            });

            if (Object.keys(counts).length === 0) {
                medsNeedsList.innerHTML = `<li><p style="color: #666; font-size: 0.9rem;">No medicines found for ${selectedCategory}.</p></li>`;
                return;
            }

            // Build meds list: for 'All' show all meds; for other categories prefer mapped list but fallback to counts
            let medsInCategory = [];
            if (selectedCategory === 'All') {
                medsInCategory = Object.keys(counts).map(name => ({ name, count: counts[name] })).sort((a, b) => b.count - a.count);
            } else {
                const mapped = medicineCategories[selectedCategory] || [];
                medsInCategory = mapped
                    .map(name => ({ name, count: counts[name] || 0 }))
                    .filter(m => m.count > 0)
                    .sort((a, b) => b.count - a.count);
                // If mapping yields nothing, fall back to any meds present in counts
                if (medsInCategory.length === 0) {
                    medsInCategory = Object.keys(counts).map(name => ({ name, count: counts[name] })).sort((a, b) => b.count - a.count).slice(0, 5);
                } else {
                    medsInCategory = medsInCategory.slice(0, 5);
                }
            }

            medsNeedsList.innerHTML = '';
            if (medsInCategory.length === 0) {
                medsNeedsList.innerHTML = `<li><p style="color: #666; font-size: 0.9rem;">No medicines found for ${selectedCategory}.</p></li>`;
                return;
            }

            // Find max count for progress bar
            const maxCount = medsInCategory[0].count;

            medsInCategory.forEach(med => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span class="meds-label">${escapeHTML(med.name)}</span>
                    <div class="meds-progress">
                        <div class="meds-progress__fill" style="--value: ${maxCount ? Math.round((med.count / maxCount) * 100) : 0}%;"></div>
                    </div>
                    <span class="meds-count">${med.count}</span>
                `;
                medsNeedsList.appendChild(li);
            });
        } catch (error) {
            console.error('Error loading medication needs:', error);
            medsNeedsList.innerHTML = '<li><p style="color: #666; font-size: 0.9rem;">Failed to load medication needs.</p></li>';
        }
    }

    // Run the fetch when the page loads
    loadLogs();

    // Add event listeners for category pill buttons after DOM is ready
    setTimeout(() => {
        const btnGroup = document.getElementById('medsCategoryBtnGroup');
        if (btnGroup) {
            btnGroup.querySelectorAll('.cat-pill-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    btnGroup.querySelectorAll('.cat-pill-btn').forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    updateMedicationsNeeds();
                });
            });
        }
    }, 500);
});