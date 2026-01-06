export default function Page({ children, className = "" }) {
  return (
    <div className={`min-h-screen bg-[#0C0F1D] ${className}`}>
      {children}
    </div>
  );
}