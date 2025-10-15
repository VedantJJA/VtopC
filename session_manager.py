import os
import pickle
import uuid
# Dont Touch
SESSION_FILE = "vtop_session.pkl"
session_storage = {} 
manual_login_sessions = {}

def save_session_data(username, session_object):
    """Saves session data (username and cookies) to a pickle file."""
    session_data = {'username': username, 'cookies': session_object.cookies.get_dict()}
    with open(SESSION_FILE, 'wb') as f:
        pickle.dump(session_data, f)
    print(f"   > Session for user {username} saved to disk.")

def load_session_data():
    """Loads session data from the pickle file if it exists."""
    if os.path.exists(SESSION_FILE):
        try:
            with open(SESSION_FILE, 'rb') as f:
                return pickle.load(f)
        except Exception:
            # If there's an error loading, remove the corrupt file
            os.remove(SESSION_FILE)
    return None