import { Text } from '@react-email/components';
import { EmailLayout } from './EmailLayout.js';

export interface OpportunityStageChangedProps {
  ownerName: string;
  opportunityName: string;
  oldStage: string;
  newStage: string;
  amount?: string;
  opportunityUrl: string;
}

export const opportunityStageChangedSubject = (name: string, stage: string) => `${name} moved to ${stage}`;
export const opportunityStageChangedPreheader = 'An opportunity stage has been updated in Skarion CRM.';

export function OpportunityStageChangedEmail({
  ownerName,
  opportunityName,
  oldStage,
  newStage,
  amount,
  opportunityUrl,
}: OpportunityStageChangedProps) {
  return (
    <EmailLayout preheader={opportunityStageChangedPreheader}>
      <Text>Hi {ownerName},</Text>
      <Text>
        The opportunity <strong>{opportunityName}</strong>
        {amount ? ` (${amount})` : ''} has moved from <strong>{oldStage}</strong> to{' '}
        <strong>{newStage}</strong>.
      </Text>
      <Text>
        <a href={opportunityUrl} style={{ color: '#18181b', textDecoration: 'underline' }}>
          View opportunity in Skarion CRM
        </a>
      </Text>
    </EmailLayout>
  );
}
