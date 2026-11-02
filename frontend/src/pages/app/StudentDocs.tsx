import { PageHead } from '../../components/AppLayout';
import { DocsContent } from '../../components/DocsContent';
import { InfoBanner } from '../../components/ui';

export function StudentDocs() {
  return (
    <div className="stack gap-4 fade-in">
      <PageHead
        eyebrow="Documentation"
        title="Working with KOVA"
        description="Everything you can do in the workspace today, and what is still pending."
      />
      <InfoBanner tone="info" icon="info" title="Stage 1">
        KOVA validates submissions and queues deployment requests. Build execution and public URLs arrive with the
        provider integration.
      </InfoBanner>
      <DocsContent />
    </div>
  );
}
