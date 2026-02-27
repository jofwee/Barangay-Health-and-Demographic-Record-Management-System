// reports-logic.js

document.addEventListener('DOMContentLoaded', () => {

    // ── BHW Reports ────────────────────────────────────────
    const invStatusBody = document.getElementById('invStatusBody');
    const distReportBody = document.getElementById('distReportBody');
    const barChartBars = document.querySelector('.report-bar-chart__bars');

    function getStockLabel(qty) {
        if (qty <= 0) return 'Out of Stock';
        if (qty <= 20) return 'Low Stock';
        return 'In Stock';
    }

    function escHTML(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    async function loadBhwReports() {
        if (!invStatusBody && !distReportBody && !barChartBars) return;

        try {
            // Fetch both collections in parallel
            const [medsSnap, logsSnap] = await Promise.all([
                db.collection('medicines').get(),
                db.collection('maintenanceLogs').orderBy('date', 'desc').get()
            ]);

            const meds = medsSnap.docs.map(doc => doc.data());
            const logs = logsSnap.docs.map(doc => doc.data());

            // ── 1. Medicine Inventory Status table ────────────
            if (invStatusBody) {
                if (meds.length === 0) {
                    invStatusBody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#666;">No medicines found.</td></tr>';
                } else {
                    invStatusBody.innerHTML = '';
                    meds.forEach(m => {
                        const qty = m.quantity || 0;
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td>${escHTML(m.name)}</td>
                            <td>${qty}</td>
                            <td>${getStockLabel(qty)}</td>
                        `;
                        invStatusBody.appendChild(tr);
                    });
                }
            }

            // ── 2. Medicine Distribution Report table ─────────
            if (distReportBody) {
                if (logs.length === 0) {
                    distReportBody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#666;">No records found.</td></tr>';
                } else {
                    distReportBody.innerHTML = '';
                    // Show most recent 10
                    logs.slice(0, 10).forEach(log => {
                        let formattedDate = '';
                        if (log.date) {
                            const parts = log.date.split('-');
                            formattedDate = `${parts[1]}/${parts[2]}/${parts[0].slice(2)}`;
                        }
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td>${escHTML(formattedDate)}</td>
                            <td>${escHTML(log.residentName)}</td>
                            <td>${escHTML(log.medicineName)}</td>
                            <td>${log.quantity || 0}</td>
                        `;
                        distReportBody.appendChild(tr);
                    });
                }
            }

            // ── 3. Monthly bar chart ──────────────────────────
            if (barChartBars) {
                const monthlyQty = new Array(12).fill(0);

                logs.forEach(log => {
                    if (log.date) {
                        const monthIndex = parseInt(log.date.split('-')[1], 10) - 1;
                        if (monthIndex >= 0 && monthIndex <= 11) {
                            monthlyQty[monthIndex] += (log.quantity || 1);
                        }
                    }
                });

                const maxQty = Math.max(...monthlyQty, 1);

                // Dynamic Y-axis labels
                const step = Math.ceil(maxQty / 5);
                for (let i = 1; i <= 5; i++) {
                    const el = document.getElementById('yLabel' + i);
                    if (el) el.textContent = step * i;
                }

                const bars = barChartBars.querySelectorAll('.report-bar');
                bars.forEach((bar, index) => {
                    const fill = bar.querySelector('.report-bar__fill');
                    const count = monthlyQty[index];
                    const percentage = Math.round((count / (step * 5)) * 100);
                    fill.style.height = `${percentage}%`;
                    fill.title = `${count} distributed`;
                });
            }

        } catch (error) {
            console.error('Error loading BHW reports:', error);
            if (invStatusBody) invStatusBody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:red;">Failed to load.</td></tr>';
            if (distReportBody) distReportBody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:red;">Failed to load.</td></tr>';
        }
    }

    // ── Staff Reports (Age Distribution, Population, Classification) ──
    const ageChart = document.getElementById('ageChart');
    const statDate = document.getElementById('statDate');

    async function loadStaffReports() {
        if (!ageChart) return;

        try {
            const resSnap = await db.collection('residents').get();
            const residents = resSnap.docs.map(doc => doc.data());

            // Current date for the subtitle
            const now = new Date();
            if (statDate) {
                statDate.textContent = 'as of ' + now.toLocaleDateString('en-US', {
                    month: 'long', year: 'numeric'
                });
            }

            // ── 1. Population Statistics ──────────────────────
            let totalAll = residents.length;
            let totalMale = 0;
            let totalFemale = 0;

            residents.forEach(r => {
                if (r.sex === 'Male') totalMale++;
                else if (r.sex === 'Female') totalFemale++;
            });

            const popAll = document.getElementById('popAll');
            const popMale = document.getElementById('popMale');
            const popFemale = document.getElementById('popFemale');
            if (popAll) popAll.textContent = totalAll.toLocaleString();
            if (popMale) popMale.textContent = totalMale.toLocaleString();
            if (popFemale) popFemale.textContent = totalFemale.toLocaleString();

            // ── 2. Age Distribution ───────────────────────────
            const ageRanges = [
                { label: 'Under 5', min: 0, max: 4 },
                { label: '5 – 9', min: 5, max: 9 },
                { label: '10 – 14', min: 10, max: 14 },
                { label: '15 – 19', min: 15, max: 19 },
                { label: '20 – 24', min: 20, max: 24 },
                { label: '25 – 29', min: 25, max: 29 },
                { label: '30 – 34', min: 30, max: 34 },
                { label: '35 – 39', min: 35, max: 39 },
                { label: '40 – 44', min: 40, max: 44 },
                { label: '45 – 49', min: 45, max: 49 },
                { label: '50 – 54', min: 50, max: 54 },
                { label: '55 – 59', min: 55, max: 59 },
                { label: '60 – 64', min: 60, max: 64 },
                { label: '65 – 69', min: 65, max: 69 },
                { label: '70 – 74', min: 70, max: 74 },
                { label: '75 – 79', min: 75, max: 79 },
                { label: '80 and above', min: 80, max: 999 }
            ];

            const ageCounts = ageRanges.map(() => 0);

            residents.forEach(r => {
                const age = parseInt(r.age, 10);
                if (isNaN(age)) return;
                for (let i = 0; i < ageRanges.length; i++) {
                    if (age >= ageRanges[i].min && age <= ageRanges[i].max) {
                        ageCounts[i]++;
                        break;
                    }
                }
            });

            const maxAge = Math.max(...ageCounts, 1);

            ageChart.innerHTML = '';
            ageRanges.forEach((range, i) => {
                const pct = Math.round((ageCounts[i] / maxAge) * 100);
                const row = document.createElement('div');
                row.className = 'age-row';
                row.innerHTML = `
                    <span class="age-label">${range.label}</span>
                    <div class="age-bar-track">
                        <div class="age-bar-fill" style="--val: ${pct}%"></div>
                    </div>
                    <span class="age-val">${ageCounts[i]}</span>
                `;
                ageChart.appendChild(row);
            });

            // ── 3. Classification Breakdown ───────────────────
            const classStats = {
                'Infant': { total: 0, male: 0, female: 0 },
                'Kids': { total: 0, male: 0, female: 0 },
                'Teenagers': { total: 0, male: 0, female: 0 },
                'Adults': { total: 0, male: 0, female: 0 },
                'Senior Citizens': { total: 0, male: 0, female: 0 },
                'PWDs': { total: 0, male: 0, female: 0 }
            };

            residents.forEach(r => {
                let c = r.classification === 'Infants' ? 'Infant' : r.classification;
                if (classStats[c]) {
                    classStats[c].total++;
                    if (r.sex === 'Male') classStats[c].male++;
                    else if (r.sex === 'Female') classStats[c].female++;
                }
            });

            const maxClass = Math.max(...Object.values(classStats).map(s => s.total), 1);

            const classBars = document.querySelectorAll('#classBreakdown .class-bar');
            classBars.forEach(bar => {
                const key = bar.getAttribute('data-class');
                const stat = classStats[key];
                if (!stat) return;

                const valEl = bar.querySelector('.class-val');
                valEl.textContent = stat.total;

                const maleFill = bar.querySelector('.class-bar__fill--blue');
                const femaleFill = bar.querySelector('.class-bar__fill--gray');

                const totalPct = Math.round((stat.total / maxClass) * 100);
                let malePct = 0, femalePct = 0;
                if (stat.total > 0) {
                    malePct = Math.round((stat.male / stat.total) * totalPct);
                    femalePct = totalPct - malePct;
                }

                maleFill.style.setProperty('--val', `${malePct}%`);
                maleFill.title = `Male: ${stat.male}`;
                femaleFill.style.setProperty('--val', `${femalePct}%`);
                femaleFill.title = `Female: ${stat.female}`;
            });

        } catch (error) {
            console.error('Error loading staff reports:', error);
            if (ageChart) ageChart.innerHTML = '<p style="text-align:center;color:red;">Failed to load reports.</p>';
        }
    }

    // Initialize
    loadBhwReports();
    loadStaffReports();
});
