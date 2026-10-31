import { ComingSoon } from "@/components/ui/ComingSoon";
import { BriefcaseIcon } from "@/components/ui/icons";

// Note: per APPROACH.md §8, the portfolio module is public-facing and will
// likely warrant its own marketing/showcase visual treatment later, rather
// than reusing the authenticated-app dashboard look. This placeholder keeps
// the shared glass-card style for now, consistent with every other module
// in this scaffolding pass.
export default function PortfolioPage() {
  return <ComingSoon label="Portfolio" icon={<BriefcaseIcon />} />;
}
