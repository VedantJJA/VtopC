# VITCClone/data_routes.py
from flask import Blueprint, jsonify, request, render_template
from bs4 import BeautifulSoup
import requests
import warnings

from session_manager import session_storage
from parser import parse_course_data

warnings.filterwarnings('ignore', category=requests.packages.urllib3.exceptions.InsecureRequestWarning)

data_bp = Blueprint('data_bp', __name__)

TIMETABLE_TARGET = 'academics/common/StudentTimeTableChn'

@data_bp.route('/fetch-data', methods=['POST'])
def fetch_data():
    data = request.json
    session_id, target = data.get('session_id'), data.get('target')

    if not session_id or 'session' not in session_storage.get(session_id, {}):
        return jsonify({'status': 'failure', 'message': 'Invalid session.'}), 400

    session = session_storage[session_id]['session']
    username = session_storage[session_id]['username']
    print(f"\n--- Fetching '{target}' for {username} ---")

    try:
        base_url = "https://vtopcc.vit.ac.in/vtop"
        
        print("   > Fetching /content to get latest CSRF token...")
        content_res = session.get(f"{base_url}/content", verify=False)
        content_res.raise_for_status()
        soup = BeautifulSoup(content_res.text, 'html.parser')
        
        csrf_token_tag = soup.find('input', {'name': '_csrf'})
        if not csrf_token_tag:
            return jsonify({'status': 'session_expired', 'message': 'Session expired. Please log out and log in again.'}), 401
        csrf_token = csrf_token_tag['value']
        print("   > Successfully retrieved CSRF token.")

        if target == TIMETABLE_TARGET:
            print("   > [Step 1/2] Fetching initial timetable page to find Semester ID...")
            headers = {'X-Requested-With': 'XMLHttpRequest'}
            initial_tt_page_res = session.post(
                f"{base_url}/{target}", 
                data={'authorizedID': username, '_csrf': csrf_token, 'verifyMenu': 'true'}, 
                headers=headers,
                verify=False
            )
            initial_tt_page_res.raise_for_status()
            
            tt_soup = BeautifulSoup(initial_tt_page_res.text, 'html.parser')
            semester_select_tag = tt_soup.find('select', {'id': 'semesterSubId'})
            
            if not semester_select_tag:
                raise ValueError("Could not find semester dropdown on the timetable page.")
            
            semester_sub_id = None
            for option in semester_select_tag.find_all('option'):
                if option.get('value') and len(option.get('value')) > 0:
                    semester_sub_id = option['value']
                    break
            
            if not semester_sub_id:
                raise ValueError("Could not find a valid semester value in the dropdown.")
            
            print(f"   > Found Semester ID: {semester_sub_id}")

            print("   > [Step 2/2] Fetching actual timetable data with Semester ID...")
            payload = {'authorizedID': username, '_csrf': csrf_token, 'semesterSubId': semester_sub_id}
            data_res = session.post(f"{base_url}/processViewTimeTable", data=payload, headers=headers, verify=False)
            data_res.raise_for_status()
            
            print("   > Parsing timetable data and rendering custom template.")
            parsed_data = parse_course_data(data_res.text)
            rendered_html = render_template('timetable_display.html', data=parsed_data)
            return jsonify({'status': 'success', 'html_content': rendered_html})
        
        else:
            print(f"   > Performing generic fetch for target: {target}")
            payload = {'authorizedID': username, '_csrf': csrf_token, 'verifyMenu': 'true'}
            headers = {'X-Requested-With': 'XMLHttpRequest'}
            data_res = session.post(f"{base_url}/{target}", data=payload, headers=headers, verify=False)
            data_res.raise_for_status()
            return jsonify({'status': 'success', 'html_content': data_res.text})

    except Exception as e:
        print(f"   > CRITICAL ERROR in '/fetch-data': {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'failure', 'message': str(e)}), 500