from pathlib import Path

page=Path('app/page.tsx')
s=page.read_text()
# Secondary users get operational modules automatically; admin-only modules stay hidden.
start=s.index('const defaultPermissions = (role: string) => {')
end=s.index('\n};', start)+3
new='''const defaultPermissions = (role: string) => {
  if (role.includes("Admin")) return [...NON_ACCOUNTING_MODULES];
  // Secondary users work operationally without managing master/configuration data.
  // Clinical history remains role-specific; Productos is available to sell.
  const operational = ["Resumen", "Pacientes", "Agenda", "Servicios", "Productos", "Caja y cobros"];
  if (role.includes("Médico")) return [...operational, "Historias clínicas"];
  return operational;
};'''
s=s[:start]+new+s[end:]
# Product save and restock are master/inventory administration; selling remains operational.
s=s.replace('''  const saveProduct = (product: Product) => {
    setProducts((current) =>''','''  const saveProduct = (product: Product) => {
    if (!isPrimary) { notify("Solo la administradora principal puede modificar productos."); return; }
    setProducts((current) =>''',1)
s=s.replace('''  const restockProduct = (
    product: Product,''','''  const restockProduct = (
    product: Product,''',1)
# inject guard in restock body using distinctive signature
needle='''    note: string,
  ) => {
    if (quantity < 1 || cost < 0) return;'''
if needle in s:
    s=s.replace(needle,'''    note: string,
  ) => {
    if (!isPrimary) { notify("Solo la administradora principal puede modificar el inventario."); return; }
    if (quantity < 1 || cost < 0) return;''',1)
# Hide product master actions for secondary users but preserve Vender.
s=s.replace('''                action={setProductAction}
              />''','''                action={setProductAction}
                adminMode={isPrimary}
              />''',1)
# Only primary admin gets New product header action.
s=s.replace('''    if (section === "Productos")
      return { label: "Nuevo producto", run: () => setProductAction({ kind: "new" }) };''','''    if (section === "Productos")
      return isPrimary ? { label: "Nuevo producto", run: () => setProductAction({ kind: "new" }) } : null;''',1)
page.write_text(s)

products=Path('app/products.tsx')
p=products.read_text()
old='''export function ProductsPanel({products,query,setQuery,filter,setFilter,action}:{products:Product[];query:string;setQuery:(v:string)=>void;filter:string;setFilter:(v:string)=>void;action:(v:Action)=>void})'''
new='''export function ProductsPanel({products,query,setQuery,filter,setFilter,action,adminMode=false}:{products:Product[];query:string;setQuery:(v:string)=>void;filter:string;setFilter:(v:string)=>void;action:(v:Action)=>void;adminMode?:boolean})'''
if old not in p: raise SystemExit('ProductsPanel signature not found')
p=p.replace(old,new,1)
old_actions='''<Button className="gold" disabled={!p.active||p.stock===0} onClick={()=>action({kind:"sell",product:p})}>Vender</Button><Button variant="outline" onClick={()=>action({kind:"edit",product:p})}>Editar</Button><button className="restock-link" onClick={()=>action({kind:"restock",product:p})}>+ Ingreso</button>'''
new_actions='''<Button className="gold" disabled={!p.active||p.stock===0} onClick={()=>action({kind:"sell",product:p})}>Vender</Button>{adminMode&&<><Button variant="outline" onClick={()=>action({kind:"edit",product:p})}>Editar</Button><button className="restock-link" onClick={()=>action({kind:"restock",product:p})}>+ Ingreso</button></>}'''
if old_actions not in p: raise SystemExit('Product actions not found')
p=p.replace(old_actions,new_actions,1)
products.write_text(p)
