import { Text } from '@react-email/components';
import { EmailLayout } from './EmailLayout.js';

export interface LoginCodeEmailProps {
  code: string;
  expiresInMinutes: number;
}

export const loginCodeSubject = 'Your Skarion sign-in code';
export const loginCodePreheader = 'Use this code to finish signing in.';

export function LoginCodeEmail({ code, expiresInMinutes }: LoginCodeEmailProps) {
  return (
    <EmailLayout preheader={loginCodePreheader}>
      <Text>Enter this code to finish signing in to Skarion:</Text>
      <Text
        style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '6px', fontFamily: 'monospace' }}
      >
        {code}
      </Text>
      <Text style={{ fontSize: '13px', color: '#71717a' }}>
        This code expires in {expiresInMinutes} minutes. If you didn&apos;t try to sign in, you can
        safely ignore this email — no one can access your account without this code.
      </Text>
    </EmailLayout>
  );
}
