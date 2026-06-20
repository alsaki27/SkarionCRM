import { Text } from '@react-email/components';
import { EmailLayout } from './EmailLayout.js';

export interface LeadAssignedProps {
  assigneeName: string;
  leadName: string;
  leadEmail: string;
  source: string;
  leadUrl: string;
}

export const leadAssignedSubject = (name: string) => `New lead assigned: ${name}`;
export const leadAssignedPreheader = 'A new lead has been assigned to you in Skarion CRM.';

export function LeadAssignedEmail({ assigneeName, leadName, leadEmail, source, leadUrl }: LeadAssignedProps) {
  return (
    <EmailLayout preheader={leadAssignedPreheader}>
      <Text>Hi {assigneeName},</Text>
      <Text>
        A new lead <strong>{leadName}</strong> ({leadEmail}) from <strong>{source}</strong> has been assigned to you.
      </Text>
      <Text>
        <a href={leadUrl} style={{ color: '#18181b', textDecoration: 'underline' }}>
          View lead in Skarion CRM
        </a>
      </Text>
    </EmailLayout>
  );
}
