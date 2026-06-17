import { BottomNav } from "@/components/shared/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto w-full">
      <main className="flex-1 pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}
