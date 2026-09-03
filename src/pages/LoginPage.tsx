import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { useLoginMutation } from "../store/authApi";

interface FormData {
  email: string;
  password: string;
}

const inputClasses = (hasError: boolean) =>
  clsx(
    "rounded-md border px-2.5 py-2 text-base dark:border-gray-700",
    hasError ? "border-red-500 dark:border-red-500" : "border-gray-300",
  );

function LoginPage() {
  const navigate = useNavigate();
  const [login, { isLoading }] = useLoginMutation();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isValid },
  } = useForm<FormData>({ mode: "onChange" });

  const onSubmit = async (data: FormData) => {
    try {
      await login(data).unwrap();
      navigate("/account");
    } catch {
      setError("root", { message: "Incorrect email or password" });
    }
  };

  return (
    <div className="mt-8 flex rounded-xl border border-gray-400 p-5">
      <form
        className="flex w-full flex-col items-stretch gap-4 text-left"
        onSubmit={handleSubmit(onSubmit)}
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-semibold">
            Email
          </label>
          <input
            id="email"
            type="email"
            placeholder="name@example.com"
            {...register("email", { required: "Email is required" })}
            className={inputClasses(!!errors.email)}
          />
          {errors.email && (
            <span className="text-sm text-red-600 dark:text-red-400">{errors.email.message}</span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm font-semibold">
            Password
          </label>
          <input
            id="password"
            type="password"
            {...register("password", { required: "Password is required" })}
            className={inputClasses(!!errors.password)}
          />
          {errors.password && (
            <span className="text-sm text-red-600 dark:text-red-400">
              {errors.password.message}
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
          Log in
        </button>
      </form>
    </div>
  );
}

export default LoginPage;
