
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

export default function UIDemoPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-bold">InterviewBuddy UI</h1>
          <p className="mt-2 text-sm text-slate-600">
            Kiểm tra các thành phần giao diện dùng chung.
          </p>
        </div>

        <Card>
          <h2 className="mb-5 text-lg font-semibold">
            Thông tin đăng nhập
          </h2>

          <div className="space-y-4">
            <Input
              id="email"
              label="Email"
              type="email"
              placeholder="ban@example.com"
              autoComplete="email"
            />

            <Input
              id="password"
              label="Mật khẩu"
              type="password"
              placeholder="Nhập mật khẩu"
              autoComplete="current-password"
            />

            <Input
              id="error-example"
              label="Ví dụ trạng thái lỗi"
              error="Vui lòng kiểm tra thông tin đã nhập."
            />

            <div className="flex flex-wrap gap-3">
              <Button>Nút chính</Button>
              <Button variant="secondary">Nút phụ</Button>
              <Button disabled>Đang xử lý...</Button>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
