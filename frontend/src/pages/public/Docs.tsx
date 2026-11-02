import { DocsContent } from '../../components/DocsContent';
import { MarketingButton, PublicPage } from '../../components/PublicLayout';

export function Docs() {
  return (
    <PublicPage
      eyebrow="Documentation"
      title="Everything the platform does, and what it does not do yet"
      lede="Reference for accounts, project submissions, deployments, statuses, limits and the API surface the KOVA frontend consumes."
      actions={<MarketingButton to="/contact" variant="secondary">Ask a question</MarketingButton>}
    >
      <div style={{ paddingBottom: 80 }}>
        <DocsContent />
      </div>
    </PublicPage>
  );
}
