"use client";

import { useSearchParams } from "next/navigation";

export default function AuthCallbackNotice() {
  const searchParams = useSearchParams();

  if (searchParams.get("error") !== "auth_callback") {
    return null;
  }

  return (
    <p
      role="alert"
      className="mt-4 rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-700"
    >
      Không thể hoàn tất xác thực. Liên kết có thể đã hết hạn, đã được
      sử dụng hoặc quá trình đăng nhập bị hủy. Vui lòng thử đăng nhập
      lại. Nếu vừa đăng ký, hãy kiểm tra email xác nhận.
    </p>
  );
}
