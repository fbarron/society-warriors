import { ForgotPasswordForm } from '@/components/forgot-password-form';

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] py-8">
      <h1 className="text-2xl font-bold mb-4">Forgot Password</h1>
      <ForgotPasswordForm />
    </div>
  );
}
