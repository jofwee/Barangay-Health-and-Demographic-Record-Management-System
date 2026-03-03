// dashboard-logic.js

document.addEventListener('DOMContentLoaded', () => {
    const pieContainer = document.querySelector('.pie');
    const barsContainer = document.querySelector('.bars');

    // ── Dynamic "As of" date ──────────────────────────────
    const eyebrow = document.getElementById('dashboardEyebrow');
    if (eyebrow) {
        const now = new Date();
        eyebrow.textContent = 'As of ' + now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    // ── Show loading state immediately ──────────────────────
    if (barsContainer) {
        barsContainer.innerHTML = '<p style="text-align:center; width:100%; color:#888;">Loading health records...</p>';
    }

    // ── 1. Fetch Data ─────────────────────────────────────────
    async function loadDashboardData() {
        try {
            // Fetch Residents for the Pie Chart
            const residentsSnap = await db.collection('residents').get();
            const residents = residentsSnap.docs.map(doc => doc.data());
            
            // Fetch Maintenance Logs for the Bar Chart
            const logsSnap = await db.collection('maintenanceLogs').get();
            const logs = logsSnap.docs.map(doc => doc.data());
            
            renderPieChart(residents);
            renderBarChart(logs);
        } catch (error) {
            console.error('Error loading dashboard analytics:', error);
        }
    }

    // ── 2. Render Pie Chart (Classification) ──────────────────
    function renderPieChart(residents) {
        if (!pieContainer) return;
        if (residents.length === 0) {
            pieContainer.style.background = '#e9ecef';
            pieContainer.title = 'No residents registered yet';
            // Show empty-state text near the pie
            const parent = pieContainer.closest('.pie-body') || pieContainer.parentElement;
            if (parent && !parent.querySelector('.pie-empty')) {
                const msg = document.createElement('p');
                msg.className = 'pie-empty';
                msg.style.cssText = 'text-align:center;color:#888;font-size:0.85rem;margin-top:0.5rem;';
                msg.textContent = 'No residents registered yet.';
                parent.appendChild(msg);
            }
            return;
        }

        // Tally up the classifications
        const counts = {
            'Infant': 0, 
            'Kids': 0, 
            'Teenagers': 0,
            'Adults': 0, 
            'Senior Citizens': 0, 
            'PWDs': 0
        };

        residents.forEach(r => {
            const c = r.classification;
            // Handle plural mismatch just in case (Infant vs Infants)
            if (counts[c] !== undefined) {
                counts[c]++;
            } else if (c === 'Infants') {
                counts['Infant']++;
            }
        });

        const total = residents.length;
        
        // Define colors that match your CSS/Legend vibes
        const colorMap = {
            'Infant': '#20c997',        // Mint
            'Kids': '#0dcaf0',          // Sea
            'Teenagers': '#ffc107',     // Yellow
            'Adults': '#198754',        // Green
            'Senior Citizens': '#dc3545',// Red
            'PWDs': '#d63384'           // Pink
        };

        // Build a CSS conic-gradient dynamically!
        let gradientParts = [];
        let currentAngle = 0;

        for (const [cls, count] of Object.entries(counts)) {
            if (count > 0) {
                const percentage = (count / total) * 100;
                const endAngle = currentAngle + percentage;
                // e.g., "#20c997 0% 25%"
                gradientParts.push(`${colorMap[cls]} ${currentAngle}% ${endAngle}%`);
                currentAngle = endAngle;
            }
        }

        // Apply the dynamic gradient to the pie div
        if (gradientParts.length > 0) {
            pieContainer.style.background = `conic-gradient(${gradientParts.join(', ')})`;
            pieContainer.style.borderRadius = '50%'; 
        } else {
            pieContainer.style.background = '#e9ecef'; // Empty state gray
        }
    }

    // ── 3. Render Bar Chart (Health Trends) ───────────────────
    function renderBarChart(logs) {
        if (!barsContainer) return;
        
        barsContainer.innerHTML = ''; // Clear out the hardcoded HTML bars

        if (logs.length === 0) {
            barsContainer.innerHTML = '<p style="text-align:center; width:100%; color:#888;">No health records logged yet.</p>';
            return;
        }

        // Count occurrences of each illness/indication
        const counts = {};
        logs.forEach(log => {
            const rawIndication = log.indication || 'Unknown';
            // Capitalize just the first letter so "fever" and "Fever" count as the same thing
            const indication = rawIndication.charAt(0).toUpperCase() + rawIndication.slice(1).toLowerCase();
            counts[indication] = (counts[indication] || 0) + 1;
        });

        // Convert to array, sort by highest count, take the top 6
        const sortedTrends = Object.keys(counts)
            .map(name => ({ name: name, count: counts[name] }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 6);

        // Calculate percentage relative to the highest illness so the bars scale nicely
        const maxCount = sortedTrends.length > 0 ? sortedTrends[0].count : 1;

        // Generate the new HTML bars
        sortedTrends.forEach(trend => {
            const safeName = escapeHTML(trend.name);
            const percentage = Math.round((trend.count / maxCount) * 100);
            const barHTML = `
                <div class="bar">
                    <div class="bar__fill" style="--value: ${percentage}%" title="${trend.count} cases recorded"></div>
                    <span>${safeName}</span>
                </div>
            `;
            barsContainer.innerHTML += barHTML;
        });
    }

    // Initialize
    loadDashboardData();
});