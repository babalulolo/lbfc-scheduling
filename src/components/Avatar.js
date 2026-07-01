// Reusable avatar: shows the image if given, otherwise the person's initials.
export default function Avatar({ src, name, size = 36 }) {
  const initials = (name || '?')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={name || ''}
        style={{ width: size, height: size }}
        className="rounded-full object-cover flex-shrink-0 bg-gray-100"
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.4)) }}
      className="rounded-full bg-[#2d5016] text-white flex items-center justify-center flex-shrink-0 font-semibold"
    >
      {initials}
    </div>
  );
}
