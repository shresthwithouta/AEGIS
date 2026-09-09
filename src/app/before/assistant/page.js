import Assistant from '@/components/Assistant';
import { PageHead, Note } from '@/components/ui';
import { SUGGESTED } from '@/lib/aegis/retrieval';
import { DOCUMENTS, CORPUS_NOTE } from '@/lib/aegis/corpus';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Doctrine assistant — AEGIS',
  description:
    'Grounded answers on Indian disaster-management doctrine — DM Act 2005, NDMA guidelines, NDMP, IRS, relief norms and the Drone Rules 2021 — with citations.',
};

export default function AssistantPage() {
  const documents = DOCUMENTS.map((d) => ({
    id: d.id,
    title: d.title,
    authority: d.authority,
    year: d.year,
    sourceRef: d.sourceRef,
  }));

  return (
    <div className="space-y-5">
      <PageHead
        title="Doctrine assistant"
        standfirst="Grounded reference over indexed disaster-management doctrine"
        fileNo="Preparedness desk"
      />

      <Assistant suggested={SUGGESTED} corpusNote={CORPUS_NOTE} documents={documents} />

      <Note tone="info" icon="scales">
        Every answer names its source document so an officer can go and read the authoritative text. That is the design:
        the assistant is a way into the doctrine, not a replacement for it, and nothing here overrides the District
        Disaster Management Plan in force.
      </Note>
    </div>
  );
}
