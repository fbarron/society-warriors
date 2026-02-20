import { SignUpForm } from '@/components/sign-up-form';

export default function SignUpPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] py-8">
      <h1 className="text-2xl font-bold mb-4">Sign Up</h1>
      <SignUpForm />
    </div>
  );
}
