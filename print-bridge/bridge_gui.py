"""
CampusCopy Print Bridge — GUI
Run with: python bridge_gui.py
Requires: pip install requests python-dotenv schedule
"""

import os, subprocess, time, threading, tempfile, platform, uuid
import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox
import requests
import schedule
from dotenv import load_dotenv, set_key

ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
load_dotenv(dotenv_path=ENV_PATH)

# ── MAC address detection ──────────────────────────────────────
def get_mac_address():
    mac = uuid.getnode()
    # uuid.getnode() sets the multicast bit if it generated a random address
    if mac >> 40 & 1:  # multicast bit set → random/fake MAC
        return "unknown-" + "%012x" % mac
    return ':'.join(('%012x' % mac)[i:i+2] for i in range(0, 12, 2))

MAC_ADDRESS = get_mac_address()

# ── Config ────────────────────────────────────────────────────
API_URL      = os.getenv("API_URL",      "https://campuscopy-api.onrender.com")
PRINTER_ID   = os.getenv("PRINTER_ID",  "")
API_KEY      = os.getenv("API_KEY",     "")
PRINTER_NAME = os.getenv("PRINTER_NAME","Main Printer")

# ── Colours ───────────────────────────────────────────────────
BG      = "#08080f"
BG2     = "#0e0e1a"
CARD    = "#111118"
BORDER  = "#1a1a2e"
VIOLET  = "#a78bfa"
EMERALD = "#34d399"
CORAL   = "#fb923c"
GOLD    = "#fbbf24"
RED     = "#f87171"
TEXT    = "#eeeef5"
MUTED   = "#6b6b7e"


class PrintBridgeApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("CampusCopy Print Bridge")
        self.geometry("1000x720")
        self.minsize(900, 620)
        self.configure(bg=BG)

        # Mutable config (may be updated after auto-register)
        self.printer_id   = PRINTER_ID
        self.api_key      = API_KEY
        self.printer_name = PRINTER_NAME

        self.running      = False
        self.connected    = False
        self.jobs         = []
        self._sched_thread = None
        self._in_progress  = set()   # job IDs currently being processed
        self._in_progress_lock = threading.Lock()

        self._build_ui()
        self.protocol("WM_DELETE_WINDOW", self._on_close)

        # Auto-register if no PRINTER_ID yet
        if not self.printer_id:
            self.after(500, self._auto_register)
        else:
            self.log(f"Printer ID loaded from .env", "ok")
            self.log(f"MAC: {MAC_ADDRESS}", "dim")

    # ── Auto-registration ─────────────────────────────────────

    def _auto_register(self):
        self.log("No PRINTER_ID found — attempting auto-registration…", "warn")
        self.log(f"MAC address: {MAC_ADDRESS}", "dim")

        def run():
            try:
                r = requests.post(
                    f"{API_URL}/api/printers/register",
                    json={
                        "mac_address": MAC_ADDRESS,
                        "name":        self.printer_name,
                        "location":    "Unknown",
                    },
                    timeout=10
                )
                if r.status_code in (200, 201):
                    data    = r.json()
                    new_id  = data["printer_id"]
                    new_key = data["api_key"]
                    fresh   = data.get("registered", True)

                    # Save to .env so next launch skips registration
                    set_key(ENV_PATH, "PRINTER_ID", new_id)
                    set_key(ENV_PATH, "API_KEY",    new_key)

                    # Update runtime config
                    self.printer_id = new_id
                    self.api_key    = new_key

                    label = "Registered new printer" if fresh else "Found existing printer"
                    self.after(0, self.log, f"✅ {label}: {data['name']}", "ok")
                    self.after(0, self.log, f"   PRINTER_ID: {new_id}", "dim")
                    self.after(0, self.log, f"   Saved to .env automatically.", "dim")
                else:
                    self.after(0, self.log, f"Registration failed: {r.status_code} {r.text}", "err")
            except Exception as e:
                self.after(0, self.log, f"Registration error: {e}", "err")

        threading.Thread(target=run, daemon=True).start()

    # ── UI construction ───────────────────────────────────────

    def _build_ui(self):
        # ── Top bar ──
        top = tk.Frame(self, bg=BG, pady=14, padx=20)
        top.pack(fill="x")

        tk.Label(top, text="CampusCopy", font=("Helvetica", 20, "bold"),
                 bg=BG, fg=VIOLET).pack(side="left")
        tk.Label(top, text="  Print Bridge", font=("Helvetica", 13),
                 bg=BG, fg=MUTED).pack(side="left", pady=4)

        self.status_frame = tk.Frame(top, bg=BG)
        self.status_frame.pack(side="right")
        self.status_dot = tk.Label(self.status_frame, text="●", font=("Helvetica", 10),
                                   bg=BG, fg=RED)
        self.status_dot.pack(side="left")
        self.status_lbl = tk.Label(self.status_frame, text="Offline",
                                   font=("Helvetica", 11, "bold"), bg=BG, fg=MUTED)
        self.status_lbl.pack(side="left", padx=(4, 20))

        self.start_btn = self._btn(top, "▶  Start Bridge", self._toggle_bridge,
                                   EMERALD, big=True)
        self.start_btn.pack(side="right", padx=(0, 12))

        tk.Frame(self, bg=BORDER, height=1).pack(fill="x")

        body = tk.Frame(self, bg=BG)
        body.pack(fill="both", expand=True, padx=16, pady=16)
        body.columnconfigure(0, weight=1)
        body.columnconfigure(1, weight=1)
        body.rowconfigure(1, weight=1)

        # ── Stat cards ──
        stats = tk.Frame(body, bg=BG)
        stats.grid(row=0, column=0, columnspan=2, sticky="ew", pady=(0, 14))
        for i in range(4): stats.columnconfigure(i, weight=1)

        self.stat_vars = {}
        stat_defs = [
            ("queued_count", "In Queue",   "0", VIOLET),
            ("done_today",   "Done Today", "0", EMERALD),
            ("failed_today", "Failed",     "0", RED),
            ("api_ping",     "API Status", "—", GOLD),
        ]
        for col, (key, label, val, color) in enumerate(stat_defs):
            card = tk.Frame(stats, bg=CARD, relief="flat", bd=0,
                            highlightbackground=BORDER, highlightthickness=1)
            card.grid(row=0, column=col, sticky="ew", padx=(0 if col==0 else 6, 0))
            tk.Label(card, text=label, font=("Helvetica", 9), bg=CARD, fg=MUTED, pady=10).pack()
            var = tk.StringVar(value=val)
            self.stat_vars[key] = var
            tk.Label(card, textvariable=var, font=("Helvetica", 22, "bold"),
                     bg=CARD, fg=color, pady=4).pack()
            tk.Label(card, text="", bg=CARD, pady=6).pack()

        # ── Job queue (left) ──
        left = tk.Frame(body, bg=BG)
        left.grid(row=1, column=0, sticky="nsew", padx=(0, 8))
        left.rowconfigure(1, weight=1)
        left.columnconfigure(0, weight=1)

        tk.Label(left, text="Job Queue", font=("Helvetica", 12, "bold"),
                 bg=BG, fg=TEXT).grid(row=0, column=0, sticky="w", pady=(0, 8))

        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure("Treeview",
            background=CARD, foreground=TEXT, fieldbackground=CARD,
            rowheight=36, bordercolor=BORDER, relief="flat", font=("Helvetica", 11))
        style.configure("Treeview.Heading",
            background=BG2, foreground=MUTED, relief="flat", font=("Helvetica", 9, "bold"))
        style.map("Treeview", background=[("selected", BORDER)])

        cols = ("file", "pages", "cost", "status")
        self.tree = ttk.Treeview(left, columns=cols, show="headings", selectmode="browse")
        self.tree.heading("file",   text="File")
        self.tree.heading("pages",  text="Pages")
        self.tree.heading("cost",   text="Cost")
        self.tree.heading("status", text="Status")
        self.tree.column("file",   width=200, stretch=True)
        self.tree.column("pages",  width=60,  stretch=False)
        self.tree.column("cost",   width=70,  stretch=False)
        self.tree.column("status", width=90,  stretch=False)
        self.tree.grid(row=1, column=0, sticky="nsew")

        sb = ttk.Scrollbar(left, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=sb.set)
        sb.grid(row=1, column=1, sticky="ns")

        ctrl = tk.Frame(left, bg=BG, pady=8)
        ctrl.grid(row=2, column=0, columnspan=2, sticky="ew")
        ctrl.columnconfigure(0, weight=1)
        ctrl.columnconfigure(1, weight=1)
        ctrl.columnconfigure(2, weight=1)
        ctrl.columnconfigure(3, weight=1)
        self._btn(ctrl, "↻ Refresh",   self._manual_refresh, VIOLET).grid(row=0, column=0, sticky="ew", padx=(0,4))
        self._btn(ctrl, "💰 Mark Paid", self._manual_paid,    GOLD).grid(row=0, column=1, sticky="ew", padx=4)
        self._btn(ctrl, "✓ Mark Done", self._manual_done,    EMERALD).grid(row=0, column=2, sticky="ew", padx=4)
        self._btn(ctrl, "✗ Mark Fail", self._manual_fail,    RED).grid(row=0, column=3, sticky="ew", padx=(4,0))

        # ── Log (right) ──
        right = tk.Frame(body, bg=BG)
        right.grid(row=1, column=1, sticky="nsew")
        right.rowconfigure(1, weight=1)
        right.columnconfigure(0, weight=1)

        log_head = tk.Frame(right, bg=BG)
        log_head.grid(row=0, column=0, sticky="ew", pady=(0, 8))
        tk.Label(log_head, text="Activity Log", font=("Helvetica", 12, "bold"),
                 bg=BG, fg=TEXT).pack(side="left")
        self._btn(log_head, "Clear", self._clear_log, MUTED, small=True).pack(side="right")

        self.log_box = scrolledtext.ScrolledText(
            right, bg=CARD, fg=TEXT, font=("Courier", 10),
            relief="flat", bd=0, insertbackground=TEXT,
            state="disabled", wrap="word",
            highlightbackground=BORDER, highlightthickness=1)
        self.log_box.grid(row=1, column=0, sticky="nsew")

        self.log_box.tag_config("ok",   foreground=EMERALD)
        self.log_box.tag_config("err",  foreground=RED)
        self.log_box.tag_config("info", foreground=VIOLET)
        self.log_box.tag_config("warn", foreground=GOLD)
        self.log_box.tag_config("dim",  foreground=MUTED)

        # ── Bottom bar ──
        tk.Frame(self, bg=BORDER, height=1).pack(fill="x")
        bot = tk.Frame(self, bg=BG2, pady=14, padx=20)
        bot.pack(fill="x")

        self.printer_lbl = tk.Label(bot, text=f"Printer: {self.printer_name}",
                                    font=("Helvetica", 11), bg=BG2, fg=MUTED)
        self.printer_lbl.pack(side="left", padx=20)
        tk.Label(bot, text=f"MAC: {MAC_ADDRESS}",
                 font=("Helvetica", 10), bg=BG2, fg=MUTED).pack(side="left")
        tk.Label(bot, text=f"API: {API_URL}",
                 font=("Helvetica", 10), bg=BG2, fg=MUTED).pack(side="right")

    def _btn(self, parent, text, cmd, color, small=False, big=False):
        size = 9 if small else (13 if big else 11)
        pad  = (4, 4) if small else (10, 8) if big else (8, 6)
        b = tk.Button(parent, text=text, command=cmd,
                      bg=BG2, fg=color,
                      activebackground=BORDER, activeforeground=color,
                      relief="flat", bd=0, cursor="hand2",
                      font=("Helvetica", size, "bold"),
                      padx=pad[0]*2, pady=pad[1])
        b.bind("<Enter>", lambda e: b.config(bg=BORDER))
        b.bind("<Leave>", lambda e: b.config(bg=BG2))
        return b

    # ── Logging ───────────────────────────────────────────────

    def log(self, msg, tag="dim"):
        ts = time.strftime("%H:%M:%S")
        self.log_box.configure(state="normal")
        self.log_box.insert("end", f"[{ts}] ", "dim")
        self.log_box.insert("end", msg + "\n", tag)
        self.log_box.configure(state="disabled")
        self.log_box.see("end")

    def _clear_log(self):
        self.log_box.configure(state="normal")
        self.log_box.delete("1.0", "end")
        self.log_box.configure(state="disabled")

    # ── Status helpers ────────────────────────────────────────

    def _set_online(self, online):
        self.connected = online
        if online:
            self.status_dot.config(fg=EMERALD)
            self.status_lbl.config(text="Online", fg=EMERALD)
        else:
            self.status_dot.config(fg=RED)
            self.status_lbl.config(text="Offline", fg=MUTED)

    # ── Bridge toggle ─────────────────────────────────────────

    def _toggle_bridge(self):
        if not self.running:
            if not self.printer_id:
                messagebox.showerror("Not registered",
                    "Auto-registration failed or still in progress.\nCheck the log and try again.")
                return
            self._start_bridge()
        else:
            self._stop_bridge()

    def _start_bridge(self):
        self.running = True
        self.start_btn.config(text="■  Stop Bridge", bg=BG2, fg=RED,
                              activebackground=BORDER, activeforeground=RED)
        self.start_btn.bind("<Enter>", lambda e: self.start_btn.config(bg=BORDER))
        self.start_btn.bind("<Leave>", lambda e: self.start_btn.config(bg=BG2))
        self.log("Bridge started.", "ok")

        schedule.clear()
        schedule.every(30).seconds.do(self._heartbeat)
        schedule.every(10).seconds.do(self._poll_queue)

        self._heartbeat()
        self._poll_queue()

        self._sched_thread = threading.Thread(target=self._sched_loop, daemon=True)
        self._sched_thread.start()

    def _stop_bridge(self):
        self.running = False
        schedule.clear()
        self._in_progress.clear()
        self._set_online(False)
        self.start_btn.config(text="▶  Start Bridge", bg=BG2, fg=EMERALD,
                              activebackground=BORDER, activeforeground=EMERALD)
        self.start_btn.bind("<Enter>", lambda e: self.start_btn.config(bg=BORDER))
        self.start_btn.bind("<Leave>", lambda e: self.start_btn.config(bg=BG2))
        self.log("Bridge stopped.", "warn")

    def _sched_loop(self):
        while self.running:
            schedule.run_pending()
            time.sleep(1)

    # ── Heartbeat ─────────────────────────────────────────────

    def _heartbeat(self):
        def run():
            headers = {"x-api-key": self.api_key}
            try:
                r = requests.post(
                    f"{API_URL}/api/printers/{self.printer_id}/heartbeat",
                    headers=headers, timeout=5)
                ok = r.status_code == 200
                self.after(0, self._set_online, ok)
                self.after(0, self.stat_vars["api_ping"].set, "OK" if ok else str(r.status_code))
                if not ok:
                    self.after(0, self.log, f"Heartbeat failed: {r.status_code}", "err")
            except Exception as e:
                self.after(0, self._set_online, False)
                self.after(0, self.stat_vars["api_ping"].set, "Error")
                self.after(0, self.log, f"Heartbeat error: {e}", "err")
        threading.Thread(target=run, daemon=True).start()

    # ── Poll queue ────────────────────────────────────────────

    def _poll_queue(self):
        def run():
            headers = {"x-api-key": self.api_key}
            try:
                r = requests.get(
                    f"{API_URL}/api/jobs/printer/{self.printer_id}",
                    headers=headers, timeout=10)
                if r.status_code != 200:
                    self.after(0, self.log, f"Poll failed: {r.status_code}", "err")
                    return

                jobs = r.json().get("jobs", [])
                self.jobs = jobs
                self.after(0, self._refresh_tree, jobs)

                active = [j for j in jobs if j["status"] in ("pending", "paid", "queued", "printing")]
                paid   = [j for j in jobs if j["status"] == "paid"]

                self.after(0, self.stat_vars["queued_count"].set, str(len(active)))

                # done/failed counts come from a separate stats endpoint since the
                # printer-jobs API only returns active statuses
                def fetch_stats():
                    try:
                        sr = requests.get(
                            f"{API_URL}/api/printers/{self.printer_id}/stats",
                            headers=headers, timeout=5)
                        if sr.status_code == 200:
                            sd = sr.json()
                            self.after(0, self.stat_vars["done_today"].set,   str(sd.get("done_today",   0)))
                            self.after(0, self.stat_vars["failed_today"].set, str(sd.get("failed_today", 0)))
                    except Exception:
                        pass  # stats are non-critical, fail silently
                threading.Thread(target=fetch_stats, daemon=True).start()

                new_paid = []
                with self._in_progress_lock:
                    for j in paid:
                        if j["id"] not in self._in_progress:
                            self._in_progress.add(j["id"])
                            new_paid.append(j)
                if new_paid:
                    self.after(0, self.log, f"Found {len(new_paid)} paid job(s) — processing…", "info")
                    for job in new_paid:
                        self.after(0, self._process_job, job)

            except Exception as e:
                self.after(0, self.log, f"Poll error: {e}", "err")
        threading.Thread(target=run, daemon=True).start()

    def _manual_refresh(self):
        self.log("Manual refresh…", "dim")
        self._poll_queue()

    # ── Tree view ─────────────────────────────────────────────

    STATUS_COLORS = {
        "pending":  MUTED, "paid": GOLD, "queued": VIOLET,
        "printing": CORAL, "done": EMERALD, "failed": RED,
    }
    STATUS_ICONS = {
        "pending": "⏳", "paid": "💰", "queued": "📋",
        "printing": "🖨", "done": "✅", "failed": "❌",
    }

    def _refresh_tree(self, jobs):
        for item in self.tree.get_children():
            self.tree.delete(item)

        sorted_jobs = sorted(jobs, key=lambda j: (
            not j.get("priority", False), j.get("created_at", "")
        ))

        for j in sorted_jobs:
            fname = j["file_name"]
            if len(fname) > 28: fname = fname[:25] + "…"
            if j.get("priority"): fname = "⚡ " + fname
            status = j["status"]
            icon   = self.STATUS_ICONS.get(status, "")
            pages  = f"{j['pages']}×{j['copies']}"
            cost   = f"₹{j['cost']}"
            self.tree.insert("", "end",
                iid=j["id"],
                values=(fname, pages, cost, f"{icon} {status.upper()}"),
                tags=(status,))
            self.tree.tag_configure(status, foreground=self.STATUS_COLORS.get(status, TEXT))

    # ── Process job ───────────────────────────────────────────

    def _process_job(self, job):
        def run():
            job_id = job["id"]
            fname  = job["file_name"]
            self.after(0, self.log, f"Processing: {fname}", "info")

            self._update_status(job_id, "queued")
            time.sleep(1)

            pdf_path = self._download_pdf(job_id)
            if not pdf_path:
                self._update_status(job_id, "failed")
                self._in_progress.discard(job_id)
                self.after(0, self.log, f"Download failed: {fname}", "err")
                return

            self._update_status(job_id, "printing")
            time.sleep(1)

            success = self._print_pdf(pdf_path, job)
            try: os.unlink(pdf_path)
            except Exception: pass

            final = "done" if success else "failed"
            self._update_status(job_id, final)
            self._in_progress.discard(job_id)
            self.after(0, self.log, f"{'✅ Done' if success else '❌ Failed'}: {fname}",
                       "ok" if success else "err")
            self.after(0, self._poll_queue)

        threading.Thread(target=run, daemon=True).start()

    def _download_pdf(self, job_id):
        headers = {"x-api-key": self.api_key}
        try:
            r = requests.get(f"{API_URL}/api/jobs/{job_id}/file",
                             headers=headers, timeout=30)
            if r.status_code == 200:
                tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
                tmp.write(r.content)
                tmp.close()
                return tmp.name
        except Exception as e:
            self.after(0, self.log, f"Download error: {e}", "err")
        return None

    def _print_pdf(self, file_path, job):
        try:
            copies = int(job.get("copies", 1))
            color  = job.get("color", False)
            duplex = job.get("double_sided", False)
            if platform.system() == "Windows":
                sumatra = r"C:\Program Files\SumatraPDF\SumatraPDF.exe"
                settings = f"{copies}x"
                if duplex: settings += ",duplexlong"
                if color:  settings += ",color"
                if os.path.exists(sumatra):
                    subprocess.run([sumatra, "-print-to-default",
                                    "-print-settings", settings, file_path],
                                   check=True, timeout=60)
                else:
                    try:
                        import win32api
                        # ShellExecute print verb ignores lpParameters for most handlers;
                        # prints to default printer, 1 copy. SumatraPDF is strongly preferred.
                        for _ in range(copies):
                            win32api.ShellExecute(0, "print", file_path, None, ".", 0)
                            time.sleep(2)  # brief gap between submissions
                    except ImportError:
                        # pywin32 not installed — fall back to ShellExecute via subprocess
                        for _ in range(copies):
                            subprocess.run(
                                ["rundll32.exe", "mshtml.dll,PrintHTML", file_path],
                                timeout=60
                            )
                            time.sleep(2)
            else:
                # macOS / Linux
                cmd = ["lp", "-n", str(copies)]
                if duplex: cmd += ["-o", "sides=two-sided-long-edge"]
                if color:  cmd += ["-o", "ColorModel=RGB"]
                cmd.append(file_path)
                result = subprocess.run(cmd, timeout=60)
                if result.returncode != 0:
                    raise RuntimeError(f"lp exited with code {result.returncode}")
            self.after(0, self.log,
                f"Sent to printer ({copies} cop{'y' if copies==1 else 'ies'})", "ok")
            return True
        except Exception as e:
            self.after(0, self.log, f"Print error: {e}", "err")
            return False

    def _update_status(self, job_id, status):
        headers = {"x-api-key": self.api_key}
        try:
            r = requests.patch(f"{API_URL}/api/jobs/{job_id}/status",
                               json={"status": status}, headers=headers, timeout=5)
            if r.status_code == 200:
                self.after(0, self.log, f"  → {status.upper()}", "dim")
            else:
                err_msg = r.json().get("error", r.text) if r.content else str(r.status_code)
                self.after(0, self.log, f"  Status update rejected ({r.status_code}): {err_msg}", "err")
        except Exception as e:
            self.after(0, self.log, f"Status update error: {e}", "err")

    # ── Manual controls ───────────────────────────────────────

    def _selected_job_id(self):
        sel = self.tree.selection()
        if not sel:
            messagebox.showinfo("No selection", "Select a job from the queue first.")
            return None
        return sel[0]

    def _manual_paid(self):
        job_id = self._selected_job_id()
        if not job_id: return
        job = next((j for j in self.jobs if j["id"] == job_id), None)
        if not job: return
        fname = job.get("file_name", job_id[:8])
        cost  = job.get("cost", "?")
        if messagebox.askyesno("Confirm Cash Payment", f"Mark ₹{cost} as PAID for:\n{fname}?\n\nThis will queue it for printing."):
            self._update_status(job_id, "paid")
            self.log(f"Cash payment confirmed: {fname} (₹{cost})", "ok")
            self.after(2000, self._poll_queue)

    def _manual_done(self):
        job_id = self._selected_job_id()
        if not job_id: return
        if messagebox.askyesno("Confirm", "Mark this job as DONE?"):
            self._update_status(job_id, "done")
            self.log(f"Manually marked done: {job_id[:8]}…", "ok")
            self.after(2000, self._poll_queue)

    def _manual_fail(self):
        job_id = self._selected_job_id()
        if not job_id: return
        if messagebox.askyesno("Confirm", "Mark this job as FAILED?"):
            self._update_status(job_id, "failed")
            self.log(f"Manually marked failed: {job_id[:8]}…", "err")
            self.after(2000, self._poll_queue)

    # ── Close ─────────────────────────────────────────────────

    def _on_close(self):
        if self.running:
            if not messagebox.askyesno("Quit", "Bridge is running. Stop and quit?"):
                return
        self.running = False
        schedule.clear()
        self.destroy()


if __name__ == "__main__":
    app = PrintBridgeApp()
    app.mainloop()