import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { LocalAuthCompat } from "@/components/local-auth-compat";
import "./globals.css";
import "./users.css";
import "./auth.css";
import "./session-menu-fix.css";
const manrope=Manrope({subsets:["latin"],variable:"--font-body"});
export const metadata:Metadata={title:"ASHA | Gestión Médica",description:"Gestión clínica y financiera de ASHA Integrative Medicine"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body className={manrope.variable}><LocalAuthCompat/>{children}</body></html>}