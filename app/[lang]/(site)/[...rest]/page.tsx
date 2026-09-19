import { notFound } from "next/navigation";

// Unknown public URLs render the site's 404 page inside the site layout.
export default function CatchAll() {
  notFound();
}
