import { Text } from '@react-email/components';
import { EmailLayout } from './EmailLayout.js';

export interface TaskDueReminderProps {
  assigneeName: string;
  taskTitle: string;
  dueDate: string;
  taskUrl: string;
}

export const taskDueReminderSubject = (title: string) => `Reminder: "${title}" is due soon`;
export const taskDueReminderPreheader = 'A task assigned to you is approaching its due date.';

export function TaskDueReminderEmail({ assigneeName, taskTitle, dueDate, taskUrl }: TaskDueReminderProps) {
  return (
    <EmailLayout preheader={taskDueReminderPreheader}>
      <Text>Hi {assigneeName},</Text>
      <Text>
        The task <strong>{taskTitle}</strong> is due on <strong>{dueDate}</strong>.
      </Text>
      <Text>
        <a href={taskUrl} style={{ color: '#18181b', textDecoration: 'underline' }}>
          View task in Skarion CRM
        </a>
      </Text>
    </EmailLayout>
  );
}
