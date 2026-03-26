// inventory-logic.js

document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.querySelector('.inventory-table tbody');
    const searchInput = document.querySelector('.inventory-search input');
    const filterPills = document.querySelectorAll('.filter-pill');
    
    // Modal Elements
    const medicineModal = document.getElementById('medicineModal');
    const medicineForm = document.getElementById('medicineForm');
    const modalTitle = document.getElementById('medicineModalTitle');
    
    let allMedicines = []; 
    let currentFilter = 'All';

    // ── 1. Fetch Data from Firestore ──────────────────────────
    async function loadMedicines() {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Loading inventory...</td></tr>';
        
        try {
            const snapshot = await db.collection('medicines').orderBy('name', 'asc').get();
            
            allMedicines = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            applyFiltersAndRender();
        } catch (error) {
            console.error('Error fetching medicines:', error);
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">Failed to load inventory data.</td></tr>';
        }
    }

    // ── 2. Determine Stock Status ─────────────────────────────
    function getStockStatus(qty) {
        if (qty <= 0) return { label: 'Out of Stock', class: 'status-badge--danger' };
        if (qty <= 20) return { label: 'Low Stock', class: 'status-badge--warn' };
        return { label: 'In Stock', class: 'status-badge--ok' };
    }

    // ── 3. Render the Table ───────────────────────────────────
    function renderTable(dataToRender) {
        tableBody.innerHTML = '';

        if (dataToRender.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No medicines found in inventory.</td></tr>';
            return;
        }

        dataToRender.forEach(med => {
            const tr = document.createElement('tr');
            const status = getStockStatus(med.quantity);
            
            // Format the date for the table (MM/DD/YYYY)
            let expDateString = 'N/A';
            if (med.expirationDate) {
                const parts = med.expirationDate.split('-'); // Handles YYYY-MM-DD
                if (parts.length === 3) {
                    expDateString = `${parts[1]}/${parts[2]}/${parts[0]}`;
                }
            }

            tr.innerHTML = `
                <td>${escapeHTML(med.name)}</td>
                <td>${escapeHTML(med.category)}</td>
                <td>${escapeHTML(med.quantity.toString())}</td>
                <td>${escapeHTML(med.unit)}</td>
                <td>${escapeHTML(expDateString)}</td>
                <td>
                    <span class="status-badge ${status.class}">
                        <span class="status-badge__dot"></span>
                        ${status.label}
                    </span>
                </td>
                <td>
                    <div class="inventory-row-actions">
                        <button class="inventory-action-btn" onclick="editMedicine('${med.id}')">Edit</button>
                        <button class="inventory-action-btn inventory-action-btn--danger" onclick="deleteMedicine('${med.id}', this)">Delete</button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    // ── 4. Search and Filter Logic ────────────────────────────
    function applyFiltersAndRender() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        
        const filteredData = allMedicines.filter(med => {
            const name = (med.name || '').toLowerCase();
            const category = (med.category || '').toLowerCase();
            const matchesSearch = name.includes(searchTerm) || category.includes(searchTerm);
            
            const statusLabel = getStockStatus(med.quantity).label;
            const matchesFilter = currentFilter === 'All' || statusLabel === currentFilter;
            
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

    // ── 5. Global Actions (Modal, Delete, Edit, Save) ─────────
    window.openAddMedicineModal = function() {
        medicineForm.reset();
        document.getElementById('med-doc-id').value = ''; // Clear ID for new entry
        modalTitle.textContent = 'Add New Medicine';
        medicineModal.style.display = 'flex';
    };

    window.closeMedicineModal = function() {
        medicineModal.style.display = 'none';
        medicineForm.reset();
    };

    window.editMedicine = function(docId) {
        const med = allMedicines.find(m => m.id === docId);
        if (!med) return;

        document.getElementById('med-doc-id').value = med.id;
        document.getElementById('med-name').value = med.name || '';
        document.getElementById('med-category').value = med.category || '';
        document.getElementById('med-qty').value = med.quantity || 0;
        document.getElementById('med-unit').value = med.unit || '';
        document.getElementById('med-exp').value = med.expirationDate || '';

        modalTitle.textContent = 'Edit Medicine';
        medicineModal.style.display = 'flex';
    };

    window.deleteMedicine = async function(docId, btn) {
        if (confirm('Are you sure you want to delete this medicine from the inventory?')) {
            if (btn) { btn.disabled = true; btn.textContent = 'Deleting...'; }
            try {
                const med = allMedicines.find(m => m.id === docId);
                await db.collection('medicines').doc(docId).delete();

                // --- RECORD ACTIVITY LOG ---
                if (auth.currentUser) {
                    await db.collection('activityLogs').add({
                        userEmail: auth.currentUser.email,
                        action: `Deleted medicine: ${med ? med.name : 'Unknown'}`,
                        location: 'Medicine Inventory',
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }

                loadMedicines();
            } catch (error) {
                console.error('Error deleting:', error);
                alert('Could not delete medicine.');
                if (btn) { btn.disabled = false; btn.textContent = 'Delete'; }
            }
        }
    };

    // Form Submission (Handles both Add and Edit)
    if (medicineForm) {
        medicineForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const saveBtn = document.getElementById('saveMedBtn');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';

            const docId = document.getElementById('med-doc-id').value;
            const medicineData = {
                name: document.getElementById('med-name').value.trim(),
                category: document.getElementById('med-category').value.trim(),
                quantity: parseInt(document.getElementById('med-qty').value.trim(), 10),
                unit: document.getElementById('med-unit').value.trim(),
                expirationDate: document.getElementById('med-exp').value,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            try {
                if (docId) {
                    // Update existing
                    await db.collection('medicines').doc(docId).update(medicineData);
                } else {
                    // Create new
                    medicineData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    await db.collection('medicines').add(medicineData);
                }
                
                // --- RECORD ACTIVITY LOG ---
                if (auth.currentUser) {
                    const actionMsg = docId ? `Updated medicine: ${medicineData.name}` : `Added new medicine: ${medicineData.name}`;
                    await db.collection('activityLogs').add({
                        userEmail: auth.currentUser.email,
                        action: actionMsg,
                        location: 'Medicine Inventory',
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
                
                closeMedicineModal();
                loadMedicines(); // Refresh the table!
            } catch (error) {
                console.error('Error saving medicine:', error);
                alert('Error saving record: ' + error.message);
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Medicine';
            }
        });
    }

    // Run the fetch when the page loads
    loadMedicines();

    // ── 6. Export PDF ──────────────────────────────────────────
    const exportBtn = document.getElementById('exportPdfBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            const section = document.querySelector('.inventory-section');
            if (!section) return;

            exportBtn.disabled = true;
            const origText = exportBtn.innerHTML;
            exportBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Generating...';

            try {
                // Clone the section for off-screen rendering
                const clone = section.cloneNode(true);
                clone.style.position = 'absolute';
                clone.style.left = '-9999px';
                clone.style.top = '0';
                clone.style.width = section.offsetWidth + 'px';
                document.body.appendChild(clone);

                // Hide elements in the clone
                const controlsClone = clone.querySelector('.inventory-controls');
                const filtersClone = clone.querySelector('.inventory-filters');
                const exportBtnClone = clone.querySelector('#exportPdfBtn');
                const actionCells = clone.querySelectorAll('.inventory-row-actions, th:last-child, td:last-child');

                if (controlsClone) controlsClone.style.display = 'none';
                if (filtersClone) filtersClone.style.display = 'none';
                if (exportBtnClone) exportBtnClone.style.display = 'none';
                actionCells.forEach(el => el.style.display = 'none');

                const canvas = await html2canvas(clone, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#f5f6fa',
                    logging: false
                });

                // Remove clone after capture
                document.body.removeChild(clone);

                const { jsPDF } = window.jspdf;
                const imgData = canvas.toDataURL('image/png');
                const imgW = canvas.width;
                const imgH = canvas.height;

                const isLandscape = imgW > imgH;
                const pdf = new jsPDF({
                    orientation: isLandscape ? 'landscape' : 'portrait',
                    unit: 'mm',
                    format: 'a4'
                });

                const pageW = pdf.internal.pageSize.getWidth();
                const pageH = pdf.internal.pageSize.getHeight();
                const margin = 10;
                const maxW = pageW - margin * 2;
                const maxH = pageH - margin * 2;
                const ratio = Math.min(maxW / imgW, maxH / imgH);
                const w = imgW * ratio;
                const h = imgH * ratio;
                const x = (pageW - w) / 2;
                const y = margin;

                pdf.addImage(imgData, 'PNG', x, y, w, h);

                const dateStr = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
                pdf.save(`Medicine-Inventory_${dateStr}.pdf`);
            } catch (err) {
                console.error('PDF export error:', err);
                alert('Failed to generate PDF. Please try again.');
            } finally {
                exportBtn.disabled = false;
                exportBtn.innerHTML = origText;
            }
        });
    }
});