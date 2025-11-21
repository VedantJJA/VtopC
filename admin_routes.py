from flask import Blueprint, render_template, jsonify, request
import datetime
import os
from session_manager import session_storage

admin_bp = Blueprint('admin_bp', __name__)

# --- Stats Storage ---
traffic_logs = []
MAX_LOGS = 100
total_site_visits = 0
device_stats = {'mobile': 0, 'desktop': 0} # NEW: Track devices

def log_request(endpoint, method, ip):
    """Adds a request to the in-memory log, counts visits, and tracks devices."""
    global total_site_visits
    
    # 1. Count "Visits" and Check Device Type
    if method == 'GET' and (endpoint == '/' or endpoint == '/login'):
        total_site_visits += 1
        
        # Simple Device Detection
        user_agent = request.headers.get('User-Agent', '').lower()
        if 'mobile' in user_agent or 'android' in user_agent or 'iphone' in user_agent:
            device_stats['mobile'] += 1
        else:
            device_stats['desktop'] += 1

    # 2. Log details
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    traffic_logs.insert(0, {
        'time': timestamp,
        'endpoint': endpoint,
        'method': method,
        'ip': ip
    })
    if len(traffic_logs) > MAX_LOGS:
        traffic_logs.pop()

@admin_bp.route('/admin')
def admin_dashboard():
    return render_template('admin.html')

@admin_bp.route('/admin/stats', methods=['POST'])
def get_admin_stats():
    session_id = request.json.get('session_id')
    
    # Auth Check
    if not session_id or session_id not in session_storage or session_storage[session_id].get('type') != 'ADMIN':
        return jsonify({'status': 'failure', 'message': 'Unauthorized'}), 401

    # User List
    user_list = []
    for sid, data in session_storage.items():
        user_list.append({
            'username': data.get('username', 'Unknown'),
            # 'session_id': sid,  <-- REMOVED for privacy/simplicity as per your request
            'is_admin': data.get('type') == 'ADMIN'
        })

    return jsonify({
        'status': 'success',
        'active_users_count': len(session_storage),
        'total_site_visits': total_site_visits,
        'device_stats': device_stats, # Sending the new stat
        'traffic_logs': traffic_logs[:20], 
        'user_list': user_list
    })

@admin_bp.route('/admin/kill-session', methods=['POST'])
def kill_session():
    # Dummy endpoint to prevent 404 errors if old JS is cached
    return jsonify({'status': 'error', 'message': 'Feature disabled'})