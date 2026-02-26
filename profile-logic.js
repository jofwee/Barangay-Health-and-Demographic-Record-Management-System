// profile-logic.js

document.addEventListener('DOMContentLoaded', () => {
    const activityTableBody = document.querySelector('.activity-table tbody');

    // Wait for Firebase Auth to confirm who is logged in
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            loadRecentActivities(user.email);
        }
    });

    async function loadRecentActivities(userEmail) {
        if (!activityTableBody) return;
        
        activityTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Loading activities...</td></tr>';

        try {
            // Fetch the 5 most recent activities for THIS specific user
            const snap = await db.collection('activityLogs')
                .where('userEmail', '==', userEmail)
                .orderBy('timestamp', 'desc')
                .limit(5)
                .get();

            if (snap.empty) {
                activityTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#666;">No recent activities found.</td></tr>';
                return;
            }

            activityTableBody.innerHTML = ''; // Clear out the loading text

            snap.forEach(doc => {
                const data = doc.data();
                const tr = document.createElement('tr');
                
                // Format the timestamp nicely (e.g., 12/10/2025 | 07:14 PM)
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
                    <td>${escapeHTML(data.action)}</td>
                    <td>${escapeHTML(data.location)}</td>
                `;
                activityTableBody.appendChild(tr);
            });

        } catch (error) {
            console.error("Error loading activities:", error);
            activityTableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:red;">Check console. You may need to click the Firebase Index link in the console error to enable this query.</td></tr>`;
        }
    }

    function escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
});