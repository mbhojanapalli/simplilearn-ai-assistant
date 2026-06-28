import { TopBar } from "@/components/site/TopBar";
import { LoginForm } from "@/components/admin/LoginForm";

export const metadata = {
  title: "Admin Sign in · Simplilearn AI Assistant",
};

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <LoginForm />
      </main>
    </div>
  );
}
