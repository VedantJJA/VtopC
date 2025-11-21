// --- Import the solver ---
import { solveCaptchaClient } from './solver.js';

document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = window.location.origin;
    
    // --- DOM Elements ---
    const loadingContainer = document.getElementById('loadingContainer');
    const loginContainer = document.getElementById('loginContainer');
    const loginForm = document.getElementById('loginForm');
    const captchaGroup = document.getElementById('captchaGroup');
    const captchaImageContainer = document.getElementById('captchaImageContainer');
    const sessionIdInput = document.getElementById('sessionId');
    const statusMessage = document.getElementById('statusMessage');
    const loginButton = document.getElementById('loginButton');
    const loginButtonText = document.getElementById('loginButtonText');
    const loginButtonSpinner = document.getElementById('loginButtonSpinner');
    const passwordInput = document.getElementById('password');
    const togglePasswordBtn = document.getElementById('togglePassword');
    const captchaInput = document.getElementById('captcha');
    
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
    
    function showLoginScreen() {
        loadingContainer.classList.add('hidden');
        loginContainer.classList.remove('hidden');
        // This is an initial load, not a retry
        preFetchCaptcha(false); 
    }

    // --- CORE LOGIC ---
    
    /**
     * Fetches a new CAPTCHA and session from the server.
     * @param {boolean} isRetry - If true, automatically re-submits the login form after solving.
     */
    async function preFetchCaptcha(isRetry = false) {
        captchaGroup.classList.remove('hidden');
        captchaImageContainer.innerHTML = '<i class="fas fa-spinner fa-spin text-2xl text-gray-400"></i>';
        
        if (isRetry) {
             setStatus('Fetching new CAPTCHA...', false);
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/start-login`, { method: 'POST' });
            if (!response.ok) throw new Error(`Server error: ${response.status}`);
            const data = await response.json();

            if (data.status === 'captcha_ready') {
                sessionIdInput.value = data.session_id;
                captchaImageContainer.innerHTML = `<img src="${data.captcha_image_data}" alt="CAPTCHA"/>`;
                
                setStatus('Solving CAPTCHA...', false);
                try {
                    const solvedText = await solveCaptchaClient(data.captcha_image_data);
                    captchaInput.value = solvedText;
                    
                    if (isRetry) {
                        setStatus('New CAPTCHA solved. Auto-retrying login...', false);
                        handleLoginAttempt(); 
                    } else {
                        setStatus('New CAPTCHA solved. Please try again.', false);
                        passwordInput.focus();
                    }
                    
                } catch (solveError) {
                    console.error('CAPTCHA solve error:', solveError);
                    setStatus('Failed to auto-solve. Please enter manually.', true);
                    captchaInput.focus();
                }

            } else {
                throw new Error(data.message || 'Failed to get CAPTCHA.');
            }
        } catch (error) {
            setStatus(error.message, true);
            captchaImageContainer.innerHTML = '<p class="text-xs text-red-500">Could not load CAPTCHA</p>';
        }
    }

    async function checkSession() {
        const savedSessionId = localStorage.getItem('vtop_session_id');
        if (!savedSessionId) {
            showLoginScreen();
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/check-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: savedSessionId })
            });

            if (!response.ok) throw new Error('Session validation failed.');
            const data = await response.json();

            if (data.status === 'success') {
                window.location.href = '/'; 
            } else {
                localStorage.removeItem('vtop_session_id');
                showLoginScreen();
            }
        } catch (error) {
            localStorage.removeItem('vtop_session_id');
            showLoginScreen();
        }
    }
    
    async function handleLoginAttempt() {
        setButtonLoading(true);
        setStatus('Attempting login...', false);
        
        const payload = { 
            session_id: sessionIdInput.value,
            username: document.getElementById('username').value, 
            password: passwordInput.value, 
            captcha: captchaInput.value
        };

        try {
            const response = await fetch(`${API_BASE_URL}/login-attempt`, { 
                method: 'POST', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify(payload) 
            });
            
            const data = await response.json();

            if (data.status === 'success') {
                setStatus('Success! Redirecting...', false);
                localStorage.setItem('vtop_session_id', data.session_id);
                
                // --- CHANGED HERE: Handle Admin Redirect ---
                if (data.redirect_url) {
                    window.location.href = data.redirect_url;
                } else {
                    window.location.href = '/';
                }
            
            } else if (data.status === 'invalid_captcha') {
                setStatus(data.message + " Auto-retrying with new CAPTCHA...", true);
                preFetchCaptcha(true); 
            
            } else {
                setStatus(data.message, true); 
                setButtonLoading(false); 
                preFetchCaptcha(false); 
            }

        } catch (error) {
            setStatus(error.message, true);
            setButtonLoading(false);
        }
    }
    
    // --- EVENT LISTENERS ---
    
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleLoginAttempt();
    });

    togglePasswordBtn.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        const icon = togglePasswordBtn.querySelector('i');
        icon.classList.toggle('fa-eye');
        icon.classList.toggle('fa-eye-slash');
    });

    captchaInput.addEventListener('input', () => {
        captchaInput.value = captchaInput.value.toUpperCase();
    });

    // Initial check on page load
    checkSession();
});