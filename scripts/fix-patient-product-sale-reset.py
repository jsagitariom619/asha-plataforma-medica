from pathlib import Path

path = Path('components/patient-product-sales.tsx')
text = path.read_text(encoding='utf-8')

old_action = 'const action=createPortal(<button type="button" className="patient-treatment" onClick={()=>{setError("");setOpen(true)}}><ShoppingCart/>Vender producto</button>,footer);'
new_action = 'const action=createPortal(<button type="button" className="patient-treatment" onClick={()=>{setError("");setLines([{productId:0,quantity:1}]);setOpen(true)}}><ShoppingCart/>Vender producto</button>,footer);'
if old_action not in text:
    raise SystemExit('No se encontró el botón Vender producto esperado.')
text = text.replace(old_action, new_action, 1)

old_dialog = '<Dialog open={open} onOpenChange={setOpen}>'
new_dialog = '<Dialog open={open} onOpenChange={(next)=>{setOpen(next);if(!next){setLines([{productId:0,quantity:1}]);setError("")}}}>'
if old_dialog not in text:
    raise SystemExit('No se encontró el modal de venta esperado.')
text = text.replace(old_dialog, new_dialog, 1)

path.write_text(text, encoding='utf-8')
