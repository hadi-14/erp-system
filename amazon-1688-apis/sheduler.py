from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime, timedelta
import subprocess
import threading
import schedule
import time
import json
import os
from pathlib import Path

app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# Database file for persisting script status
DB_FILE = 'scripts_db.json'

# Script names to monitor
SCRIPT_NAMES = ['site1688', 'transform', 'translate', 'amazon', 'amazon_ratings_scraper']

# In-memory storage for execution tracking
execution_status = {}
scheduled_tasks = {}

def init_db():
    """Initialize database with script info"""
    if not os.path.exists(DB_FILE):
        data = {
            script: {
                'name': script,
                'status': 'pending',
                'progress': 0,
                'lastExecution': None,
                'nextRun': None,
                'alerts': []
            }
            for script in SCRIPT_NAMES
        }
        save_db(data)
    return load_db()

def load_db():
    """Load scripts data from file"""
    try:
        with open(DB_FILE, 'r') as f:
            return json.load(f)
    except:
        return {}

def save_db(data):
    """Save scripts data to file"""
    with open(DB_FILE, 'w') as f:
        json.dump(data, f, indent=2)

def execute_script_async(script_name):
    """Execute script in background thread"""
    def run():
        db = load_db()
        db[script_name]['status'] = 'running'
        db[script_name]['progress'] = 10
        save_db(db)
        
        try:
            # Try to execute the script
            result = subprocess.run(
                ['/home/mkddz/erp/amazon-1688-apis/venv/bin/python', f'/home/mkddz/amazon-1688-apis/{script_name}.py'],
                capture_output=True,
                timeout=300,
                text=True
            )
            
            db = load_db()
            if result.returncode == 0:
                db[script_name]['status'] = 'completed'
                db[script_name]['progress'] = 100
                db[script_name]['alerts'] = []
            else:
                db[script_name]['status'] = 'failed'
                db[script_name]['alerts'] = [result.stderr[:200]]
            
            db[script_name]['lastExecution'] = datetime.now().isoformat()
            save_db(db)
        except subprocess.TimeoutExpired:
            db = load_db()
            db[script_name]['status'] = 'failed'
            db[script_name]['alerts'] = ['Script execution timeout (5 minutes)']
            db[script_name]['lastExecution'] = datetime.now().isoformat()
            save_db(db)
        except Exception as e:
            db = load_db()
            db[script_name]['status'] = 'failed'
            db[script_name]['alerts'] = [str(e)]
            db[script_name]['lastExecution'] = datetime.now().isoformat()
            save_db(db)
    
    thread = threading.Thread(target=run)
    thread.daemon = True
    thread.start()

def schedule_script_execution(script_name, time_str):
    """Schedule script to run at specific time"""
    def scheduled_job():
        execute_script_async(script_name)
    
    # Remove old schedule if exists
    if script_name in scheduled_tasks:
        schedule.cancel_job(scheduled_tasks[script_name])
    
    # Schedule new job
    job = schedule.at(time_str).do(scheduled_job)
    scheduled_tasks[script_name] = job
    
    # Calculate next run time
    next_run = datetime.strptime(time_str, '%H:%M')
    now = datetime.now()
    next_run = next_run.replace(year=now.year, month=now.month, day=now.day)
    
    if next_run <= now:
        next_run += timedelta(days=1)
    
    return next_run.isoformat()

def run_scheduler():
    """Run scheduled jobs in background"""
    while True:
        schedule.run_pending()
        time.sleep(60)

# API Routes

@app.route('/api/scripts', methods=['GET'])
def get_scripts():
    """Get all scripts status"""
    db = load_db()
    scripts = []
    for i, (name, data) in enumerate(db.items()):
        scripts.append({
            'id': i + 1,
            **data
        })
    return jsonify(scripts)

@app.route('/api/scripts/<script_name>/execute', methods=['POST'])
def execute_script(script_name):
    """Execute script immediately"""
    if script_name not in SCRIPT_NAMES:
        return jsonify({'error': 'Script not found'}), 404
    
    db = load_db()
    if db[script_name]['status'] == 'running':
        return jsonify({'error': 'Script is already running'}), 400
    
    execute_script_async(script_name)
    return jsonify({'success': True, 'message': f'Script {script_name} started'})

@app.route('/api/scripts/<script_name>/schedule', methods=['POST'])
def schedule_script(script_name):
    """Schedule script execution"""
    if script_name not in SCRIPT_NAMES:
        return jsonify({'error': 'Script not found'}), 404
    
    data = request.json
    time_str = data.get('time')
    
    if not time_str:
        return jsonify({'error': 'Time parameter required'}), 400
    
    try:
        next_run = schedule_script_execution(script_name, time_str)
        db = load_db()
        db[script_name]['nextRun'] = next_run
        save_db(db)
        return jsonify({'success': True, 'nextRun': next_run})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/scripts/<script_name>/cancel', methods=['POST'])
def cancel_script(script_name):
    """Cancel scheduled execution"""
    if script_name not in SCRIPT_NAMES:
        return jsonify({'error': 'Script not found'}), 404
    
    if script_name in scheduled_tasks:
        schedule.cancel_job(scheduled_tasks[script_name])
        del scheduled_tasks[script_name]
    
    db = load_db()
    db[script_name]['nextRun'] = None
    save_db(db)
    return jsonify({'success': True})

@app.route('/api/health', methods=['GET'])
def health():
    """Health check"""
    return jsonify({'status': 'ok', 'timestamp': datetime.now().isoformat()})

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    # Initialize database
    init_db()
    
    # Start scheduler in background
    scheduler_thread = threading.Thread(target=run_scheduler)
    scheduler_thread.daemon = True
    scheduler_thread.start()
    
    # Run Flask app
    print("Starting Script Monitor Server on http://localhost:8765")
    app.run(debug=True, host='0.0.0.0', port=8765)