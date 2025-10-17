import requests
from flask import Blueprint, jsonify, request, session, redirect
import os

auth_bp = Blueprint('auth', __name__)

# --- Configuration ---
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Connection": "keep-alive"
}

landing_page_url = "https://vtop.vit.ac.in/vtop/"  # Change if your VTOP variant differs
api_session = requests.Session()


# ------------------------------
# ROUTE: /start-login
# ------------------------------
@auth_bp.route('/start-login', methods=['POST'])
def start_login():
    print("[DEBUG] 1. Initiating new login session...")

    try:
        print(f"[DEBUG] Trying to reach: {landing_page_url}")
        landing_page_response = api_session.get(
            landing_page_url,
            headers=HEADERS,
            verify=False,
            timeout=10
        )
        landing_page_response.raise_for_status()  # Raises HTTPError for bad responses
        html = landing_page_response.text
        print("[DEBUG] Successfully fetched VTOP login page.")

    except requests.exceptions.RequestException as e:
        # --- Connection or Timeout Error Handling ---
        print("[WARN] Could not reach VTOP:", e)

        # --- Fallback to local sample file or message ---
        sample_file = os.path.join(os.path.dirname(__file__), "sample_vtop_login.html")

        if os.path.exists(sample_file):
            print("[INFO] Using local fallback HTML file:", sample_file)
            with open(sample_file, "r", encoding="utf-8") as f:
                html = f.read()
        else:
            print("[INFO] No local fallback file found. Sending error message.")
            html = "<h3 style='font-family:sans-serif;color:#b00;'>⚠️ Unable to reach VTOP from the Render server.<br>Please try again locally or using campus/VPN access.</h3>"

    # Return HTML or JSON depending on your front-end expectation
    return html


# ------------------------------
# Optional: Route to check server status
# ------------------------------
@auth_bp.route('/ping', methods=['GET'])
def ping():
    return jsonify({"status": "ok", "message": "Auth service running"})


# ------------------------------
# Example (for manual testing)
# ------------------------------
if __name__ == "__main__":
    from flask import Flask
    app = Flask(__name__)
    app.register_blueprint(auth_bp)
    app.run(host="0.0.0.0", port=5000, debug=True)
