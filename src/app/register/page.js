import RegisterView from '@/components/RegisterView';
import { PageHead, Note } from '@/components/ui';
import { INCIDENT } from '@/lib/aegis/incident';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Audit register — AEGIS',
  description:
    'Append-only record of every AI recommendation, human approval, override and dispatch, with actor and timestamp.',
};

export default function RegisterPage() {
  return (
    <div className="space-y-5">
      <PageHead
        title="Audit register"
        standfirst="Append-only record of every recommendation and decision"
        fileNo={INCIDENT.fileNo}
      />

      <RegisterView />

      <Note tone="info" icon="scales">
        No personal data. Detections are counts, not identities; the only name recorded is the approving officer's. A deployment handling victim-level data needs role-based access, retention policy and a documented lawful basis.
      </Note>
    </div>
  );
}
