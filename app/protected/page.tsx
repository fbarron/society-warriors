export default function ProtectedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] py-8">
      <h1 className="text-3xl font-bold mb-4">Welcome to the Protected Page!</h1>
      <p className="text-lg">You are successfully logged in.</p>
    </div>
  );
}
