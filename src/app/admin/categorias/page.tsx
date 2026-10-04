import { requireRole } from "@/lib/auth/require-role";
import CategoryImagesAdmin from "@/components/admin/category-images-admin";

export default async function CategoryImagesPage() {
  await requireRole("admin", "/admin/categorias");
  return <CategoryImagesAdmin />;
}
