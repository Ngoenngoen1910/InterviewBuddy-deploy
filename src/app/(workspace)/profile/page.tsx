"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";

type ProfileForm = {
  fieldOfStudy: string;
  targetPosition: string;
  experienceLevel: string;
  preferredLanguage: string;
};

type ProfileRow = {
  field_of_study: string | null;
  target_position: string | null;
  experience_level: string | null;
  preferred_language: string;
};

const emptyForm: ProfileForm = {
  fieldOfStudy: "",
  targetPosition: "",
  experienceLevel: "",
  preferredLanguage: "vi",
};

const experienceOptions = [
  { value: "student", label: "Sinh viên" },
  { value: "fresher", label: "Fresher / Mới tốt nghiệp" },
  { value: "junior", label: "Junior" },
  { value: "experienced", label: "Đã có kinh nghiệm" },
  { value: "career_changer", label: "Chuyển ngành" },
];

function toForm(profile: ProfileRow): ProfileForm {
  return {
    fieldOfStudy: profile.field_of_study ?? "",
    targetPosition: profile.target_position ?? "",
    experienceLevel: profile.experience_level ?? "",
    preferredLanguage: profile.preferred_language,
  };
}

export default function ProfilePage() {
  const router = useRouter();

  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [savedForm, setSavedForm] = useState<ProfileForm>(emptyForm);
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const supabase = createClient();

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (!active) return;

        if (authError) {
          setLoadError(
            "Không thể xác thực tài khoản. Vui lòng tải lại trang."
          );
          return;
        }

        if (!user) {
          router.replace("/login");
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select(
            "field_of_study, target_position, experience_level, preferred_language"
          )
          .eq("id", user.id)
          .maybeSingle();

        if (!active) return;

        if (error) {
          setLoadError(
            "Không thể tải hồ sơ. Vui lòng tải lại trang để thử lại."
          );
          return;
        }

        if (!data) {
          setLoadError(
            "Hồ sơ tài khoản chưa sẵn sàng. Vui lòng liên hệ nhóm quản trị."
          );
          return;
        }

        const values = toForm(data);

        setUserId(user.id);
        setEmail(user.email ?? "");
        setForm(values);
        setSavedForm(values);
      } catch {
        if (active) {
          setLoadError(
            "Không thể kết nối để tải hồ sơ. Vui lòng thử lại."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [router]);

  function updateField(field: keyof ProfileForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setMessage("");
    setSaveError("");
  }

  function cancelChanges() {
    setForm({ ...savedForm });
    setMessage("");
    setSaveError("");
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");
    setSaveError("");

    const fieldOfStudy = form.fieldOfStudy.trim();
    const targetPosition = form.targetPosition.trim();

    if (!fieldOfStudy || !targetPosition) {
      setSaveError("Vui lòng nhập ngành học và vị trí mục tiêu.");
      return;
    }

    if (
      !experienceOptions.some(
        (option) => option.value === form.experienceLevel
      ) ||
      !["vi", "en"].includes(form.preferredLanguage)
    ) {
      setSaveError("Vui lòng chọn mức kinh nghiệm và ngôn ngữ hợp lệ.");
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        setSaveError(
          "Không thể xác thực tài khoản. Thông tin đang nhập vẫn được giữ."
        );
        return;
      }

      if (!user) {
        setSaveError(
          "Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại trước khi lưu."
        );
        return;
      }

      if (user.id !== userId) {
        setSaveError(
          "Tài khoản đăng nhập đã thay đổi. Vui lòng tải lại trang."
        );
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .update({
          field_of_study: fieldOfStudy,
          target_position: targetPosition,
          experience_level: form.experienceLevel,
          preferred_language: form.preferredLanguage,
        })
        .eq("id", user.id)
        .select(
          "field_of_study, target_position, experience_level, preferred_language"
        )
        .single();

      if (error || !data) {
        setSaveError(
          "Chưa lưu được hồ sơ. Thông tin đang nhập vẫn được giữ, vui lòng thử lại."
        );
        return;
      }

      const values = toForm(data);

      setForm(values);
      setSavedForm(values);
      setMessage("Đã lưu hồ sơ của bạn.");
    } catch {
      setSaveError(
        "Không thể kết nối để lưu hồ sơ. Vui lòng thử lại."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <p role="status" className="text-sm text-slate-600">
          Đang tải hồ sơ…
        </p>
      </Card>
    );
  }

  if (loadError || !userId) {
    return (
      <Card>
        <h1 className="text-xl font-semibold">Hồ sơ cá nhân</h1>

        <p role="alert" className="mt-3 text-sm text-red-600">
          {loadError || "Đang chuyển đến trang đăng nhập…"}
        </p>

        {loadError && (
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            Tải lại trang
          </Button>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hồ sơ cá nhân</h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Cập nhật mục tiêu nghề nghiệp để nhận trải nghiệm phù hợp hơn.
        </p>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="min-w-0">
          <h2 className="text-lg font-semibold">Mục tiêu của bạn</h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Thông tin này giúp cá nhân hóa các phiên luyện tập.
          </p>

          <form onSubmit={handleSave} className="mt-6">
            <fieldset disabled={saving} className="min-w-0 space-y-5">
              <Input
                id="field-of-study"
                name="fieldOfStudy"
                label="Ngành học *"
                placeholder="Ví dụ: Kỹ thuật phần mềm"
                value={form.fieldOfStudy}
                onChange={(event) =>
                  updateField("fieldOfStudy", event.target.value)
                }
                maxLength={120}
                required
              />

              <Input
                id="profile-target-position"
                name="targetPosition"
                label="Vị trí mục tiêu *"
                placeholder="Ví dụ: Software Engineer Intern"
                value={form.targetPosition}
                onChange={(event) =>
                  updateField("targetPosition", event.target.value)
                }
                maxLength={120}
                required
              />

              <div className="space-y-1.5">
                <label
                  htmlFor="experience-level"
                  className="block text-sm font-medium text-slate-700"
                >
                  Mức kinh nghiệm *
                </label>

                <select
                  id="experience-level"
                  name="experienceLevel"
                  value={form.experienceLevel}
                  onChange={(event) =>
                    updateField("experienceLevel", event.target.value)
                  }
                  required
                  className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                >
                  <option value="">Chọn mức kinh nghiệm</option>

                  {experienceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="preferred-language"
                  className="block text-sm font-medium text-slate-700"
                >
                  Ngôn ngữ ưu tiên *
                </label>

                <select
                  id="preferred-language"
                  name="preferredLanguage"
                  value={form.preferredLanguage}
                  onChange={(event) =>
                    updateField("preferredLanguage", event.target.value)
                  }
                  required
                  className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                >
                  <option value="vi">Tiếng Việt</option>
                  <option value="en">English</option>
                </select>
              </div>

              <p className="text-xs leading-5 text-slate-500">
                Bạn có thể thay đổi những thông tin này bất cứ lúc nào.
              </p>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="submit">
                  {saving ? "Đang lưu…" : "Lưu thay đổi"}
                </Button>

                <Button
                  variant="secondary"
                  onClick={cancelChanges}
                >
                  Hủy thay đổi
                </Button>
              </div>
            </fieldset>

            {saveError && (
              <p role="alert" className="mt-4 text-sm leading-6 text-red-600">
                {saveError}
              </p>
            )}

            <p
              role="status"
              aria-live="polite"
              className="mt-4 text-sm text-green-700"
            >
              {message}
            </p>
          </form>
        </Card>

        <aside className="min-w-0 space-y-6">
          <Card>
            <h2 className="text-lg font-semibold">Tài khoản của bạn</h2>

            <p className="mt-3 break-words text-sm text-slate-600">
              {email}
            </p>

            <p className="mt-2 text-xs leading-5 text-slate-500">
              Hồ sơ được lưu cho tài khoản đang đăng nhập.
            </p>
          </Card>

          <Card className="border-indigo-100 bg-indigo-50">
            <h2 className="font-semibold text-indigo-900">
              Luyện tập theo mục tiêu
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Xác định vị trí và mức kinh nghiệm giúp bạn chuẩn bị
              những buổi luyện tập phù hợp hơn.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
