import Image from "next/image";

type BrandLogoProps = {
  className?: string;
  compact?: boolean;
  priority?: boolean;
};

export function BrandLogo({
  className = "",
  compact = false,
  priority = false,
}: BrandLogoProps) {
  return (
    <span className={`brand-logo ${compact ? "brand-logo-compact" : ""} ${className}`.trim()}>
      <Image
        className="brand-logo-image"
        src="/brand/mynimto-logo.webp"
        alt=""
        aria-hidden="true"
        width={4096}
        height={4096}
        loading={priority ? undefined : "eager"}
        priority={priority}
        sizes="64px"
      />
      {!compact && <span className="brand-logo-word">myNimto</span>}
    </span>
  );
}
