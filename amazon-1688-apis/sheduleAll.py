# import amazon
# import amazon_ratings_scraper
# import site1688
# import transform
# import translate

import concurrent.futures
import smtplib
import traceback
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Email configuration
GMAIL_SENDER = os.getenv('GMAIL_SENDER')
GMAIL_APP_PASSWORD = os.getenv('GMAIL_APP_PASSWORD')
GMAIL_RECIPIENTS = [email.strip() for email in os.getenv('GMAIL_RECIPIENTS', '').split(',')]

# Modules to run in parallel
MODULES = [
    'amazon-old',
    'amazon_ratings_scraper',
#    'arsp',
    'site1688',
    'transform',
    'translate'
]


def send_email(subject, body, is_error=False):
    """Send email notification via Gmail"""
    try:
        msg = MIMEMultipart()
        msg['From'] = GMAIL_SENDER
        msg['To'] = ', '.join(GMAIL_RECIPIENTS)
        msg['Subject'] = f"{'❌ ERROR' if is_error else '✅ SUCCESS'}: {subject}"
        
        # Add timestamp to body
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S PKT')
        full_body = f"Timestamp: {timestamp}\n\n{body}"
        
        msg.attach(MIMEText(full_body, 'plain'))
        
        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            server.login(GMAIL_SENDER, GMAIL_APP_PASSWORD)
            server.sendmail(GMAIL_SENDER, GMAIL_RECIPIENTS, msg.as_string())
        
        print(f"Email sent: {subject}")
    except Exception as e:
        print(f"Failed to send email: {e}")


def run_module(module_name):
    """Run a single module and return result"""
    try:
        print(f"Starting: {module_name}")
        module = __import__(module_name)
        
        # Check if module has a main() function, otherwise just import runs it
        if hasattr(module, 'main'):
            result = module.main()
        elif hasattr(module, 'run'):
            result = module.run()
        else:
            result = "Module imported successfully (no main/run function)"
        
        print(f"Completed: {module_name}")
        return {
            'module': module_name,
            'status': 'success',
            'result': str(result) if result else 'Completed',
            'error': None
        }
    except Exception as e:
        error_msg = traceback.format_exc()
        print(f"Failed: {module_name} - {e}")
        return {
            'module': module_name,
            'status': 'failed',
            'result': None,
            'error': error_msg
        }


def run_all_parallel():
    """Run all modules in parallel and collect results"""
    start_time = datetime.now()
    results = []
    
    print(f"\n{'='*50}")
    print(f"Starting parallel execution at {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*50}\n")
    
    # Run modules in parallel using ThreadPoolExecutor
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(MODULES)) as executor:
        future_to_module = {executor.submit(run_module, module): module for module in MODULES}
        
        for future in concurrent.futures.as_completed(future_to_module):
            result = future.result()
            results.append(result)
    
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    
    # Separate successes and failures
    successes = [r for r in results if r['status'] == 'success']
    failures = [r for r in results if r['status'] == 'failed']
    
    # Build summary
    summary = f"""
ERP System Scheduled Tasks Report
{'='*50}

Execution Time: {duration:.2f} seconds
Total Modules: {len(MODULES)}
Successful: {len(successes)}
Failed: {len(failures)}

{'='*50}
SUCCESSFUL MODULES:
{'='*50}
"""
    for s in successes:
        summary += f"\n✅ {s['module']}: {s['result']}"
    
    if failures:
        summary += f"\n\n{'='*50}\nFAILED MODULES:\n{'='*50}"
        for f in failures:
            summary += f"\n\n❌ {f['module']}:\n{f['error']}"
    
    print(summary)
    
    # Send email notification
    if failures:
        send_email(
            f"ERP Scheduler - {len(failures)} module(s) failed",
            summary,
            is_error=True
        )
    else:
        send_email(
            f"ERP Scheduler - All {len(successes)} modules completed",
            summary,
            is_error=False
        )
    
    return results


if __name__ == '__main__':
    run_all_parallel()
