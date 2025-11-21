import requests
from flask import Blueprint, jsonify, request
from bs4 import BeautifulSoup
import uuid
import os
import warnings

from session_manager import session_storage

# Suppress only the InsecureRequestWarning
warnings.filterwarnings('ignore', category=requests.packages.urllib3.exceptions.InsecureRequestWarning)

auth_bp = Blueprint('auth_bp', __name__)

VTOP_BASE_URL = "https://vtopcc.vit.ac.in/vtop/"
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
}

@auth_bp.route('/check-session', methods=['POST'])
def check_session():
    """
    Checks if a session_id sent from the browser is valid on the server.
    """
    session_id = request.json.get('session_id')
    if session_id and session_id in session_storage:
        # Return the authorized_id (Roll No) if available, otherwise username
        user_display = session_storage[session_id].get('authorized_id', session_storage[session_id].get('username', 'User'))
        return jsonify({'status': 'success', 'message': f'Welcome back, {user_display}!', 'session_id': session_id, 'username': user_display})
    return jsonify({'status': 'failure'})


@auth_bp.route('/start-login', methods=['POST'])
def start_login():
    """
    Initiates a new session and correctly prepares the state for login.
    """
    print("\n[DEBUG] 1. Initiating new login session...")
    session_id = str(uuid.uuid4())
    api_session = requests.Session()

    try:
        landing_page_url = VTOP_BASE_URL + "open/page"
        landing_page_response = api_session.get(landing_page_url, headers=HEADERS, verify=False, timeout=20)
        soup_land = BeautifulSoup(landing_page_response.text, 'html.parser')
        csrf_token_prelogin = soup_land.find('input', {'name': '_csrf'}).get('value')
        
        print(f"   > Got pre-login CSRF: {csrf_token_prelogin[:10]}...") 
        
        prelogin_payload = {'_csrf': csrf_token_prelogin, 'flag': 'VTOP'}
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
        
        print(f"   > Got login-page CSRF: {csrf_token_login[:10]}...") 
        
        captcha_url = VTOP_BASE_URL + "get/new/captcha"
        captcha_response = api_session.get(captcha_url, headers=HEADERS, verify=False, timeout=20)
        captcha_response.raise_for_status()
        
        soup_captcha = BeautifulSoup(captcha_response.text, 'html.parser')
        captcha_img = soup_captcha.find('img')

        if not captcha_img or not captcha_img.get('src'):
            raise ValueError("Could not find CAPTCHA image in the dynamic captcha response.")

        img_base64_data = captcha_img['src']
        
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
        if session_id in session_storage:
            del session_storage[session_id]
        return jsonify({'status': 'failure', 'message': str(e)}), 500


@auth_bp.route('/login-attempt', methods=['POST'])
def login_attempt():
    data = request.json
    username, password, captcha_text, session_id = data.get('username'), data.get('password'), data.get('captcha'), data.get('session_id')
    
    # --- ADMIN INTERCEPT START ---
    # You can set these in Render Environment variables or keep default for testing
    ADMIN_USER = os.environ.get('ADMIN_USERNAME', 'admin') 
    ADMIN_PASS = os.environ.get('ADMIN_PASSWORD', 'admin123') 

    if username == ADMIN_USER and password == ADMIN_PASS:
        print(f"\n[DEBUG] ADMIN LOGIN DETECTED")
        # Even if the session existed for VTOP, we overwrite it for Admin purposes
        # We don't need a VTOP session object for the admin, just the storage entry
        if session_id not in session_storage:
             # Create a dummy entry if session expired or didn't exist (rare but safe)
             session_storage[session_id] = {}

        session_storage[session_id]['username'] = 'Administrator'
        session_storage[session_id]['authorized_id'] = 'ADMIN_001'
        session_storage[session_id]['type'] = 'ADMIN' # Mark session as Admin
        
        return jsonify({
            'status': 'success', 
            'message': 'Welcome, Administrator!', 
            'session_id': session_id,
            'redirect_url': '/admin' # Tell frontend to go to admin panel
        })
    # --- ADMIN INTERCEPT END ---

    if not all([username, password, captcha_text, session_id]) or session_id not in session_storage:
        print(f"   > [DEBUG] Login attempt with invalid or expired session ID: {session_id}")
        return jsonify({'status': 'failure', 'message': 'Session expired. Please refresh.'}), 400
        
    stored_session = session_storage[session_id]
    api_session = stored_session['session']
    csrf_token = stored_session['csrf_token']
    
    print(f"\n[DEBUG] 2. Attempting login for session: {session_id}")
    print(f"   > Username: {username}")
    print(f"   > CAPTCHA Sent: {captcha_text}")

    try:
        payload = {"_csrf": csrf_token, "username": username, "password": password, "captchaStr": captcha_text}
        login_url = VTOP_BASE_URL + "login"
        response = api_session.post(login_url, data=payload, headers=HEADERS, verify=False, timeout=20)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        login_form = soup.find('form', {'id': 'vtopLoginForm'})

        if not login_form:
            print("   > Login successful! Parsing Roll No...")
            
            # --- EXTRACTION LOGIC STARTS HERE ---
            authorized_id = username # Default fallback
            
            auth_id_tag = soup.find('input', {'name': 'authorizedID'})
            if auth_id_tag and auth_id_tag.get('value'):
                 authorized_id = auth_id_tag.get('value')
            else:
                 auth_idx_tag = soup.find('input', {'id': 'authorizedIDX'})
                 if auth_idx_tag and auth_idx_tag.get('value'):
                     authorized_id = auth_idx_tag.get('value')
            
            print(f"   > Extracted Authorized ID (Roll No): {authorized_id}")
            
            stored_session['username'] = username
            stored_session['authorized_id'] = authorized_id
            stored_session['type'] = 'STUDENT' # Mark as student
            # --- EXTRACTION LOGIC ENDS HERE ---

            return jsonify({'status': 'success', 'message': f'Welcome, {authorized_id}!', 'session_id': session_id})
        else:
            print("   > Login failed. Parsing for error...")
            error_message = "Invalid credentials or CAPTCHA."
            status_code = 'invalid_credentials'

            error_tag = soup.select_one("span.text-danger strong")
            if error_tag:
                specific_error_text = error_tag.get_text(strip=True).lower()
                print(f"   > VTOP Error Message: '{specific_error_text}'")
                if 'captcha' in specific_error_text:
                    status_code = 'invalid_captcha'
                    error_message = 'The CAPTCHA you entered was incorrect.'
                elif 'loginid' in specific_error_text or 'password' in specific_error_text:
                    status_code = 'invalid_credentials'
                    error_message = 'Invalid username or password.'
                elif 'maximum fail attempts' in specific_error_text:
                    status_code = 'locked'
                    error_message = 'Maximum failed attempts reached. Please reset your password or try later.'
                else:
                    error_message = error_tag.get_text(strip=True)
            
            return jsonify({
                'status': status_code,
                'message': error_message
            })

    except Exception as e:
        print(f"   > CRITICAL ERROR during login attempt: {e}")
        return jsonify({'status': 'failure', 'message': str(e)}), 500


@auth_bp.route('/logout', methods=['POST'])
def logout():
    session_id = request.json.get('session_id')
    if session_id and session_id in session_storage:
        del session_storage[session_id]
    print(f"\n--- Session {session_id} cleared and logged out ---")
    return jsonify({'status': 'success'})