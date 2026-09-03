import { useForm } from "react-hook-form";
import clsx from "clsx";
import { useChangePasswordMutation } from "../store/authApi";

interface FormData {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

const inputClasses = (hasError: boolean) =>
  clsx(
    "rounded-md border px-2.5 py-2 text-base dark:border-gray-700",
    hasError ? "border-red-500 dark:border-red-500" : "border-gray-300",
  );

/**
 * Once submitted successfully, the `changePassword` mutation invalidates
 * the `me` query's "Session" tag, so whoever renders this (AccountPage)
 * refetches `me`, sees `mustChangePassword: false`, and swaps this form
 * out on its own — no local "done" state or navigation needed here.
 */
function ChangePasswordForm() {
  const [changePassword, { isLoading }] = useChangePasswordMutation();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isValid },
  } = useForm<FormData>({ mode: "onChange" });

  const onSubmit = async (data: FormData) => {
    try {
      await changePassword(data).unwrap();
    } catch {
      setError("root", { message: "Current password is incorrect" });
    }
  };

  return (
    <form
      className="flex flex-col items-stretch gap-4 rounded-xl border border-gray-400 p-5 text-left"
      onSubmit={handleSubmit(onSubmit)}
    >
      <p className="text-sm">This is your first time logging in — please set a new password.</p>

      <div className="flex flex-col gap-1">
        <label htmlFor="currentPassword" className="text-sm font-semibold">
          Current password
        </label>
        <input
          id="currentPassword"
          type="password"
          {...register("currentPassword", { required: "Required" })}
          className={inputClasses(!!errors.currentPassword)}
        />
        {errors.currentPassword && (
          <span className="text-sm text-red-600 dark:text-red-400">
            {errors.currentPassword.message}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="newPassword" className="text-sm font-semibold">
          New password
        </label>
        <input
          id="newPassword"
          type="password"
          {...register("newPassword", {
            required: "Required",
            minLength: { value: 8, message: "At least 8 characters" },
          })}
          className={inputClasses(!!errors.newPassword)}
        />
        {errors.newPassword && (
          <span className="text-sm text-red-600 dark:text-red-400">
            {errors.newPassword.message}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="confirmNewPassword" className="text-sm font-semibold">
          Confirm new password
        </label>
        <input
          id="confirmNewPassword"
          type="password"
          {...register("confirmNewPassword", {
            required: "Required",
            validate: (value, formValues) =>
              value === formValues.newPassword || "Passwords don't match",
          })}
          className={inputClasses(!!errors.confirmNewPassword)}
        />
        {errors.confirmNewPassword && (
          <span className="text-sm text-red-600 dark:text-red-400">
            {errors.confirmNewPassword.message}
          </span>
        )}
      </div>

      {errors.root && (
        <span className="text-sm text-red-600 dark:text-red-400">{errors.root.message}</span>
      )}

      <button
        type="submit"
        disabled={!isValid || isLoading}
        className="cursor-pointer self-start rounded-md border border-gray-700 px-4 py-2 text-base hover:bg-gray-100 disabled:opacity-50 dark:border-gray-300 dark:hover:bg-gray-800"
      >
        Set password
      </button>
    </form>
  );
}

export default ChangePasswordForm;
