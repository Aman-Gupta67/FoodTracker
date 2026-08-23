import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center bg-white px-6 shadow-xl">
      <main className="flex flex-col items-center gap-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-500 text-2xl font-medium text-white">
          F
        </div>
        <h1 className="text-2xl font-medium text-stone-900">Food Tracker</h1>
        <LoginForm initialError={error} />
      </main>
    </div>
  );
}
