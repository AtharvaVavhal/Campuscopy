import os
import time
import requests
import schedule
import tempfile
from dotenv import load_dotenv

load_dotenv()

API_URL = os.getenv("API_URL", "http://localhost:5000")
PRINTER_ID = os.getenv("PRINTER_ID", "")
API_KEY = os.getenv("API_KEY", "")
PRINTER_NAME = os.getenv("PRINTER_NAME", "")

HEADERS = {"x-api-key": API_KEY}

def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")

def heartbeat():
    try:
        res = requests.post(f"{API_URL}/api/printers/{PRINTER_ID}/heartbeat", headers=HEADERS, timeout=5)
        if res.status_code == 200:
            log("Heartbeat sent")
        else:
            log(f"Heartbeat failed: {res.status_code}")
    except Exception as e:
        log(f"Heartbeat error: {e}")

def download_pdf(job_id, file_path):
    try:
        res = requests.get(f"{API_URL}/api/jobs/{job_id}/file", headers=HEADERS, timeout=30)
        if res.status_code == 200:
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
            tmp.write(res.content)
            tmp.close()
            return tmp.name
    except Exception as e:
        log(f"Download error: {e}")
    return None

def print_pdf(file_path, job):
    try:
        # On Windows, use:
        # import win32api
        # win32api.ShellExecute(0, "print", file_path, f'/d:"{PRINTER_NAME}"', ".", 0)
        
        # On Mac/Linux for testing, use lp:
        copies = job.get("copies", 1)
        color = job.get("color", False)
        cmd = f'lp -n {copies} "{file_path}"'
        log(f"Printing: {cmd}")
        os.system(cmd)
        return True
    except Exception as e:
        log(f"Print error: {e}")
        return False

def update_status(job_id, status):
    try:
        requests.patch(
            f"{API_URL}/api/jobs/{job_id}/status",
            json={"status": status},
            headers=HEADERS,
            timeout=5
        )
        log(f"Job {job_id[:8]}... -> {status}")
    except Exception as e:
        log(f"Status update error: {e}")

def poll_queue():
    try:
        res = requests.get(f"{API_URL}/api/jobs/printer/{PRINTER_ID}", headers=HEADERS, timeout=10)
        if res.status_code != 200:
            log(f"Poll failed: {res.status_code}")
            return

        jobs = res.json().get("jobs", [])
        paid_jobs = [j for j in jobs if j["status"] == "paid"]

        if not paid_jobs:
            log("No jobs in queue")
            return

        for job in paid_jobs:
            job_id = job["id"]
            log(f"Processing job: {job['file_name']}")

            # Mark as queued
            update_status(job_id, "queued")
            time.sleep(1)

            # Download PDF
            pdf_path = download_pdf(job_id, job.get("file_path", ""))
            if not pdf_path:
                update_status(job_id, "failed")
                continue

            # Mark as printing
            update_status(job_id, "printing")
            time.sleep(1)

            # Print
            success = print_pdf(pdf_path, job)

            # Cleanup temp file
            try:
                os.unlink(pdf_path)
            except:
                pass

            # Mark done or failed
            update_status(job_id, "done" if success else "failed")

    except Exception as e:
        log(f"Poll error: {e}")

def main():
    log("CampusCopy Print Bridge starting...")
    log(f"Printer ID: {PRINTER_ID}")
    log(f"API: {API_URL}")

    if not PRINTER_ID or not API_KEY:
        log("ERROR: PRINTER_ID and API_KEY must be set in .env")
        return

    # Send heartbeat every 30 seconds
    schedule.every(30).seconds.do(heartbeat)

    # Poll for jobs every 10 seconds
    schedule.every(10).seconds.do(poll_queue)

    # Run immediately on start
    heartbeat()
    poll_queue()

    while True:
        schedule.run_pending()
        time.sleep(1)

if __name__ == "__main__":
    main()
