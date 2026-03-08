// rbi-logic.js

document.addEventListener('DOMContentLoaded', () => {
    const rbiForm = document.querySelector('.rbi-form');
    const submitBtn = document.querySelector('.submit-btn');

    if (!rbiForm) return;

    // ── Auto-calculate Age from Date of Birth ──
    const dobMM = document.getElementById('rbi-dob-mm');
    const dobDD = document.getElementById('rbi-dob-dd');
    const dobYYYY = document.getElementById('rbi-dob-yyyy');
    const ageInput = document.getElementById('rbi-age');

    function calcAge() {
        const mm = parseInt(dobMM.value, 10);
        const dd = parseInt(dobDD.value, 10);
        const yyyy = parseInt(dobYYYY.value, 10);
        if (!mm || !dd || !yyyy || yyyy < 1900) { ageInput.value = ''; return; }
        const today = new Date();
        const birth = new Date(yyyy, mm - 1, dd);
        if (isNaN(birth.getTime())) { ageInput.value = ''; return; }
        let age = today.getFullYear() - birth.getFullYear();
        const mDiff = today.getMonth() - birth.getMonth();
        if (mDiff < 0 || (mDiff === 0 && today.getDate() < birth.getDate())) age--;
        ageInput.value = age >= 0 ? age : '';
    }
    if (dobMM && dobDD && dobYYYY) {
        dobMM.addEventListener('input', calcAge);
        dobDD.addEventListener('input', calcAge);
        dobYYYY.addEventListener('input', calcAge);
    }

    // ── PWD toggle ──
    const pwdRadios = document.querySelectorAll('input[name="pwd"]');
    const pwdDetailField = document.getElementById('pwdDetailField');
    pwdRadios.forEach(r => r.addEventListener('change', () => {
        pwdDetailField.style.display = r.value === 'yes' && r.checked ? 'flex' : 'none';
    }));

    // ── Medication toggle ──
    const medRadios = document.querySelectorAll('input[name="medication"]');
    const medicationDetails = document.getElementById('medicationDetails');
    medRadios.forEach(r => r.addEventListener('change', () => {
        medicationDetails.style.display = r.value === 'yes' && r.checked ? 'flex' : 'none';
    }));

    // ── Outside PH toggle (unlock nationality field) ──
    const outsidePHCheckbox = document.getElementById('rbi-outside-ph');
    const nationalityInput = document.getElementById('rbi-nationality');
    if (outsidePHCheckbox && nationalityInput) {
        outsidePHCheckbox.addEventListener('change', () => {
            if (outsidePHCheckbox.checked) {
                nationalityInput.readOnly = false;
                nationalityInput.value = '';
                nationalityInput.placeholder = 'Enter nationality';
                nationalityInput.focus();
            } else {
                nationalityInput.readOnly = true;
                nationalityInput.value = 'Filipino';
                nationalityInput.placeholder = '';
            }
        });
    }

    // ── Condition "Other" toggle ──
    const conditionSelect = document.getElementById('rbi-condition');
    const conditionOtherField = document.getElementById('conditionOtherField');
    if (conditionSelect) {
        conditionSelect.addEventListener('change', () => {
            conditionOtherField.style.display = conditionSelect.value === 'Other' ? 'flex' : 'none';
        });
    }

    // ── Form Submission ──
    rbiForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        // 1. Gather Data
        const surname = document.getElementById('rbi-surname').value.trim();
        const suffix = document.getElementById('rbi-suffix').value.trim();
        const firstname = document.getElementById('rbi-firstname').value.trim();
        const middlename = document.getElementById('rbi-middlename').value.trim();
        const age = ageInput.value.trim();
        const sex = document.getElementById('rbi-sex').value.trim();
        const civilStatus = document.getElementById('rbi-civil-status').value.trim();
        const bloodType = document.getElementById('rbi-blood-type').value;
        const occupation = document.getElementById('rbi-occupation').value.trim();
        const streetNo = document.getElementById('rbi-street-no').value.trim();
        const streetName = document.getElementById('rbi-street-name').value.trim();
        const address = [streetNo, streetName].filter(Boolean).join(' ');
        const contact = document.getElementById('rbi-contact').value.trim();
        const email = document.getElementById('rbi-email').value.trim();
        const pobProvince = document.getElementById('rbi-pob-province').value.trim();
        const pobCity = document.getElementById('rbi-pob-city').value.trim();
        const placeOfBirth = [pobProvince, pobCity].filter(Boolean).join(', ');
        const nationality = document.getElementById('rbi-nationality').value.trim();
        const outsidePH = document.getElementById('rbi-outside-ph').checked;

        // DOB
        const mm = dobMM.value.trim();
        const dd = dobDD.value.trim();
        const yyyy = dobYYYY.value.trim();
        const dateOfBirth = (mm && dd && yyyy) ? `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}` : '';

        // Medical
        const isPwd = document.querySelector('input[name="pwd"]:checked')?.value === 'yes';
        const disability = isPwd ? (document.getElementById('rbi-disability')?.value.trim() || '') : '';
        const isMedication = document.querySelector('input[name="medication"]:checked')?.value === 'yes';
        const medName = isMedication ? (document.getElementById('rbi-med-name')?.value.trim() || '') : '';
        const medDosage = isMedication ? (document.getElementById('rbi-med-dosage')?.value.trim() || '') : '';
        const medQty = isMedication ? (document.getElementById('rbi-med-qty')?.value.trim() || '') : '';
        const conditionVal = isMedication ? (document.getElementById('rbi-condition')?.value || '') : '';
        const conditionOther = isMedication ? (document.getElementById('rbi-condition-other')?.value.trim() || '') : '';
        const condition = conditionVal === 'Other' ? conditionOther : conditionVal;

        // 2. Validation
        if (!surname || !firstname || !age || !sex || !address) {
            alert('Please fill in all required fields (Surname, First Name, Date of Birth, Sex, Address).');
            submitBtn.disabled = false;
            submitBtn.textContent = 'DONE';
            return;
        }

        // 3. Generate Health ID (B86 + 6 random uppercase letters)
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
                alert('Could not generate a unique Health ID after multiple attempts. Please try again.');
                submitBtn.disabled = false;
                submitBtn.textContent = 'DONE';
                return;
            }
        } catch (err) {
            console.warn('Could not check Health ID uniqueness:', err);
        }

        // 4. Classification
        const ageNum = parseInt(age, 10);
        let classification = 'Adults';
        if (isPwd) {
            classification = 'PWDs';
        } else if (ageNum < 5) {
            classification = 'Infant';
        } else if (ageNum <= 12) {
            classification = 'Kids';
        } else if (ageNum <= 19) {
            classification = 'Teenagers';
        } else if (ageNum <= 59) {
            classification = 'Adults';
        } else if (ageNum >= 60) {
            classification = 'Senior Citizens';
        }

        // 5. Save to Firestore
        try {
            await db.collection('residents').add({
                healthId,
                surname,
                suffix,
                firstName: firstname,
                middleName: middlename,
                age: ageNum,
                dateOfBirth,
                placeOfBirth,
                nationality,
                outsidePH,
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

            // Activity log
            if (auth.currentUser) {
                await db.collection('activityLogs').add({
                    userEmail: auth.currentUser.email,
                    action: `Registered new resident: ${firstname} ${surname}`,
                    location: 'RBI Form',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            // Auto-create maintenance log if resident is on medication
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

                // Try to deduct from medicine inventory
                try {
                    const medSnap = await db.collection('medicines').get();
                    const medDoc = medSnap.docs.find(d => (d.data().name || '').toLowerCase() === medName.toLowerCase());

                    if (medDoc) {
                        const currentQty = medDoc.data().quantity;
                        if (currentQty >= medQtyNum) {
                            const batch = db.batch();
                            batch.update(db.collection('medicines').doc(medDoc.id), {
                                quantity: firebase.firestore.FieldValue.increment(-medQtyNum)
                            });
                            batch.set(db.collection('maintenanceLogs').doc(), logData);
                            await batch.commit();
                        } else {
                            alert(`Insufficient stock for ${medName}. Available: ${currentQty}, Needed: ${medQtyNum}. Maintenance log was not created.`);
                        }
                    } else {
                        alert(`Medicine "${medName}" not found in inventory. Maintenance log was not created.`);
                    }
                } catch (logErr) {
                    console.warn('Could not create maintenance log:', logErr);
                }
            }

            // 6. Show success modal
            showSuccessModal(healthId);
            rbiForm.reset();
            if (pwdDetailField) pwdDetailField.style.display = 'none';
            if (medicationDetails) medicationDetails.style.display = 'none';
            if (conditionOtherField) conditionOtherField.style.display = 'none';

        } catch (error) {
            console.error('Error adding resident: ', error);
            alert('Error saving record: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'DONE';
        }
    });

    // ── Success Modal ──
    function showSuccessModal(healthId) {
        // Remove existing modal if any
        const existing = document.getElementById('rbiSuccessModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'rbiSuccessModal';
        modal.className = 'rbi-success-overlay';
        modal.innerHTML = `
            <div class="rbi-success-card">
                <div class="rbi-success-header">
                    <h2>THANK YOU FOR REGISTERING!</h2>
                </div>
                <div class="rbi-success-body">
                    <p>Please save or remember your Unique Health ID Number, as it will be used for future transactions and references at the Barangay.</p>
                    <span class="rbi-success-label">HEALTH ID NUMBER:</span>
                    <span class="rbi-success-id">${healthId}</span>
                </div>
                <button class="rbi-success-close" id="closeSuccessModal">Close</button>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('closeSuccessModal').addEventListener('click', () => {
            modal.remove();
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }
});