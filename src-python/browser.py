"""Explicitly approved, navigation-only browser tools. No shell or workspace mutation tools."""
from __future__ import annotations
import argparse
import hashlib
import hmac
import ipaddress
import json
import os
from pathlib import Path
import socket
import stat
from datetime import datetime, timezone
from urllib.parse import urlsplit, urlencode, urljoin


class PolicyError(ValueError):
    pass


def public_url(url: str, domains: set[str], resolve=True) -> str:
    parsed = urlsplit(url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or parsed.username or parsed.password or parsed.port not in (None, 443):
        raise PolicyError("Only public HTTPS on port 443 is allowed.")
    if host not in domains or host in {"localhost", "localhost.localdomain"}:
        raise PolicyError("Host is outside the explicit domain allowlist.")
    try:
        addresses = [ipaddress.ip_address(host)]
    except ValueError:
        addresses = []
    if resolve:
        addresses += [ipaddress.ip_address(item[4][0]) for item in socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)]
    if any(not address.is_global for address in addresses):
        raise PolicyError("Private, reserved and loopback network targets are blocked.")
    if resolve and not addresses:
        raise PolicyError("No public target address.")
    return url


def safe_target(url: str) -> str:
    # No query, fragment, credentials, page contents or typed secrets in the audit.
    parsed = urlsplit(url)
    return f"{parsed.scheme}://{parsed.hostname or ''}"


def reject_link(path: Path):
    info = path.lstat()
    if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & 0x400:
        raise PolicyError("Audit paths must not be symlinks or Windows reparse points.")


class Audit:
    """HMAC chain; fails closed on corruption. Not an OS vault or deletion-proof log."""
    def __init__(self, workspace: Path, key: bytes):
        if len(key) < 32:
            raise PolicyError("AXION_AUDIT_KEY must contain at least 32 characters.")
        root = workspace.absolute()
        for parent in [root, *root.parents]:
            reject_link(parent)
        if not root.is_dir():
            raise PolicyError("Workspace must already exist.")
        self.directory = root / ".axion-browser"
        self.directory.mkdir(exist_ok=True)
        reject_link(self.directory)
        self.path = self.directory / "audit.jsonl"
        self.lock = self.directory / "session.lock"
        self.key = key
        self.fd = None

    def __enter__(self):
        self.fd = os.open(self.lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        try:
            self.append("session", "", "started")
        except BaseException:
            self.__exit__(None, None, None)
            raise
        return self

    def __exit__(self, *_):
        if self.fd is not None:
            os.close(self.fd)
            self.fd = None
            self.lock.unlink()

    def append(self, action: str, target: str, result: str):
        reject_link(self.directory)
        previous = "0" * 64
        if os.path.lexists(self.path):
            reject_link(self.path)
            if self.path.stat().st_size > 5_000_000:
                raise PolicyError("Audit reached 5 MB. Archive it explicitly before a new session.")
            with self.path.open(encoding="utf-8") as source:
                for line in source:
                    record = json.loads(line)
                    signature = record.pop("signature")
                    payload = json.dumps(record, sort_keys=True, separators=(",", ":")).encode()
                    expected = hmac.new(self.key, payload, hashlib.sha256).hexdigest()
                    if record["previous"] != previous or not hmac.compare_digest(signature, expected):
                        raise PolicyError("Audit verification failed; browser action denied.")
                    previous = signature
        record = {"time": datetime.now(timezone.utc).isoformat(), "action": action,
                  "target_origin": safe_target(target), "result": result,
                  "authorization": "interactive-terminal-user", "previous": previous}
        payload = json.dumps(record, sort_keys=True, separators=(",", ":")).encode()
        record["signature"] = hmac.new(self.key, payload, hashlib.sha256).hexdigest()
        with self.path.open("a", encoding="utf-8") as output:
            output.write(json.dumps(record, sort_keys=True) + "\n")
            output.flush()
            os.fsync(output.fileno())


class BrowserTools:
    """Trusted local caller supplies human approval; never expose this object to model code."""
    def __init__(self, page, context, domains: set[str], audit: Audit, approve):
        self.page, self.context, self.domains, self.audit, self.approve = page, context, domains, audit, approve
        context.route("**/*", self._route)
        context.route_web_socket("**/*", lambda ws: ws.close())
        page.on("dialog", lambda dialog: dialog.dismiss())
        page.on("popup", lambda popup: popup.close())
        page.on("download", lambda download: download.cancel())
        page.on("filechooser", lambda chooser: chooser.set_files([]))

    def _route(self, route):
        try:
            if route.request.method not in {"GET", "HEAD"}:
                raise PolicyError("Non-read network methods are blocked.")
            public_url(route.request.url, self.domains)
            route.continue_()
        except Exception:
            route.abort()

    def _action(self, name, url, operation):
        public_url(url, self.domains)
        if not self.approve(name, url):
            self.audit.append(name, url, "rejected")
            return "Rejected."
        self.audit.append(name, url, "approved-before-action")
        try:
            result = operation()
            public_url(self.page.url, self.domains)
        except Exception:
            self.audit.append(name, url, "failed")
            raise
        evidence = (f"observed-http-{result.get('http_status')}" if isinstance(result, dict)
                    else f"extracted-{len(result)}-characters")
        self.audit.append(name, self.page.url, evidence)
        return result

    def navigate(self, url):
        def operation():
            response = self.page.goto(url, wait_until="domcontentloaded", timeout=20000)
            return {"url": self.page.url, "http_status": response.status if response else None,
                    "title": self.page.title()[:200]}
        return self._action("navigate", url, operation)

    def search(self, query):
        if not query.strip() or len(query) > 500:
            raise PolicyError("Search query must be 1-500 characters.")
        return self.navigate("https://duckduckgo.com/?" + urlencode({"q": query}))

    def click(self, name):
        # Link navigation only. No arbitrary form submission, purchase or privileged app buttons.
        target = self.page.get_by_role("link", name=name, exact=True)
        if target.count() != 1 or not target.is_visible():
            raise PolicyError("Expected one visible, uniquely named link.")
        url = urljoin(self.page.url, target.get_attribute("href") or "")
        if not target.get_attribute("href"):
            raise PolicyError("Link has no navigable destination.")
        def operation():
            # Re-ground the target immediately before navigation. Navigate the reviewed href to
            # avoid executing arbitrary page click handlers or a changed destination.
            if urljoin(self.page.url, target.get_attribute("href") or "") != url:
                raise PolicyError("Target changed after review.")
            response = self.page.goto(url, wait_until="domcontentloaded", timeout=20000)
            return {"url": self.page.url, "http_status": response.status if response else None}
        return self._action("follow-grounded-link", url, operation)

    def extract(self):
        return self._action("extract-visible-text", self.page.url,
                            lambda: self.page.locator("body").inner_text(timeout=5000)[:12000])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--allow-domain", action="append", required=True)
    args = parser.parse_args()
    key = os.environ.get("AXION_AUDIT_KEY", "").encode()
    def approve(action, target):
        return input(f"{action}: {target}\nType APPLY to authorize this action: ").strip() == "APPLY"
    try:
        from playwright.sync_api import sync_playwright
        with Audit(args.workspace, key) as audit, sync_playwright() as driver:
            browser = driver.chromium.launch(channel="msedge", headless=False)
            try:
                context = browser.new_context(accept_downloads=False, service_workers="block", permissions=[])
                page = context.new_page()
                tools = BrowserTools(page, context, set(args.allow_domain), audit, approve)
                print("Isolated browser. Commands: open URL, search TERMS, click EXACT LINK NAME, extract, stop. Ctrl+C stops.")
                while True:
                    command = input("AXION browser> ").strip()
                    if command in {"stop", "exit"}:
                        break
                    action, _, value = command.partition(" ")
                    try:
                        if action == "open": result = tools.navigate(value)
                        elif action == "search": result = tools.search(value)
                        elif action == "click": result = tools.click(value)
                        elif action == "extract": result = tools.extract()
                        else: print("Unknown command."); continue
                        print(result)  # extracted page data is untrusted, never executable instruction
                    except Exception:
                        print("Action failed or was blocked. No success is claimed.")
            finally:
                browser.close()
    except KeyboardInterrupt:
        print("Browser stopped.")
    except Exception:
        print("Browser setup/audit failed. Check dependencies, workspace and AXION_AUDIT_KEY; secrets were not logged.")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
