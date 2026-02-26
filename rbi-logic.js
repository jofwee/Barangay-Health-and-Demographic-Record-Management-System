// rbi-logic.js

document.addEventListener('DOMContentLoaded', () => {
    const rbiForm = document.querySelector('.rbi-form');
    const submitBtn = document.querySelector('.submit-btn');

    if (!rbiForm) return;

    rbiForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Prevent the page from refreshing
        
        // Disable button to prevent double-clicks
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        // 1. Gather Data from the form inputs
        const surname = document.getElementById('rbi-surname').value.trim();
        const suffix = document.getElementById('rbi-suffix').value.trim();
        const firstname = document.getElementById('rbi-firstname').value.trim();
        const age = document.getElementById('rbi-age').value.trim();
        const middlename = document.getElementById('rbi-middlename').value.trim();
        const sex = document.getElementById('rbi-sex').value.trim();
        const address = document.getElementById('rbi-address').value.trim();
        const contact = document.getElementById('rbi-contact').value.trim();

        // 2. Basic Validation (Ensure required fields aren't empty)
        if (!surname || !firstname || !age || !sex || !address) {
            alert('Please fill in all required fields (Surname, First Name, Age, Sex, Address).');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit';
            return;
        }

        // 3. Generate a Health ID (Format: B86 + Initials + Age + Last 2 digits of current year)
        // Example: Chloe Samantha = CS. Age = 5. Year = 2026. Result = B86CS526
        const initials = (firstname.charAt(0) + surname.charAt(0)).toUpperCase();
        const yearSuffix = new Date().getFullYear().toString().slice(-2);
        const healthId = `B86${initials}${age}${yearSuffix}`;

        // 4. Calculate Classification automatically based on Age
        const ageNum = parseInt(age, 10);
        let classification = 'Adults';
        if (ageNum < 5) classification = 'Infant';
        else if (ageNum <= 12) classification = 'Kids';
        else if (ageNum <= 19) classification = 'Teenagers';
        else if (ageNum <= 59) classification = 'Adults';
        else if (ageNum >= 60) classification = 'Senior Citizens';

        // 5. Save to Firestore
        try {
            await db.collection('residents').add({
                healthId: healthId,
                surname: surname,
                suffix: suffix,
                firstName: firstname,
                middleName: middlename,
                age: ageNum,
                sex: sex,
                address: address,
                contactNumber: contact,
                classification: classification,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                // Store who created this record
                createdBy: auth.currentUser ? auth.currentUser.email : 'Unknown Staff' 
            });

            // --- RECORD ACTIVITY LOG ---
            if (auth.currentUser) {
                await db.collection('activityLogs').add({
                    userEmail: auth.currentUser.email,
                    action: `Registered new resident: ${firstname} ${surname}`,
                    location: 'RBI Form',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            // 6. Success! Reset the form and notify the user
            alert(`Resident successfully registered!\nGenerated Health ID: ${healthId}`);
            rbiForm.reset();

        } catch (error) {
            console.error('Error adding resident: ', error);
            alert('Error saving record: ' + error.message);
        } finally {
            // Re-enable the button
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit';
        }
    });
});