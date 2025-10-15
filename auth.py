import requests
from flask import Blueprint, jsonify, request
from bs4 import BeautifulSoup
import uuid
import os

# Import session management functions
from session_manager import session_storage, save_session_data, load_session_data, SESSION_FILE

auth_bp = Blueprint('auth_bp', __name__)

VTOP_BASE_URL = "https://vtopcc.vit.ac.in/vtop/"
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
}

@auth_bp.route('/check-session', methods=['GET'])
def check_session():
    """Checks if a previously saved session is still valid."""
    session_data = load_session_data()
    if not session_data:
        return jsonify({'status': 'failure'})

    api_session = requests.Session()
    api_session.cookies.update(session_data.get('cookies', {}))

    try:
        test_response = api_session.get(VTOP_BASE_URL + "content", headers=HEADERS, verify=False, timeout=15)
        if "VTOP Login" in test_response.text:
            raise Exception("Session expired.")

        session_id = str(uuid.uuid4())
        session_storage[session_id] = {'session': api_session, 'username': session_data['username']}
        return jsonify({
            'status': 'success',
            'message': f"Welcome back, {session_data['username']}!",
            'session_id': session_id
        })
    except Exception:
        if os.path.exists(SESSION_FILE):
            os.remove(SESSION_FILE)
        return jsonify({'status': 'failure', 'message': 'Session expired.'})


@auth_bp.route('/start-login', methods=['POST'])
def start_login():
    """
    Initiates a new session and correctly prepares the state for login.
    """
    print("\n[DEBUG] 1. Initiating new login session...")
    session_id = str(uuid.uuid4())
    api_session = requests.Session()

    try:
        # Step 1: Access the main landing page.
        print("   > [Step 1/3] Accessing landing page...")
        landing_page_url = VTOP_BASE_URL + "open/page"
        landing_page_response = api_session.get(landing_page_url, headers=HEADERS, verify=False, timeout=20)
        soup_land = BeautifulSoup(landing_page_response.text, 'html.parser')
        csrf_token_prelogin = soup_land.find('input', {'name': '_csrf'}).get('value')

        # Step 2: Simulate the click to get to the login page.
        print("   > [Step 2/3] Navigating to login page...")
        prelogin_payload = {'_csrf': csrf_token_prelogin, 'flag': 'VTOP'}
        # The response from this POST is the actual login page HTML
        login_page_response = api_session.post(
            VTOP_BASE_URL + "prelogin/setup",
            data=prelogin_payload,
            headers=HEADERS,
            verify=False,
            timeout=20,
            allow_redirects=True 
        )
        soup_login = BeautifulSoup(login_page_response.text, 'html.parser')
        csrf_token_login = soup_login.find('input', {'name': '_csrf'}).get('value')
        
        # Step 3: Make the separate, dynamic request for the CAPTCHA.
        print("   > [Step 3/3] Fetching CAPTCHA...")
        captcha_url = VTOP_BASE_URL + "get/new/captcha"
        captcha_response = api_session.get(captcha_url, headers=HEADERS, verify=False, timeout=20)
        captcha_response.raise_for_status()
        
        soup_captcha = BeautifulSoup(captcha_response.text, 'html.parser')
        captcha_img = soup_captcha.find('img')

        if not captcha_img or not captcha_img.get('src'):
            raise ValueError("Could not find CAPTCHA image in the dynamic captcha response.")

        img_base64_data = captcha_img['src']
        
        # Store both the session and the crucial CSRF token for the next step
        session_storage[session_id] = {
            'session': api_session,
            'csrf_token': csrf_token_login 
        }

        print(f"   > CAPTCHA successfully fetched for session: {session_id}")
        return jsonify({
            'status': 'captcha_ready',
            'session_id': session_id,
            'captcha_image_data': img_base64_data
        })

    except Exception as e:
        print(f"   > CRITICAL ERROR during CAPTCHA fetch: {e}")
        return jsonify({'status': 'failure', 'message': str(e)}), 500


@auth_bp.route('/login-attempt', methods=['POST'])
def login_attempt():
    """Handles the submission of user credentials using the preserved state."""
    data = request.json
    username, password, captcha_text, session_id = data.get('username'), data.get('password'), data.get('captcha'), data.get('session_id')
    
    if not all([username, password, captcha_text, session_id]):
        return jsonify({'status': 'failure', 'message': 'Missing required fields.'}), 400

    if session_id not in session_storage:
        return jsonify({'status': 'failure', 'message': 'Session expired. Please refresh the page.'}), 400
        
    # Retrieve the session and the correct CSRF token from storage
    stored_session = session_storage[session_id]
    api_session = stored_session['session']
    csrf_token = stored_session['csrf_token']

    try:
        print(f"   > Submitting login with CSRF token: {csrf_token}")
        payload = {
            "_csrf": csrf_token,
            "username": username,
            "password": password,
            "captchaStr": captcha_text
        }
        login_url = VTOP_BASE_URL + "login"
        response = api_session.post(login_url, data=payload, headers=HEADERS, verify=False, timeout=20)
        response.raise_for_status()
        
        if "/content" in response.url or "Welcome" in response.text:
            print("   > Login successful!")
            save_session_data(username, api_session)
            stored_session['username'] = username # Update stored session with username
            return jsonify({'status': 'success', 'message': f'Welcome, {username}!', 'session_id': session_id})
        else:
            print("   > Login failed. Fetching new CAPTCHA for retry...")
            # If login fails, we must get a completely new form state
            captcha_url = VTOP_BASE_URL + "get/new/captcha"
            captcha_response = api_session.get(captcha_url, headers=HEADERS, verify=False)
            soup_captcha = BeautifulSoup(captcha_response.text, 'html.parser')
            new_captcha_img = soup_captcha.find('img')
            new_img_base64 = new_captcha_img['src'] if new_captcha_img else ""
            
            # We also need to get the new CSRF token for the next attempt
            soup_error = BeautifulSoup(response.text, 'html.parser')
            new_csrf = soup_error.find('input', {'name': '_csrf'})
            if new_csrf:
                stored_session['csrf_token'] = new_csrf.get('value') # Update the token in storage
            
            error_message = "Invalid Credentials or CAPTCHA. Please try again."
            error_tag = soup_error.find("font", {"color": "red"})
            if error_tag:
                error_message = error_tag.get_text(strip=True)
            
            return jsonify({
                'status': 'credentials_invalid',
                'message': error_message,
                'session_id': session_id,
                'captcha_image_data': new_img_base64
            })

    except Exception as e:
        print(f"   > CRITICAL ERROR during login attempt: {e}")
        return jsonify({'status': 'failure', 'message': str(e)}), 500


@auth_bp.route('/logout', methods=['POST'])
def logout():
    """Clears the user's session from the server."""
    session_id = request.json.get('session_id')
    if session_id in session_storage:
        del session_storage[session_id]
    if os.path.exists(SESSION_FILE): 
        os.remove(SESSION_FILE)
    print("\n--- Session cleared and logged out ---")
    return jsonify({'status': 'success'})
