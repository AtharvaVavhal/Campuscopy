"""
CampusCopy Print Bridge — Headless
Run with: python bridge.py

Requirements:
  pip install requests python-dotenv schedule pikepdf
  macOS/Linux: CUPS must be installed  (brew install cups  / apt install cups)
  Windows:     SumatraPDF recommended  (https://www.sumatrapdfreader.org)
               Fallback: pywin32       (pip install pywin32)
"""

import os
import sys
import time
import platform
import subprocess
import tempfile
import threading
import logging
import requests
import schedule
from dotenv import load_dotenv

# ── Logging ───────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)-7s %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("bridge.log", encoding="utf-8"),
    ],
)
log = logging.getLogger("bridge")

# ── Config ────────────────────────────────────────────────────
load_dotenv()

API_URL      = os.getenv("API_URL",      "https://campuscopy-api.onrender.com")
PRINTER_ID   = os.getenv("PRINTER_ID",  "")
API_KEY      = os.getenv("API_KEY",     "")
PRINTER_NAME = os.getenv("PRINTER_NAME", "")   # CUPS/system printer name (optional)

HEADERS = {"x-api-key": API_KEY}

# Jobs currently being processed — prevents double-processing on fast polls
_in_progress      = set()
_in_progress_lock = threading.Lock()


# ════════════════════════════════════════════════════════════════
# API helpers
# ════════════════════════════════════════════════════════════════

def heartbeat():
    try:
        r = requests.post(
            f"{API_URL}/api/printers/{PRINTER_ID}/heartbeat",
            headers=HEADERS, timeout=5,
        )
        if r.status_code == 200:
            log.info("Heartbeat OK")
        else:
            log.warning(f"Heartbeat failed: {r.status_code}")
    except Exception as e:
        log.error(f"Heartbeat error: {e}")


def update_status(job_id, status):
    try:
        r = requests.patch(
            f"{API_URL}/api/jobs/{job_id}/status",
            json={"status": status},
            headers=HEADERS,
            timeout=5,
        )
        if r.status_code == 200:
            log.info(f"  → {status.upper()}")
        else:
            log.warning(f"  Status update rejected ({r.status_code}): {r.text}")
    except Exception as e:
        log.error(f"Status update error: {e}")


def download_pdf(job_id):
    """Download the job PDF to a temp file. Returns path or None."""
    try:
        r = requests.get(
            f"{API_URL}/api/jobs/{job_id}/file",
            headers=HEADERS, timeout=30,
        )
        if r.status_code == 200:
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
            tmp.write(r.content)
            tmp.close()
            log.info(f"  Downloaded to {tmp.name} ({len(r.content)//1024} KB)")
            return tmp.name
        else:
            log.error(f"  File download failed: {r.status_code}")
    except Exception as e:
        log.error(f"  Download error: {e}")
    return None


# ════════════════════════════════════════════════════════════════
# Page range extraction
# ════════════════════════════════════════════════════════════════

def extract_page_range(src_path, page_from, page_to):
    """
    Use pikepdf to extract pages page_from..page_to (1-indexed, inclusive)
    into a new temp PDF. Returns the new path, or src_path if extraction fails.
    """
    try:
        import pikepdf
        with pikepdf.open(src_path) as pdf:
            total = len(pdf.pages)
            pf = max(1, int(page_from))
            pt = min(total, int(page_to))
            if pf == 1 and pt == total:
                return src_path   # no extraction needed
            log.info(f"  Extracting pages {pf}–{pt} of {total}")
            new_pdf = pikepdf.Pdf.new()
            for i in range(pf - 1, pt):         # pikepdf pages are 0-indexed
                new_pdf.pages.append(pdf.pages[i])
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
            tmp.close()
            new_pdf.save(tmp.name)
            return tmp.name
    except ImportError:
        log.warning("  pikepdf not installed — printing full document")
    except Exception as e:
        log.warning(f"  Page extraction failed ({e}) — printing full document")
    return src_path


# ════════════════════════════════════════════════════════════════
# Printing
# ════════════════════════════════════════════════════════════════

def _print_windows(file_path, copies, color, duplex):
    """
    Windows printing via SumatraPDF (preferred) or win32api fallback.
    SumatraPDF supports -print-settings for copies/duplex/color.
    """
    sumatra = r"C:\Program Files\SumatraPDF\SumatraPDF.exe"

    # Build SumatraPDF print-settings string
    settings_parts = [f"{copies}x"]
    if duplex:
        settings_parts.append("duplexlong")
    if not color:
        settings_parts.append("monochrome")

    settings_str = ",".join(settings_parts)

    if os.path.exists(sumatra):
        cmd = [sumatra, "-print-to-default", "-print-settings", settings_str, file_path]
        log.info(f"  SumatraPDF: {' '.join(cmd)}")
        subprocess.run(cmd, check=True, timeout=120)
        return

    # Fallback: pywin32 ShellExecute (basic, 1 copy per call)
    try:
        import win32api
        import win32print
        default_printer = win32print.GetDefaultPrinter()
        log.info(f"  win32api print to: {default_printer}")
        for i in range(copies):
            win32api.ShellExecute(0, "print", file_path, None, ".", 0)
            if copies > 1:
                time.sleep(3)   # wait between copies
        return
    except ImportError:
        pass

    # Last resort: rundll32 (no copies/duplex control)
    log.warning("  pywin32 not found, using rundll32 (no copies/duplex control)")
    for i in range(copies):
        subprocess.run(
            ["rundll32.exe", "mshtml.dll,PrintHTML", file_path],
            timeout=120,
        )
        if copies > 1:
            time.sleep(3)


def _print_cups(file_path, copies, color, duplex):
    """
    macOS / Linux CUPS printing via lp.
    Honours copies, duplex, color, and optional PRINTER_NAME.
    """
    cmd = ["lp", "-n", str(copies)]

    # Use specific CUPS printer if configured, otherwise system default
    if PRINTER_NAME:
        cmd += ["-d", PRINTER_NAME]

    # Duplex
    if duplex:
        cmd += ["-o", "sides=two-sided-long-edge"]
    else:
        cmd += ["-o", "sides=one-sided"]

    # Color / monochrome
    if color:
        cmd += ["-o", "ColorModel=RGB"]
    else:
        cmd += ["-o", "ColorModel=Gray"]

    # Fit to page
    cmd += ["-o", "fit-to-page"]

    cmd.append(file_path)

    log.info(f"  CUPS: {' '.join(cmd)}")
    result = subprocess.run(cmd, timeout=120, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"lp failed (code {result.returncode}): {result.stderr.strip()}")
    log.info(f"  Queued: {result.stdout.strip()}")


def print_pdf(file_path, job):
    """
    Main print dispatcher. Handles page range extraction, then routes to
    the correct platform backend.
    Returns True on success, False on any failure.
    """
    try:
        copies = max(1, int(job.get("copies", 1)))
        color  = bool(job.get("color", False))
        duplex = bool(job.get("double_sided", False))
        pf     = job.get("page_from")
        pt     = job.get("page_to")

        # Extract page range into a separate temp file if needed
        print_path = file_path
        range_tmp  = None
        if pf and pt:
            print_path = extract_page_range(file_path, pf, pt)
            if print_path != file_path:
                range_tmp = print_path   # track for cleanup

        log.info(
            f"  Printing: {copies} cop{'y' if copies==1 else 'ies'} | "
            f"{'Color' if color else 'B&W'} | "
            f"{'Duplex' if duplex else 'Simplex'}"
        )

        system = platform.system()
        if system == "Windows":
            _print_windows(print_path, copies, color, duplex)
        else:
            _print_cups(print_path, copies, color, duplex)

        # Clean up range-extracted temp
        if range_tmp:
            try:
                os.unlink(range_tmp)
            except Exception:
                pass

        return True

    except Exception as e:
        log.error(f"  Print error: {e}")
        return False


# ════════════════════════════════════════════════════════════════
# Job processor
# ════════════════════════════════════════════════════════════════

def process_job(job):
    job_id = job["id"]
    fname  = job.get("file_name", job_id[:8])

    log.info(f"Processing: {fname}")

    update_status(job_id, "queued")
    time.sleep(0.5)

    pdf_path = download_pdf(job_id)
    if not pdf_path:
        update_status(job_id, "failed")
        with _in_progress_lock:
            _in_progress.discard(job_id)
        return

    update_status(job_id, "printing")
    time.sleep(0.5)

    success = print_pdf(pdf_path, job)

    # Clean up downloaded PDF
    try:
        os.unlink(pdf_path)
    except Exception:
        pass

    final = "done" if success else "failed"
    update_status(job_id, final)

    with _in_progress_lock:
        _in_progress.discard(job_id)

    log.info(f"{'✅' if success else '❌'} {final.upper()}: {fname}")


# ════════════════════════════════════════════════════════════════
# Queue poller
# ════════════════════════════════════════════════════════════════

def poll_queue():
    try:
        r = requests.get(
            f"{API_URL}/api/jobs/printer/{PRINTER_ID}",
            headers=HEADERS, timeout=10,
        )
        if r.status_code != 200:
            log.warning(f"Poll failed: {r.status_code}")
            return

        jobs     = r.json().get("jobs", [])
        paid     = [j for j in jobs if j["status"] == "paid"]
        active   = [j for j in jobs if j["status"] in ("pending","paid","queued","printing")]

        log.info(f"Queue: {len(active)} active | {len(paid)} ready to print")

        new_jobs = []
        with _in_progress_lock:
            for j in paid:
                if j["id"] not in _in_progress:
                    _in_progress.add(j["id"])
                    new_jobs.append(j)

        for job in new_jobs:
            t = threading.Thread(target=process_job, args=(job,), daemon=True)
            t.start()

    except Exception as e:
        log.error(f"Poll error: {e}")


# ════════════════════════════════════════════════════════════════
# Entry point
# ════════════════════════════════════════════════════════════════

def main():
    log.info("CampusCopy Print Bridge starting…")
    log.info(f"Platform:   {platform.system()} {platform.release()}")
    log.info(f"API URL:    {API_URL}")
    log.info(f"Printer ID: {PRINTER_ID or '(not set)'}")
    if PRINTER_NAME:
        log.info(f"CUPS name:  {PRINTER_NAME}")
    else:
        log.info("CUPS name:  (system default)")

    if not PRINTER_ID or not API_KEY:
        log.error("PRINTER_ID and API_KEY must be set in .env")
        log.error("Run bridge_gui.py first to auto-register, then copy the .env values.")
        sys.exit(1)

    # Check lp is available on non-Windows
    if platform.system() != "Windows":
        try:
            subprocess.run(["lp", "--version"], capture_output=True, timeout=3)
        except FileNotFoundError:
            log.error("'lp' (CUPS) not found.")
            log.error("  macOS: brew install cups")
            log.error("  Linux: sudo apt install cups")
            sys.exit(1)

    schedule.every(30).seconds.do(heartbeat)
    schedule.every(10).seconds.do(poll_queue)

    heartbeat()
    poll_queue()

    log.info("Bridge running. Press Ctrl+C to stop.")
    try:
        while True:
            schedule.run_pending()
            time.sleep(1)
    except KeyboardInterrupt:
        log.info("Stopped.")


if __name__ == "__main__":
    main()