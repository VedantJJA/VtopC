import requests
from flask import Blueprint, jsonify, request
from bs4 import BeautifulSoup
import uuid
import os

from session_manager import session_storage

auth_bp = Blueprint('auth_bp', __name__)

VTOP_BASE_URL = "https://vtopcc.vit.ac.in/vtop/"
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
}
REQUEST_TIMEOUT = 45 # Increased timeout for more patience

@auth_bp.route('/check-session', methods=['POST'])
def check_session():
    """
    Checks if a session_id sent from the browser is valid on the server.
    """
    session_id = request.json.get('session_id')
    if session_id and session_id in session_storage:
        username = session_storage[session_id].get('username', 'User')
        return jsonify({'status': 'success', 'message': f'Welcome back, {username}!', 'session_id': session_id})
    return jsonify({'status': 'failure'})


@auth_bp.route('/start-login', methods=['POST'])
def start_login():
    """
    **REWRITTEN FOR ROBUSTNESS**
    Initiates a new session by going directly to the login page
    and fetching the CSRF token and CAPTCHA in a single step.
    """
    print("\n[INFO] Initiating new login session with direct method...")
    session_id = str(uuid.uuid4())
    api_session = requests.Session()

    try:
        # Go directly to the main login page. This is more robust than the old multi-step process.
        login_page_url = VTOP_BASE_URL + "login"
        login_page_response = api_session.get(login_page_url, headers=HEADERS, verify=False, timeout=REQUEST_TIMEOUT)
        login_page_response.raise_for_status()
        
        soup = BeautifulSoup(login_page_response.text, 'html.parser')
        
        # Extract the CSRF token and CAPTCHA from the login page content.
        csrf_token = soup.find('input', {'name': '_csrf'}).get('value')
        captcha_img = soup.find('img', {'class': 'form-control'})

        if not csrf_token or not captcha_img or not captcha_img.get('src'):
            raise ValueError("Could not find CSRF token or CAPTCHA image on the login page.")

        img_base64_data = captcha_img['src']
        
        session_storage[session_id] = {
            'session': api_session,
            'csrf_token': csrf_token
        }

        print(f"[INFO] CAPTCHA and CSRF fetched successfully for session: {session_id}")
        return jsonify({
            'status': 'captcha_ready',
            'session_id': session_id,
            'captcha_image_data': img_base64_data
        })

    except requests.exceptions.Timeout:
        print(f"[ERROR] VTOP CONNECTION TIMEOUT during start-login.")
        message = "VTOP is taking too long to respond. Please try again in a few minutes."
        return jsonify({'status': 'vtop_connection_error', 'message': message}), 504
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] VTOP CONNECTION ERROR during start-login: {e}")
        message = "Could not connect to VTOP. The service may be down."
        return jsonify({'status': 'vtop_connection_error', 'message': message}), 503
    except Exception as e:
        print(f"[ERROR] GENERIC ERROR during start-login: {e}")
        return jsonify({'status': 'failure', 'message': "An unexpected error occurred while trying to load the login page."}), 500


@auth_bp.route('/login-attempt', methods=['POST'])
def login_attempt():
    data = request.json
    username, password, captcha_text, session_id = data.get('username'), data.get('password'), data.get('captcha'), data.get('session_id')
    
    if not all([username, password, captcha_text, session_id]) or session_id not in session_storage:
        return jsonify({'status': 'failure', 'message': 'Session expired. Please refresh.'}), 400
        
    stored_session = session_storage[session_id]
    api_session = stored_session['session']
    csrf_token = stored_session['csrf_token']

    try:
        payload = {"_csrf": csrf_token, "username": username, "password": password, "captchaStr": captcha_text}
        login_url = VTOP_BASE_URL + "login"
        response = api_session.post(login_url, data=payload, headers=HEADERS, verify=False, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Success is determined by the absence of the login form on the response page.
        login_form = soup.find('form', {'id': 'vtopLoginForm'})

        if not login_form:
            print(f"[INFO] Login successful for {username}!")
            stored_session['username'] = username
            return jsonify({'status': 'success', 'message': f'Welcome, {username}!', 'session_id': session_id})
        else:
            print(f"[INFO] Login failed for {username}. Analyzing error...")
            
            error_message = "Invalid credentials or CAPTCHA." 
            status_code = 'credentials_invalid'

            error_tag = soup.select_one("span.text-danger strong")
            if error_tag:
                specific_error_text = error_tag.get_text(strip=True).lower()
                if 'captcha' in specific_error_text:
                    status_code = 'invalid_captcha'
                    error_message = 'The CAPTCHA you entered was incorrect. Please try again.'
                elif 'loginid' in specific_error_text or 'password' in specific_error_text:
                    status_code = 'invalid_credentials'
                    error_message = 'Invalid username or password. Please check your credentials.'
                else:
                    error_message = error_tag.get_text(strip=True) 
            
            # Get the new CAPTCHA from the failed login page.
            new_captcha_img = soup.find('img', {'class': 'form-control'})
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
        print(f"[ERROR] GENERIC ERROR during login-attempt: {e}")
        return jsonify({'status': 'failure', 'message': str(e)}), 500


@auth_bp.route('/logout', methods=['POST'])
def logout():
    session_id = request.json.get('session_id')
    if session_id and session_id in session_storage:
        del session_storage[session_id]
    print(f"\n[INFO] Session {session_id} cleared and logged out.")
    return jsonify({'status': 'success'})

