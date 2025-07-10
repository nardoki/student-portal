import { useState } from "react";
// import { useNavigate } from "react-router-dom";
import { registerSchema } from "./../../Utils/validators";
// import { register } from "../../services/auth";
import Input from "./../../Components/Common/UI/Input";
import Button from "./../../Components/Common/UI/Button";

export default function Signup() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "student",
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  // const navigate = useNavigate();

  const validateForm = () => {
    const { error } = registerSchema.validate(formData, { abortEarly: false });
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
    //   await register(formData);
    //   navigate("/login?registered=true");
    // } catch (err) {
    //   setErrors({ form: err.message || "Registration failed" });
    // } finally {
    //   setIsLoading(false);
    // }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md border border-slate-200 p-8">
        <h2 className="text-2xl font-bold mb-6 text-indigo-700 text-center">
          Create Account
        </h2>
        {errors.form && (
          <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
            {errors.form}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            error={errors.fullName}
          />
          <Input
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            error={errors.email}
          />
          <Input
            label="Password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            error={errors.password}
          />
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-800">
              Account Type
            </label>
            <div className="flex space-x-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="role"
                  value="student"
                  checked={formData.role === "student"}
                  onChange={handleChange}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-600"
                />
                <span className="ml-2 text-slate-600">Student</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="role"
                  value="teacher"
                  checked={formData.role === "teacher"}
                  onChange={handleChange}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-600"
                />
                <span className="ml-2 text-slate-600">Teacher</span>
              </label>
            </div>
            {errors.role && (
              <p className="text-red-600 text-sm">{errors.role}</p>
            )}
          </div>
          <Button
            type="submit"
            loading={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-md transition"
          >
            Create Account
          </Button>
        </form>
        <div className="mt-6 text-center">
          <span className="text-slate-500">Already have an account? </span>
          <a
            href="/login"
            className="text-green-600 hover:text-green-700 font-medium hover:underline"
          >
            Login
          </a>
        </div>
      </div>
    </div>
  );
}
