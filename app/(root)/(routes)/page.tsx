import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 text-foreground">
      <Image
        src="/images/logo-black.webp"
        alt="Techstersol"
        width={2001}
        height={395}
        priority
        className="h-auto w-full max-w-70 sm:max-w-90"
      />
      <div className="mt-8 h-0.75 w-16 rounded-full bg-linear-to-r from-chart-1 via-chart-3 to-chart-5" />
      <p className="mt-8 max-w-sm text-center text-base text-muted-foreground sm:text-lg">
        Technology solutions, built end to end.
      </p>
      <p className="mt-12 text-sm text-muted-foreground/70">
        Site launching soon.
      </p>
    </div>
  );
}
