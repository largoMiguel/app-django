import logoUrl from "@/assets/logo_softone360.png";

interface ShowcaseLogoProps {
  size?: number;
  className?: string;
}

export default function ShowcaseLogo({ size = 36, className = "" }: ShowcaseLogoProps) {
  return (
    <img
      src={logoUrl}
      alt="SoftOne360"
      width={size}
      height={size}
      className={`sc-logo ${className}`.trim()}
      loading="eager"
      decoding="async"
    />
  );
}
