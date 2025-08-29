interface Props {
  active: boolean;
  current: number;
  total: number;
  label?: string;
}

export default function TopProgressBar({
  active,
  current,
  total,
  label,
}: Props) {
  if (!active || total <= 0) return null;
  const percent = Math.min(100, Math.round((current / total) * 100));
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "8px",
        background: "var(--color-gray-200)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: `${percent}%`,
          background:
            "linear-gradient(90deg, #93c5fd 0%, #3b82f6 50%, #2563eb 100%)",
          transition: "width 150ms ease",
        }}
      />
      {label && (
        <div
          style={{
            position: "absolute",
            top: "-22px",
            left: "0",
            right: "0",
            textAlign: "center",
            fontSize: "12px",
            color: "var(--text-secondary)",
          }}
        >
          {label} — {percent}%
        </div>
      )}
    </div>
  );
}
