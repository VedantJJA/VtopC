# VtopC

A Flask-based web application that provides a cleaner, more usable interface for VIT Chennai's VTOP student portal. It scrapes and proxies VTOP data through a Python backend, with Firebase authentication and Supabase for data persistence.

---

## What It Does

VTOP's official portal is notoriously painful to use. VtopC acts as a middleware layer — it logs into VTOP on your behalf, scrapes your academic data (attendance, marks, timetable, etc.), and serves it through a cleaner dashboard.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, Flask |
| Frontend | HTML, CSS, JavaScript (86% of the codebase) |
| Auth | Firebase (client-side), PyJWT, itsdangerous |
| Database | Supabase |
| Scraping | BeautifulSoup4, Requests |
| Deployment | Render (via `render.yaml`) |
| Static Files | WhiteNoise |

---

## Project Structure

```
VtopC/
├── app.py               # Flask app entry point, blueprint registration
├── auth.py              # Login, auto-login, logout, session handling
├── session_manager.py   # In-memory session storage
├── data_routes/         # Routes for fetching VTOP data (attendance, marks, etc.)
├── parsers/             # BeautifulSoup parsers for VTOP HTML responses
├── templates/           # Jinja2 HTML templates
├── static/              # Frontend JS, CSS, service worker
├── requirements.txt     # Python dependencies
└── render.yaml          # Render deployment config
```

---

## Local Setup

### Prerequisites

- Python 3.10+
- A Firebase project

### Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/VedantJJA/VtopC.git
   cd VtopC
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run the development server:
   ```bash
   python app.py
   ```

   The app will be available at `http://localhost:5000`.

---

## Deployment (Render)

The `render.yaml` file is already configured for Render. To deploy:

1. Connect your GitHub repo to [Render](https://render.com).
2. Set all environment variables from the `.env` section above in the Render dashboard under **Environment**.
3. Render will automatically run:
   ```
   pip install -r requirements.txt
   gunicorn --workers 3 --timeout 120 app:app
   ```

> **Note:** The free Render tier will spin down after inactivity. Expect cold start delays.

---

## How Authentication Works

1. The app fetches VTOP's login page and extracts a CSRF token.
2. A CAPTCHA image is displayed to the user.
3. On login, credentials + CAPTCHA are POSTed to VTOP's actual login endpoint.
4. On success, credentials are encrypted using `itsdangerous` and stored in an **HttpOnly cookie** (30-day expiry) for auto-login on return visits.
5. VTOP session data is kept in server-side in-memory storage (`session_manager.py`).

> **Important:** Since session storage is in-memory, all sessions are lost on server restart. This is a known limitation of the current design.

---

## Security Notes

- SSL verification is **disabled** (`verify=False`) for requests to VTOP. This is intentional since VTOP's certificate handling is unreliable, but it means traffic between your server and VTOP is not verified.
- The default `SECRET_KEY` in `app.py` is a plaintext fallback. **Never deploy without overriding this with a strong random key in your environment variables.**
- User credentials are stored in a signed (but not encrypted) cookie. Anyone with your `SECRET_KEY` can decode them.

---

## Dependencies

```
Flask
Flask-Cors
requests
beautifulsoup4
gunicorn
whitenoise
python-dotenv
PyJWT
```

---

## Contributing

Pull requests are welcome. For significant changes, open an issue first to discuss what you'd like to change.

---

## Disclaimer

This project is an independent student-created dashboard and is not affiliated with VIT or VTOP. It scrapes live VTOP portal data and may break if VTOP's HTML structure changes. Use responsibly and ensure compliance with VIT's terms of service.

---

## License

For legal information including privacy and terms, see the Legal section in the app.
