from pathlib import Path
import sys
import tempfile
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'src-python'))
from browser import BrowserTools,Audit,PolicyError
from playwright.sync_api import sync_playwright
with tempfile.TemporaryDirectory() as folder, Audit(Path(folder),b'test-only-key-never-production---') as audit, sync_playwright() as p:
 browser=p.chromium.launch(channel='msedge',headless=True)
 context=browser.new_context(accept_downloads=False,service_workers='block')
 page=context.new_page()
 tools=BrowserTools(page,context,{'example.com'},audit,lambda *_:True)
 # Deterministic public-host fixture, no requests reach the network.
 page.route('https://example.com/**',lambda route:route.fulfill(content_type='text/html',body='<html><title>AXION fixture</title><body>Visible test text<a href="https://example.com/next">Next page</a></body></html>'))
 with patch('browser.socket.getaddrinfo',return_value=[(0,0,0,'',('93.184.216.34',443))]):
  result=tools.navigate('https://example.com/');assert result['http_status']==200
  assert 'Visible test text' in tools.extract()
  assert tools.click('Next page')['url']=='https://example.com/next'
  try: tools.navigate('https://outside.example/')
  except PolicyError: pass
  else: raise AssertionError('Out-of-scope navigation executed')
 assert 'follow-grounded-link' in audit.path.read_text()
 browser.close()
 print('PASS: actual Edge navigation, extraction, grounded link following and audit against network-isolated fixtures.')
