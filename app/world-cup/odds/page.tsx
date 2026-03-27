import { redirect } from "next/navigation";

// Redirect to the main market alignment page which has the comprehensive
// comparison with disagrement analysis, market observations, and
// statistical significance testing. Avoids maintaining two overlapping
// market comparison views (UX-FEEDBACK N20).
export default function OddsPage() {
  redirect("/market-alignment");
}
