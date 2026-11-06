import { redirect } from "next/navigation";

/** The old Docs page is now "How it works". */
export default function DocsPage() {
  redirect("/how");
}
