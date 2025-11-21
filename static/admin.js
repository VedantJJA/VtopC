document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = window.location.origin;
    
    // Elements
    const statActiveUsers = document.getElementById('stat-active-users');
    const statTotalLogs = document.getElementById('stat-total-logs');
    const statDeviceUsage = document.getElementById('stat-device-usage'); // New Element
    const userTableBody = document.getElementById('user-table-body');
    const logTableBody = document.getElementById('log-table-body');
    const logoutBtn = document.getElementById('logoutBtn');
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.page-section');
    const themeToggle = document.getElementById('theme-toggle');

    // --- Auth Check ---
    const sessionId = localStorage.getItem('vtop_session_id');
    if (!sessionId) { window.location.href = '/login'; return; }

    // --- Dark Mode Logic ---
    if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    }
    if(themeToggle) {
        themeToggle.addEventListener('click', () => {
            const isDark = document.documentElement.classList.toggle('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });
    }

    // --- Navigation ---
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.dataset.section;
            navLinks.forEach(l => {
                l.classList.remove('active', 'bg-gray-100', 'dark:bg-gray-700', 'dark:text-white');
                l.classList.add('text-gray-700', 'dark:text-gray-300');
            });
            link.classList.add('active', 'bg-gray-100', 'dark:bg-gray-700', 'dark:text-white');
            sections.forEach(s => s.classList.add('hidden'));
            document.getElementById(targetId).classList.remove('hidden');
        });
    });

    // --- Fetch Data ---
    async function fetchStats() {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/stats`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId })
            });

            if (response.status === 401) {
                alert("Unauthorized. Redirecting to login.");
                window.location.href = '/login';
                return;
            }

            const data = await response.json();

            if (data.status === 'success') {
                // Update Counts
                statActiveUsers.textContent = data.active_users_count;
                statTotalLogs.textContent = data.total_site_visits;
                
                // Update Device Stats
                if (data.device_stats) {
                    statDeviceUsage.innerHTML = `
                        <span class="text-indigo-500">Mobile: ${data.device_stats.mobile}</span> | 
                        <span class="text-gray-500 dark:text-gray-400">Desktop: ${data.device_stats.desktop}</span>
                    `;
                }

                // Update User Table (Clean List)
                userTableBody.innerHTML = data.user_list.map(u => `
                    <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            ${u.username}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500 dark:text-gray-400">
                            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${u.is_admin ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}">
                                ${u.is_admin ? 'Admin' : 'Student'}
                            </span>
                        </td>
                    </tr>
                `).join('');

                // Update Logs Table
                logTableBody.innerHTML = data.traffic_logs.map(l => `
                    <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${l.time}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-600 dark:text-indigo-400">${l.method}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${l.endpoint}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${l.ip}</td>
                    </tr>
                `).join('');
            }
        } catch (error) {
            console.error("Admin fetch error", error);
        }
    }

    // Logout
    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await fetch(`${API_BASE_URL}/logout`, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({session_id: sessionId}) 
        });
        localStorage.removeItem('vtop_session_id');
        window.location.href = '/login';
    });

    // Initial Load & Polling
    lucide.createIcons();
    fetchStats();
    setInterval(fetchStats, 5000); 
});