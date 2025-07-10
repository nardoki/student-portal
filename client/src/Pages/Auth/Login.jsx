import { useState } from "react";
// import { useNavigate } from "react-router-dom";
import { loginSchema } from "../../Utils/validators";
// import { login } from "../../services/auth";
import Input from "./../../Components/Common/UI/Input";
import Button from "./../../Components/Common/UI/Button";

export default function Login() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  // const navigate = useNavigate();

  const validateForm = () => {
    const { error } = loginSchema.validate(formData, { abortEarly: false });
    if (!error) return true;
    const newErrors = {};
    error.details.forEach((err) => {
      newErrors[err.path[0]] = err.message;
    });
    setErrors(newErrors);
    return false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsLoading(true);
    // try {
    //   const user = await login(formData);
    //   // Redirect based on role
    //   navigate(user.role === "teacher" ? "/teacher" : "/student");
    // } catch (err) {
    //   setErrors({ form: err.message || "Login failed" });
    // } finally {
    //   setIsLoading(false);
    // }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md border border-slate-200 p-8">
        <h2 className="text-2xl font-bold mb-6 text-indigo-700 text-center">
          Login
        </h2>
        {errors.form && (
          <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
            {errors.form}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            error={errors.email}
            autoComplete="username"
          />
          <Input
            label="Password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            error={errors.password}
            autoComplete="current-password"
          />
          <Button
            type="submit"
            loading={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-md transition"
          >
            Sign In
          </Button>
        </form>
        <div className="mt-6 text-center">
          <span className="text-slate-500">Don't have an account? </span>
          <a
            href="/signup"
            className="text-green-600 hover:text-green-700 font-medium hover:underline"
          >
            Sign Up
          </a>
        </div>
      </div>
    </div>
  );
}
