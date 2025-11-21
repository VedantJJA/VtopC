from flask import Flask, render_template, redirect, url_for, request
from flask_cors import CORS
import os
from whitenoise import WhiteNoise

# Import blueprints
from auth import auth_bp
from data_routes import data_bp
from admin_routes import admin_bp, log_request # Import Admin routes and logger

app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app)

# Add whitenoise
app.wsgi_app = WhiteNoise(app.wsgi_app)

# --- Middleware to log traffic for Admin Panel ---
@app.before_request
def log_traffic():
    # Ignore static files and internal poll requests to avoid cluttering logs
    ignored_paths = ['/static', '/check-session', '/admin/stats']
    if not any(request.path.startswith(p) for p in ignored_paths):
        log_request(request.path, request.method, request.remote_addr)

# Register blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(data_bp)
app.register_blueprint(admin_bp) # Register Admin Blueprint

@app.route('/')
def index():
    """Serves the main dashboard page."""
    return render_template('dashboard.html')

@app.route('/login')
def login():
    """Serves the login page."""
    return render_template('login.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)