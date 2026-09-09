from pathlib import Path

path = Path('app/page.tsx')
text = path.read_text()

old_import = '  Bell,\n  CalendarDays,'
new_import = '  Bell,\n  RefreshCw,\n  CalendarDays,'
if old_import not in text:
    raise SystemExit('Import anchor not found')
text = text.replace(old_import, new_import, 1)

old_header = '''          <div className="head-actions">\n            <div className="notifications-wrap" ref={notificationRef}>'''
new_header = '''          <div className="head-actions">\n            <button\n              aria-label="Actualizar página"\n              title="Actualizar página"\n              className="bell"\n              type="button"\n              onClick={() => window.location.reload()}\n            >\n              <RefreshCw />\n            </button>\n            <div className="notifications-wrap" ref={notificationRef}>'''
if old_header not in text:
    raise SystemExit('Header anchor not found')
text = text.replace(old_header, new_header, 1)

path.write_text(text)
print('refresh button added')
