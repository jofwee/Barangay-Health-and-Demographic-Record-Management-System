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
            updateMedicationsNeeds(allLogs); // Update the progress bars
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
                        <button class="inventory-action-btn inventory-action-btn--danger" onclick="deleteLog('${log.id}')">Delete</button>
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
    };

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

    window.deleteLog = async function(docId) {
        if (confirm('Are you sure you want to delete this log?')) {
            try {
                await db.collection('maintenanceLogs').doc(docId).delete();
                loadLogs(); 
            } catch (error) {
                console.error('Error deleting:', error);
                alert('Could not delete record.');
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
                // --- THE INVENTORY BRIDGE: DEDUCT STOCK ---
                if (!docId) {
                    const medQuery = await db.collection('medicines')
                                           .where('name', '==', medNameInput)
                                           .limit(1)
                                           .get();
                    
                    if (!medQuery.empty) {
                        const medDoc = medQuery.docs[0];
                        const currentQty = medDoc.data().quantity;
                        
                        if (currentQty < qtyInput) {
                            alert(`Warning: Only ${currentQty} ${medNameInput} left in stock. Proceeding, but inventory will show negative.`);
                        }
                        
                        await db.collection('medicines').doc(medDoc.id).update({
                            quantity: firebase.firestore.FieldValue.increment(-qtyInput)
                        });
                    } else {
                        alert(`Note: "${medNameInput}" wasn't found in the Inventory. Log saved, but no stock was deducted.`);
                    }
                }
                // ------------------------------------------

                if (docId) {
                    // Update existing log
                    await db.collection('maintenanceLogs').doc(docId).update(logData);
                } else {
                    // Create new log
                    logData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    await db.collection('maintenanceLogs').add(logData);

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
    function updateMedicationsNeeds(logs) {
        if (logs.length === 0) {
            medsNeedsList.innerHTML = '<li><p style="color: #666; font-size: 0.9rem;">No data available yet.</p></li>';
            return;
        }

        // Count frequency of each medicine requested
        const counts = {};
        let maxCount = 0;

        logs.forEach(log => {
            const medName = log.medicineName;
            counts[medName] = (counts[medName] || 0) + 1;
            if (counts[medName] > maxCount) {
                maxCount = counts[medName];
            }
        });

        // Convert to array and sort by highest need
        const sortedMeds = Object.keys(counts).map(name => {
            return {
                name: name,
                count: counts[name],
                // Calculate percentage based on the highest requested medicine = 100%
                percentage: Math.round((counts[name] / maxCount) * 100)
            };
        }).sort((a, b) => b.count - a.count);

        // Take top 5 to fit the panel perfectly
        const top5 = sortedMeds.slice(0, 5);

        // Render HTML
        medsNeedsList.innerHTML = '';
        top5.forEach(med => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="meds-label">${escapeHTML(med.name)}</span>
                <div class="meds-progress">
                    <div class="meds-progress__fill" style="--value: ${med.percentage}%;"></div>
                </div>
            `;
            medsNeedsList.appendChild(li);
        });
    }

    // ── Helper ────────────────────────────────────────────────
    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Run the fetch when the page loads
    loadLogs();
});