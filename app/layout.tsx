import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { AestheticHistoryCompat } from "@/components/aesthetic-history";
import { PatientProfileCompat } from "@/components/patient-profile";
import { PatientProductSalesCompat } from "@/components/patient-product-sales";
import { ClinicalRecordActionsCompat } from "@/components/clinical-record-actions";
import { ClinicalUiPunctualFixes } from "@/components/clinical-ui-punctual-fixes";
import { AppointmentReschedule } from "@/components/appointment-reschedule";
import { TestDataReset } from "@/components/test-data-reset";
import "./globals.css";
import "./users.css";
import "./auth.css";
import "./session-menu-fix.css";
import "./aesthetic-history.css";
import "./patient-profile.css";
import "./clinical-record-actions.css";
import "./clinical-ui-punctual-fixes.css";
import "./responsive-harmony.css";
import "./test-data-reset.css";
const manrope = Manrope({ subsets: ["latin"], variable: "--font-body" });
export const metadata: Metadata = {
  title: "ASHA | Gestión Médica",
  description: "Gestión clínica y financiera de ASHA Integrative Medicine",
  manifest: "/manifest.webmanifest?v=3",
  applicationName: "ASHA Integrative Medicine",
  themeColor: "#F5EEE6",
  icons: {
    icon: [
      { url: "/favicon.svg?v=3", type: "image/svg+xml" },
      { url: "/asha-icon-192.svg?v=3", sizes: "192x192", type: "image/svg+xml" },
      { url: "/asha-icon-512.svg?v=3", sizes: "512x512", type: "image/svg+xml" }
    ],
    shortcut: "/asha-icon-192.svg?v=3",
    apple: "/asha-icon-192.svg?v=3",
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
        <PatientProductSalesCompat />
        <AestheticHistoryCompat />
        <AppointmentReschedule />
        <TestDataReset />
        {children}
      </body>
    </html>
  );
}
