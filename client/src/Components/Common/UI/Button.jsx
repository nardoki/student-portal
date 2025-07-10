const Button = ({ children, loading, ...props }) => {
  return (
    <button
      className={`w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition ${
        loading ? "opacity-75" : ""
      }`}
      disabled={loading}
      {...props}
    >
      {loading ? "Processing..." : children}
    </button>
  );
};

export default Button;
