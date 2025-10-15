document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'http://127.0.0.1:5000';
    
    // DOM Element variables
    const loadingContainer = document.getElementById('loadingContainer');
    const loginContainer = document.getElementById('loginContainer');
    const dashboardContainer = document.getElementById('dashboardContainer');
    const loginForm = document.getElementById('loginForm');
    const captchaGroup = document.getElementById('captchaGroup');
    const captchaImageContainer = document.getElementById('captchaImageContainer');
    const sessionIdInput = document.getElementById('sessionId');
    const statusMessage = document.getElementById('statusMessage');
    const loginButton = document.getElementById('loginButton');
    const loginButtonText = document.getElementById('loginButtonText');
    const loginButtonSpinner = document.getElementById('loginButtonSpinner');
    const dataContainer = document.getElementById('dataContainer');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const logoutBtn = document.getElementById('logoutBtn');
    const fetchTimetableBtn = document.getElementById('fetchTimetableBtn');
    const fetchGradesBtn = document.getElementById('fetchGradesBtn');
    const fetchAttendanceBtn = document.getElementById('fetchAttendanceBtn');
    let currentSessionId = null;

    // --- UI HELPER FUNCTIONS ---
    function setStatus(message, isError = false) {
        statusMessage.textContent = message;
        statusMessage.className = `mt-6 text-center text-sm ${isError ? 'text-red-600' : 'text-green-600'}`;
    }

    function setButtonLoading(isLoading) {
        loginButtonText.textContent = isLoading ? 'Processing...' : 'Login';
        loginButton.disabled = isLoading;
        loginButtonSpinner.classList.toggle('hidden', !isLoading);
    }

    function showDashboard(message, sessionId) {
        loadingContainer.classList.add('hidden');
        loginContainer.classList.add('hidden');
        dashboardContainer.classList.remove('hidden');
        welcomeMessage.textContent = message;
        currentSessionId = sessionId;
    }

    // --- CORE LOGIC ---
    
    // NEW function to pre-fetch CAPTCHA
    async function preFetchCaptcha() {
        console.log("Pre-fetching CAPTCHA...");
        captchaGroup.classList.remove('hidden');
        captchaImageContainer.innerHTML = '<i class="fas fa-spinner fa-spin text-2xl text-gray-400"></i>';
        
        try {
            const response = await fetch(`${API_BASE_URL}/start-login`, { method: 'POST' });
            if (!response.ok) throw new Error(`Server error: ${response.status}`);
            const data = await response.json();

            if (data.status === 'captcha_ready') {
                sessionIdInput.value = data.session_id; // Store session ID
                captchaImageContainer.innerHTML = `<img src="${data.captcha_image_data}" alt="CAPTCHA"/>`;
                document.getElementById('captcha').focus();
            } else {
                throw new Error(data.message || 'Failed to get CAPTCHA.');
            }
        } catch (error) {
            setStatus(error.message, true);
            captchaImageContainer.innerHTML = '<p class="text-xs text-red-500">Could not load CAPTCHA</p>';
        }
    }

    function showLoginScreen() {
        sessionIdInput.value = '';
        captchaGroup.classList.add('hidden');
        loadingContainer.classList.add('hidden');
        dashboardContainer.classList.add('hidden');
        loginContainer.classList.remove('hidden');
        setStatus("Please enter your credentials.");
        preFetchCaptcha(); // <-- TRIGGER CAPTCHA FETCH IMMEDIATELY
    }

    async function checkSession() {
        try {
            const response = await fetch(`${API_BASE_URL}/check-session`);
            if (!response.ok) throw new Error(`Server error: ${response.status}`);
            const data = await response.json();
            if (data.status === 'success') {
                showDashboard(data.message, data.session_id);
            } else {
                showLoginScreen();
            }
        } catch (error) {
            showLoginScreen();
            setStatus(`Connection Error: ${error.message}`, true);
        }
    }
    
    // SIMPLIFIED login handler
    async function handleLoginAttempt() {
        setButtonLoading(true);
        
        const payload = { 
            session_id: sessionIdInput.value,
            username: document.getElementById('username').value, 
            password: document.getElementById('password').value, 
            captcha: document.getElementById('captcha').value
        };

        try {
            const response = await fetch(`${API_BASE_URL}/login-attempt`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error(`Server error: ${response.status}`);
            const data = await response.json();

            if (data.status === 'success') {
                showDashboard(data.message, data.session_id);
            } else if (data.status === 'captcha_invalid' || data.status === 'credentials_invalid') {
                setStatus(data.message, true);
                sessionIdInput.value = data.session_id;
                captchaImageContainer.innerHTML = `<img src="${data.captcha_image_data}" alt="New CAPTCHA"/>`;
                document.getElementById('captcha').value = '';
                document.getElementById('captcha').focus();
            } else {
                throw new Error(data.message || "An unknown login error occurred.");
            }
        } catch (error) {
            setStatus(error.message, true);
        } finally {
            setButtonLoading(false);
        }
    }
    
    // Generic function to fetch and display data in the dashboard
    async function genericDataFetcher(targetEndpoint, button) {
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        button.disabled = true;

        try {
            const response = await fetch(`${API_BASE_URL}/fetch-data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: currentSessionId, target: targetEndpoint })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Server error: ${response.status}`);
            }

            const data = await response.json();
            dataContainer.innerHTML = data.html_content;

        } catch (error) {
            dataContainer.innerHTML = `<p class="text-red-500 text-center">Error: ${error.message}</p>`;
        } finally {
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }
    
    // --- EVENT LISTENERS ---
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleLoginAttempt();
    });

    logoutBtn.addEventListener('click', async () => { 
        await fetch(`${API_BASE_URL}/logout`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({session_id: currentSessionId}) }); 
        showLoginScreen(); 
        dataContainer.innerHTML = ''; // Clear dashboard content on logout
    });

    fetchTimetableBtn.addEventListener('click', (e) => { 
        genericDataFetcher('academics/common/StudentTimeTableChn', e.target); 
    });

    fetchGradesBtn.addEventListener('click', (e) => { 
        genericDataFetcher('examinations/examGradeView/doStudentGradeView', e.target); 
    });

    fetchAttendanceBtn.addEventListener('click', (e) => { 
        genericDataFetcher('processViewStudentAttendance', e.target); 
    });

    // Initial check on page load
    checkSession();
});