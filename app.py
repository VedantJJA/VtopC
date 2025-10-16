from flask import Flask, render_template
from flask_cors import CORS
import os

# Import blueprints
from auth import auth_bp
from data_routes import data_bp

app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app)

# Register blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(data_bp)

@app.route('/')
def index():
    """Serves the main frontend page."""
    return render_template('frontend.html')

if __name__ == '__main__':
    # This block is for production environments like Render.
    # It gets the port number from an environment variable, which Render sets automatically.
    # The host '0.0.0.0' makes the app accessible from outside its container.
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
