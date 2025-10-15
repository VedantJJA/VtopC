import threading
import time
import webbrowser
from flask import Flask, render_template, send_from_directory
from flask_cors import CORS  # <<< ADD THIS IMPORT

# Import blueprints
from auth import auth_bp
from data_routes import data_bp

app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app)  # <<< ADD THIS LINE TO ENABLE CORS

# Register blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(data_bp)

@app.route('/')
def index():
    """Serves the main frontend page."""
    return render_template('frontend.html')

@app.route('/<path:filename>')
def serve_static(filename):
    """Serves static files."""
    return send_from_directory('.', filename)

def open_browser():
    """Opens the web browser to the application's URL after a short delay."""
    time.sleep(1.5)
    webbrowser.open_new('http://127.0.0.1:5000/')

if __name__ == '__main__':
    print("--- VTOP PROXY BACKEND (STEALTH MODE) ---")
    # Run the browser opening in a separate thread
    threading.Thread(target=open_browser).start()
    # Run the Flask app
    app.run(port=5000, host='127.0.0.1')