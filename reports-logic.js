// reports-logic.js

document.addEventListener('DOMContentLoaded', () => {
    
    // ── 1. BHW Reports (Monthly Maintenance Logs) ────────────────
    const reportChart = document.querySelector('.report-chart');
    
    async function loadBhwReports() {
        if (!reportChart) return; // Only run on the BHW reports page
        
        try {
            const logsSnap = await db.collection('maintenanceLogs').get();
            const logs = logsSnap.docs.map(doc => doc.data());
            
            // Initialize an array with 12 zeros (one for each month Jan-Dec)
            const monthlyCounts = new Array(12).fill(0);
            
            logs.forEach(log => {
                if (log.date) {
                    // Extract the month from YYYY-MM-DD
                    const monthIndex = parseInt(log.date.split('-')[1], 10) - 1;
                    if (monthIndex >= 0 && monthIndex <= 11) {
                        monthlyCounts[monthIndex]++;
                    }
                }
            });
            
            // Find the highest month to calculate percentages correctly
            const maxCount = Math.max(...monthlyCounts, 1); 
            
            const bars = reportChart.querySelectorAll('.report-bar');
            bars.forEach((bar, index) => {
                const fill = bar.querySelector('.report-bar__fill');
                const count = monthlyCounts[index];
                
                // Scale height based on the busiest month
                const percentage = Math.round((count / maxCount) * 100);
                
                fill.style.height = `${percentage}%`;
                fill.title = `${count} records`; // Hover tooltip
            });
            
        } catch (error) {
            console.error("Error loading BHW reports:", error);
        }
    }

    // ── 2. Staff Reports (Demographics & Gender Split) ───────────
    const demogPanel = document.querySelector('.demog-body');
    
    async function loadStaffReports() {
        if (!demogPanel) return; // Only run on the Staff reports page
        
        try {
            const resSnap = await db.collection('residents').get();
            const residents = resSnap.docs.map(doc => doc.data());
            
            // Set up our tracking buckets
            const stats = {
                'Infant': { total: 0, male: 0, female: 0 },
                'Kids': { total: 0, male: 0, female: 0 },
                'Teenagers': { total: 0, male: 0, female: 0 },
                'Adults': { total: 0, male: 0, female: 0 },
                'Senior Citizens': { total: 0, male: 0, female: 0 },
                'PWDs': { total: 0, male: 0, female: 0 }
            };
            
            residents.forEach(r => {
                // Normalize 'Infants' to 'Infant' just in case
                let c = r.classification === 'Infants' ? 'Infant' : r.classification;
                
                if (stats[c]) {
                    stats[c].total++;
                    if (r.sex === 'Male') stats[c].male++;
                    else if (r.sex === 'Female') stats[c].female++;
                }
            });
            
            const classBars = demogPanel.querySelectorAll('.class-bar');
            classBars.forEach(bar => {
                const labelElement = bar.querySelector('.class-label');
                let label = labelElement.textContent.trim();
                if (label === 'Infants') label = 'Infant'; 
                
                const stat = stats[label];
                if (stat) {
                    // Update total number
                    const totalEl = bar.querySelector('.class-val');
                    totalEl.textContent = stat.total;
                    
                    const maleFill = bar.querySelector('.class-bar__fill--blue');
                    const femaleFill = bar.querySelector('.class-bar__fill--gray');
                    
                    let malePct = 0, femalePct = 0;
                    if (stat.total > 0) {
                        malePct = Math.round((stat.male / stat.total) * 100);
                        femalePct = Math.round((stat.female / stat.total) * 100);
                    }
                    
                    // Update CSS variables for width
                    maleFill.style.setProperty('--val', `${malePct}%`);
                    maleFill.title = `Male: ${stat.male} (${malePct}%)`;
                    
                    femaleFill.style.setProperty('--val', `${femalePct}%`);
                    femaleFill.title = `Female: ${stat.female} (${femalePct}%)`;
                }
            });
            
        } catch (error) {
            console.error("Error loading Staff reports:", error);
        }
    }

    // Fire them up!
    loadBhwReports();
    loadStaffReports();
});
