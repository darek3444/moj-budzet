// Znak Mój Budżet: portfel z fioletową monetą na ciemnym tle (ten sam rysunek co app/icon.svg)
export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Mój Budżet">
      <rect width="64" height="64" rx="16" fill="#0f172a" />
      <path d="M15 22c0-2.8 2.2-5 5-5h20.5a3 3 0 0 1 2.9 3.8L42.6 23" fill="none" stroke="#c4b5fd" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="13" y="22" width="38" height="27" rx="6" fill="#fff" />
      <rect x="37" y="30" width="16" height="11" rx="5.5" fill="#0f172a" />
      <circle cx="43.5" cy="35.5" r="3.2" fill="#8b5cf6" />
    </svg>
  );
}
