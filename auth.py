import requests
from flask import Blueprint, jsonify, request
from bs4 import BeautifulSoup
import uuid
import os
from datetime import datetime

from session_manager import session_storage

auth_bp = Blueprint('auth_bp', __name__)

VTOP_BASE_URL = "https://vtopcc.vit.ac.in/vtop/"
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
}
REQUEST_TIMEOUT = 25 

@auth_bp.route('/check-session', methods=['POST'])
def check_session():
    session_id = request.json.get('session_id')
    if session_id and session_id in session_storage:
        username = session_storage[session_id].get('username', 'User')
        return jsonify({'status': 'success', 'message': f'Welcome back, {username}!', 'session_id': session_id})
    return jsonify({'status': 'failure'})


@auth_bp.route('/start-login', methods=['POST'])
def start_login():
    print(f"\n[DEBUG] {datetime.now()} --- Initiating new login session ---")
    session_id = str(uuid.uuid4())
    api_session = requests.Session()

    try:
        # STEP 1: Get the main landing page to acquire the first CSRF token.
        print(f"[DEBUG] {datetime.now()} - STEP 1: Fetching landing page...")
        landing_page_url = VTOP_BASE_URL + "open/page"
        landing_page_response = api_session.get(landing_page_url, headers=HEADERS, verify=False, timeout=REQUEST_TIMEOUT)
        print(f"[DEBUG] {datetime.now()} - STEP 1 SUCCESS: Status Code {landing_page_response.status_code}")
        landing_page_response.raise_for_status()
        
        soup_land = BeautifulSoup(landing_page_response.text, 'html.parser')
        csrf_token_prelogin = soup_land.find('input', {'name': '_csrf'}).get('value')
        print(f"[DEBUG] {datetime.now()} - Found pre-login CSRF token.")

        # STEP 2: Simulate the click to get to the actual login page.
        print(f"[DEBUG] {datetime.now()} - STEP 2: Setting up pre-login...")
        prelogin_payload = {'_csrf': csrf_token_prelogin, 'flag': 'VTOP'}
        login_page_response = api_session.post(
            VTOP_BASE_URL + "prelogin/setup",
            data=prelogin_payload,
            headers=HEADERS,
            verify=False,
            timeout=REQUEST_TIMEOUT,
            allow_redirects=True
        )
        print(f"[DEBUG] {datetime.now()} - STEP 2 SUCCESS: Status Code {login_page_response.status_code}")
        login_page_response.raise_for_status()
        
        soup_login = BeautifulSoup(login_page_response.text, 'html.parser')
        csrf_token_login = soup_login.find('input', {'name': '_csrf'}).get('value')
        print(f"[DEBUG] {datetime.now()} - Found main login CSRF token.")

        # STEP 3: Make a separate request to fetch the CAPTCHA image.
        print(f"[DEBUG] {datetime.now()} - STEP 3: Fetching new CAPTCHA...")
        captcha_url = VTOP_BASE_URL + "get/new/captcha"
        captcha_response = api_session.get(captcha_url, headers=HEADERS, verify=False, timeout=REQUEST_TIMEOUT)
        print(f"[DEBUG] {datetime.now()} - STEP 3 SUCCESS: Status Code {captcha_response.status_code}")
        captcha_response.raise_for_status()
        
        soup_captcha = BeautifulSoup(captcha_response.text, 'html.parser')
        captcha_img = soup_captcha.find('img')

        if not captcha_img or not captcha_img.get('src'):
            print(f"[DEBUG] {datetime.now()} - CRITICAL ERROR: CAPTCHA image tag not found in response.")
            raise ValueError("Could not find CAPTCHA image in the dynamic captcha response.")

        img_base64_data = captcha_img['src']
        print(f"[DEBUG] {datetime.now()} - Successfully extracted CAPTCHA image data.")
        
        session_storage[session_id] = {
            'session': api_session,
            'csrf_token': csrf_token_login
        }

        print(f"[DEBUG] {datetime.now()} - CAPTCHA process complete for session: {session_id}")
        return jsonify({
            'status': 'captcha_ready',
            'session_id': session_id,
            'captcha_image_data': img_base64_data
        })

    except requests.exceptions.Timeout:
        print(f"[DEBUG] {datetime.now()} - VTOP CONNECTION TIMEOUT during start-login.")
        message = "VTOP is taking too long to respond. Please try again in a few minutes."
        return jsonify({'status': 'vtop_connection_error', 'message': message}), 504
    except requests.exceptions.RequestException as e:
        print(f"[DEBUG] {datetime.now()} - VTOP CONNECTION ERROR during start-login: {e}")
        message = "Could not connect to VTOP. The service may be down."
        return jsonify({'status': 'vtop_connection_error', 'message': message}), 503
    except Exception as e:
        print(f"[DEBUG] {datetime.now()} - GENERIC ERROR during start-login: {e}")
        return jsonify({'status': 'failure', 'message': str(e)}), 500


@auth_bp.route('/login-attempt', methods=['POST'])
def login_attempt():
    data = request.json
    username, password, captcha_text, session_id = data.get('username'), data.get('password'), data.get('captcha'), data.get('session_id')
    
    print(f"\n[DEBUG] {datetime.now()} --- Attempting login for user: {username} ---")
    
    if not all([username, password, captcha_text, session_id]) or session_id not in session_storage:
        print(f"[DEBUG] {datetime.now()} - Login failed due to missing data or invalid session.")
        return jsonify({'status': 'failure', 'message': 'Session expired. Please refresh.'}), 400
        
    stored_session = session_storage[session_id]
    api_session = stored_session['session']
    csrf_token = stored_session['csrf_token']

    try:
        # STEP 4: Post the login credentials to VTOP.
        print(f"[DEBUG] {datetime.now()} - STEP 4: Posting login credentials...")
        payload = {"_csrf": csrf_token, "username": username, "password": password, "captchaStr": captcha_text}
        login_url = VTOP_BASE_URL + "login"
        response = api_session.post(login_url, data=payload, headers=HEADERS, verify=False, timeout=REQUEST_TIMEOUT)
        print(f"[DEBUG] {datetime.now()} - STEP 4 SUCCESS: Status Code {response.status_code}")
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        login_form = soup.find('form', {'id': 'vtopLoginForm'})

        # Check for success by seeing if the login form is GONE.
        if not login_form:
            print(f"[DEBUG] {datetime.now()} - Login successful for {username}!")
            stored_session['username'] = username
            return jsonify({'status': 'success', 'message': f'Welcome, {username}!', 'session_id': session_id})
        else:
            print(f"[DEBUG] {datetime.now()} - Login failed for {username}. Analyzing error...")
            # If the login form is still present, it was a failure.
            error_message = "Invalid credentials or CAPTCHA." 
            status_code = 'credentials_invalid'

            error_tag = soup.select_one("span.text-danger strong")
            if error_tag:
                specific_error_text = error_tag.get_text(strip=True).lower()
                print(f"[DEBUG] {datetime.now()} - Found specific error from VTOP: '{specific_error_text}'")
                if 'captcha' in specific_error_text:
                    status_code = 'invalid_captcha'
                    error_message = 'The CAPTCHA you entered was incorrect. Please try again.'
                elif 'loginid' in specific_error_text or 'password' in specific_error_text:
                    status_code = 'invalid_credentials'
                    error_message = 'Invalid username or password. Please check your credentials.'
                else:
                    error_message = error_tag.get_text(strip=True) 
            
            # Fetch a new CAPTCHA for the next attempt.
            captcha_url = VTOP_BASE_URL + "get/new/captcha"
            captcha_response = api_session.get(captcha_url, headers=HEADERS, verify=False)
            soup_captcha = BeautifulSoup(captcha_response.text, 'html.parser')
            new_captcha_img = soup_captcha.find('img')
            new_img_base64 = new_captcha_img['src'] if new_captcha_img else ""
            
            new_csrf = soup.find('input', {'name': '_csrf'})
            if new_csrf:
                stored_session['csrf_token'] = new_csrf.get('value')
            
            return jsonify({
                'status': status_code,
                'message': error_message,
                'session_id': session_id,
                'captcha_image_data': new_img_base64
            })

    except Exception as e:
        print(f"[DEBUG] {datetime.now()} - GENERIC ERROR during login-attempt: {e}")
        return jsonify({'status': 'failure', 'message': str(e)}), 500


@auth_bp.route('/logout', methods=['POST'])
def logout():
    session_id = request.json.get('session_id')
    if session_id and session_id in session_storage:
        del session_storage[session_id]
    print(f"\n[DEBUG] {datetime.now()} --- Session {session_id} cleared and logged out ---")
    return jsonify({'status': 'success'})

