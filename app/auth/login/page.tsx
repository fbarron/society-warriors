import { LoginForm } from '@/components/login-form';

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] py-8">
      <h1 className="text-2xl font-bold mb-4">Login</h1>
      <LoginForm />
    </div>
  );
}
