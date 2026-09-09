import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { AestheticHistoryCompat } from "@/components/aesthetic-history";
import { PatientProfileCompat } from "@/components/patient-profile";
import { ClinicalRecordActionsCompat } from "@/components/clinical-record-actions";
import { ClinicalUiPunctualFixes } from "@/components/clinical-ui-punctual-fixes";
import { AppointmentReschedule } from "@/components/appointment-reschedule";
import "./globals.css";
import "./users.css";
import "./auth.css";
import "./session-menu-fix.css";
import "./aesthetic-history.css";
import "./patient-profile.css";
import "./clinical-record-actions.css";
import "./clinical-ui-punctual-fixes.css";
import "./responsive-harmony.css";
const manrope = Manrope({ subsets: ["latin"], variable: "--font-body" });
export const metadata: Metadata = {
  title: "ASHA | Gestión Médica",
  description: "Gestión clínica y financiera de ASHA Integrative Medicine",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={manrope.variable}>
        <ClinicalRecordActionsCompat />
        <ClinicalUiPunctualFixes />
        <PatientProfileCompat />
        <AestheticHistoryCompat />
        <AppointmentReschedule />
        {children}
      </body>
    </html>
  );
}
