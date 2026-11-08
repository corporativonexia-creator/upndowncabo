import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/require-role";
import StorefrontParity from "@/components/store/storefront-parity";
import "./preview-header.css";

export const metadata: Metadata = {
  title: "Vista previa privada · UP AND DOWN",
  robots: { index: false, follow: false },
};

export default async function StorefrontPreviewPage() {
  await requireRole("admin", "/vista-previa");
  return <StorefrontParity previewMode />;
}
