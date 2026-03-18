interface RobohashAvatarProps {
  seed: string;
  size?: number;
  className?: string;
}

export default function RobohashAvatar({ seed, size = 40, className = "" }: RobohashAvatarProps) {
  const url = `https://robohash.org/${encodeURIComponent(seed)}?size=${size * 2}x${size * 2}&set=set1`;

  return (
    <img
      src={url}
      alt="Player avatar"
      width={size}
      height={size}
      className={`rounded-full bg-muted ${className}`}
      loading="lazy"
      style={{ width: size, height: size, objectFit: 'cover' }}
    />
  );
}
