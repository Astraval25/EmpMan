import datetime
import hashlib
import os
from functools import wraps
import jwt
import psycopg2
import psycopg2.extras
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(
    app,
    resources={r"/api/*": {"origins": "*"}},
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.config["SECRET_KEY"] = os.getenv("KIOSK_API_SECRET_KEY", "supersecretkey")

# ===============================
# DATABASE CONNECTION
# ===============================

def get_db_config():
    return {
        "host": os.getenv("KIOSK_DB_HOST", "astraval.com"),
        "port": int(os.getenv("KIOSK_DB_PORT", "5432")),
        "user": os.getenv("KIOSK_DB_USER", "postgres"),
        "password": os.getenv("KIOSK_DB_PASSWORD", "root@IET25"),
        "dbname": os.getenv("KIOSK_DB_NAME", "EmpMan"),
    }


def get_db():
    return psycopg2.connect(**get_db_config())

# ===============================
# PASSWORD HASH
# ===============================

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

# ===============================
# TOKEN DECORATOR
# ===============================

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # Let browser CORS preflight pass without JWT.
        if request.method == "OPTIONS":
            return ("", 204)

        auth_header = request.headers.get("Authorization")

        if not auth_header or "Bearer " not in auth_header:
            return jsonify({"error": "Token missing"}), 401

        token = auth_header.split(" ")[1]

        try:
            decoded = jwt.decode(token, app.config["SECRET_KEY"], algorithms=["HS256"])
            request.admin_id = decoded["admin_id"]
        except jwt.PyJWTError:
            return jsonify({"error": "Invalid or expired token"}), 401

        return f(*args, **kwargs)

    return decorated

# ===============================
# ADMIN REGISTER
# ===============================

@app.route("/api/admin/register", methods=["POST"])
def register_admin():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data received"}), 400

        username = str(data.get("username", "")).strip()
        password = data.get("password")

        if not username or not password:
            return jsonify({"error": "Username and password required"}), 400

        with get_db() as db:
            with db.cursor() as cursor:
                cursor.execute(
                    "INSERT INTO admin (username, password_hash) VALUES (%s, %s)",
                    (username, hash_password(password)),
                )

        return jsonify({"message": "Admin registered"}), 201

    except psycopg2.IntegrityError:
        return jsonify({"error": "Admin already exists"}), 400

    except Exception as e:
        print("REGISTER ERROR:", e)
        return jsonify({"error": "Server error"}), 500

# ===============================
# ADMIN LOGIN
# ===============================

@app.route("/api/admin/login", methods=["POST"])
def admin_login():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data received"}), 400

        username = str(data.get("username", "")).strip()
        password = data.get("password")

        if not username or not password:
            return jsonify({"error": "Username and password required"}), 400

        with get_db() as db:
            with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                cursor.execute(
                    "SELECT * FROM admin WHERE username=%s AND password_hash=%s",
                    (username, hash_password(password)),
                )
                admin = cursor.fetchone()

        if not admin:
            return jsonify({"error": "Invalid credentials"}), 401

        token = jwt.encode(
            {
                "admin_id": admin["admin_id"],
                "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=2)
            },
            app.config["SECRET_KEY"],
            algorithm="HS256"
        )

        return jsonify({
            "token": token,
            "admin": username
        })

    except Exception as e:
        print("LOGIN ERROR:", e)
        return jsonify({"error": "Server error"}), 500

# ===============================
# GET USERS
# ===============================

@app.route("/api/admin/users", methods=["GET"])
@token_required
def get_users():
    with get_db() as db:
        with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT users.username, admin.username AS created_by
                FROM users
                JOIN admin ON users.create_admin_id = admin.admin_id
                WHERE users.create_admin_id = %s
                ORDER BY users.username
                """,
                (request.admin_id,),
            )
            users = cursor.fetchall()

    return jsonify(users)

# ===============================
# CREATE USER
# ===============================

@app.route("/api/admin/users", methods=["POST"])
@token_required
def create_user():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data received"}), 400

        username = str(data.get("username", "")).strip()
        password = data.get("password")

        if not username or not password:
            return jsonify({"error": "Username and password required"}), 400

        with get_db() as db:
            with db.cursor() as cursor:
                cursor.execute(
                    "INSERT INTO users (username, password_hash, create_admin_id) VALUES (%s, %s, %s)",
                    (username, hash_password(password), request.admin_id),
                )

        return jsonify({"message": "User created"}), 201

    except psycopg2.IntegrityError:
        return jsonify({"error": "User already exists"}), 400

    except Exception as e:
        print("CREATE USER ERROR:", e)
        return jsonify({"error": "Server error"}), 500

# ===============================
# GET USER LOGS
# ===============================

@app.route("/api/admin/users/<username>/logs", methods=["GET"])
@token_required
def get_logs(username):
    with get_db() as db:
        with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT user_id
                FROM users
                WHERE username=%s
                  AND create_admin_id=%s
                """,
                (username, request.admin_id),
            )
            user = cursor.fetchone()

            if not user:
                return jsonify([])

            cursor.execute(
                "SELECT template, log AS activity, log_time AS timestamp FROM logs WHERE user_id=%s",
                (user["user_id"],),
            )
            logs = cursor.fetchall()

    return jsonify(logs)

# ===============================
# GET USER ANALYTICS
# ===============================

@app.route("/api/admin/users/<username>/analytics", methods=["GET"])
@token_required
def get_user_analytics(username):
    with get_db() as db:
        with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT user_id
                FROM users
                WHERE username=%s
                  AND create_admin_id=%s
                """,
                (username, request.admin_id),
            )
            user = cursor.fetchone()

            if not user:
                return jsonify({
                    "username": username,
                    "total_logs": 0,
                    "total_span_seconds": 0,
                    "total_span_hours": 0.0,
                    "first_log": None,
                    "last_log": None,
                    "hourly_counts": [],
                    "daily_counts": [],
                })

            cursor.execute(
                """
                SELECT
                    COUNT(*)::int AS total_logs,
                    MIN(log_time) AS first_log,
                    MAX(log_time) AS last_log
                FROM logs
                WHERE user_id=%s
                """,
                (user["user_id"],),
            )
            summary = cursor.fetchone() or {}

            first_log = summary.get("first_log")
            last_log = summary.get("last_log")
            total_logs = summary.get("total_logs", 0)

            if first_log and last_log:
                total_span_seconds = int((last_log - first_log).total_seconds())
                if total_span_seconds < 0:
                    total_span_seconds = 0
            else:
                total_span_seconds = 0

            total_span_hours = round(total_span_seconds / 3600.0, 2)

            cursor.execute(
                """
                SELECT
                    EXTRACT(HOUR FROM log_time)::int AS hour,
                    COUNT(*)::int AS count
                FROM logs
                WHERE user_id=%s
                GROUP BY hour
                ORDER BY hour
                """,
                (user["user_id"],),
            )
            hourly_counts = cursor.fetchall()

            cursor.execute(
                """
                SELECT
                    DATE(log_time) AS day,
                    COUNT(*)::int AS count
                FROM logs
                WHERE user_id=%s
                GROUP BY day
                ORDER BY day DESC
                LIMIT 14
                """,
                (user["user_id"],),
            )
            daily_counts = cursor.fetchall()

    return jsonify({
        "username": username,
        "total_logs": total_logs,
        "total_span_seconds": total_span_seconds,
        "total_span_hours": total_span_hours,
        "first_log": first_log,
        "last_log": last_log,
        "hourly_counts": hourly_counts,
        "daily_counts": daily_counts,
    })

# ===============================
# RUN SERVER
# ===============================

if __name__ == "__main__":
    app.run(debug=True, use_reloader=False)
