import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-[480px] flex-col overflow-hidden bg-gradient-to-b from-[#fff6ec] via-[#fef0e2] to-stone-50 shadow-xl">
      <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-primary-200/70 blur-md" />
      <div className="pointer-events-none absolute -left-36 top-44 h-72 w-72 rounded-full bg-primary-100/70 blur-md" />

      <div className="relative flex flex-1 flex-col items-center justify-center gap-4 px-7 pt-8">
        <div className="flex h-[76px] w-[76px] items-center justify-center rounded-3xl bg-gradient-to-br from-primary-400 to-primary-600 shadow-glow">
          <svg
            width="38"
            height="38"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 13a8 8 0 0 0 16 0Z" />
            <path d="M4 13h16" />
            <path d="M12 13V7" />
            <path d="M9 7c0-1.5.8-2.5 0-4" />
            <path d="M12.5 7c0-1.7 1-2.7 0-4.5" />
            <path d="M16 7c0-1.3.6-2.2 0-3.8" />
            <path d="M6 17.5C6 20 8.7 21 12 21s6-1 6-3.5" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-2xl font-extrabold tracking-tight text-stone-900">Food Tracker</p>
          <p className="mt-1.5 text-[14.5px] font-medium text-stone-500">
            Log Indian meals in seconds, not minutes.
          </p>
        </div>
      </div>

      <div className="relative rounded-t-[32px] bg-white p-6 pb-8 shadow-lg">
        <p className="mb-4 text-[15px] font-bold text-stone-900">
          Sign in with your mobile number
        </p>
        <LoginForm initialError={error} />
      </div>
    </div>
  );
}
