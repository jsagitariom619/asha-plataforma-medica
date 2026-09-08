from pathlib import Path

page = Path('app/page.tsx')
text = page.read_text()
needle = '''  return (\n    <Dialog open={!!type} onOpenChange={(o) => !o && !busy && close()}>\n      <DialogContent>'''
replacement = '''  return (\n    <Dialog open={!!type} onOpenChange={(o) => !o && !busy && close()}>\n      <DialogContent className={type === "user" ? "user-entry-dialog" : undefined}>'''
if needle not in text:
    raise SystemExit('Entry DialogContent pattern not found')
text = text.replace(needle, replacement, 1)
page.write_text(text)

css = Path('app/globals.css')
styles = css.read_text()
marker = '/* Compact ASHA user entry dialog */'
if marker not in styles:
    styles += r'''

/* Compact ASHA user entry dialog */
.user-entry-dialog{
  width:min(660px,calc(100vw - 28px))!important;
  max-width:660px!important;
  max-height:calc(100dvh - 28px)!important;
  overflow-y:auto!important;
  padding:18px!important;
  gap:10px!important;
  overscroll-behavior:contain;
}
.user-entry-dialog [data-slot="dialog-header"]{gap:4px!important;padding-right:22px}
.user-entry-dialog [data-slot="dialog-title"]{font-size:17px!important}
.user-entry-dialog [data-slot="dialog-description"]{font-size:11px!important;line-height:1.35}
.user-entry-dialog .form{gap:9px!important}
.user-entry-dialog .field{gap:4px!important}
.user-entry-dialog .field label{font-size:10px!important}
.user-entry-dialog .cols{gap:8px!important}
.user-entry-dialog input:not([type="checkbox"]){height:34px!important;min-height:34px!important;font-size:12px!important}
.user-entry-dialog .form select{height:34px!important;font-size:12px!important}
.user-entry-dialog .permissions-form{display:grid;gap:5px!important}
.user-entry-dialog .permissions-form>label{font-size:10px!important;margin:0!important}
.user-entry-dialog .permission-grid{
  display:grid!important;
  grid-template-columns:repeat(2,minmax(0,1fr))!important;
  gap:4px 10px!important;
}
.user-entry-dialog .permission-item{
  min-height:26px!important;
  padding:3px 5px!important;
  margin:0!important;
  gap:6px!important;
  font-size:11px!important;
  line-height:1.15!important;
}
.user-entry-dialog .permission-item input{width:14px!important;height:14px!important;flex:0 0 14px}
.user-entry-dialog .form-actions{
  position:sticky;
  bottom:-18px;
  z-index:2;
  margin:3px -18px -18px!important;
  padding:10px 18px 12px!important;
  background:linear-gradient(180deg,rgba(255,255,255,.9),#fff 28%);
  border-top:1px solid var(--border);
}
.user-entry-dialog .form-actions button{height:34px!important;font-size:12px!important}
@media(max-width:520px){
  .user-entry-dialog{width:calc(100vw - 18px)!important;max-height:calc(100dvh - 18px)!important;padding:14px!important}
  .user-entry-dialog .permission-grid{gap:3px 6px!important}
  .user-entry-dialog .permission-item{font-size:10px!important;padding:3px!important}
  .user-entry-dialog .form-actions{bottom:-14px;margin:3px -14px -14px!important;padding:9px 14px 10px!important}
}
'''
css.write_text(styles)
