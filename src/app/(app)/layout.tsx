import { BottomTabBar } from "@/components/nav/bottom-tab-bar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-white pb-16 shadow-xl sm:my-0">
      {children}
      <BottomTabBar />
    </div>
  );
}
