import { daysUntil } from "@/lib/utils";

interface CountdownBannerProps {
  coupleName1: string;
  coupleName2: string;
  weddingDate: string | null;
  ceremonyVenue: string | null;
}

export function CountdownBanner({ coupleName1, coupleName2, weddingDate, ceremonyVenue }: CountdownBannerProps) {
  const days = weddingDate ? daysUntil(weddingDate) : null;

  return (
    <div className="bg-accent px-5 py-5">
      <p className="text-accent-fg/80 text-[10px] uppercase tracking-widest">
        {coupleName1} &amp; {coupleName2}
      </p>
      <p className="text-accent-fg font-display text-2xl mt-1">
        {days !== null
          ? days > 0
            ? `${days} days to go 🤍`
            : days === 0
            ? "Today&apos;s the day! 🎉"
            : "Congratulations! 🎊"
          : "Set your wedding date"}
      </p>
      {ceremonyVenue && (
        <p className="text-accent-fg/70 text-xs mt-0.5">{ceremonyVenue}</p>
      )}
    </div>
  );
}
