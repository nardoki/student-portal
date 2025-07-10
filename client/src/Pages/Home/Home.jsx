import appIcon from "../../assets/appIcon.svg";
// temporary home page for now
function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-lg bg-white rounded-lg shadow-md border border-slate-200 p-10 flex flex-col items-center">
        <img src={appIcon} alt="Student Portal" className="h-16 mb-6" />
        <h1 className="text-3xl font-bold text-indigo-700 mb-2 text-center">
          Welcome to the Student Portal
        </h1>
        <p className="text-slate-600 text-center mb-6">
          Access your courses, announcements, and resources all in one place.
        </p>
        <a
          href="/login"
          className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-md transition"
        >
          Get Started
        </a>
      </div>
    </div>
  );
}

export default Home;
