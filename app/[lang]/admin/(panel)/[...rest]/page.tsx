import { notFound } from "next/navigation";

// Unknown backoffice URLs render the 404 page inside the backoffice layout.
export default function PanelCatchAll() {
  notFound();
}
