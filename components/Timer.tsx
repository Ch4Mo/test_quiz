export function Timer({ seconds, total, calm = false }: { seconds: number; total: number; calm?: boolean }) {
  const ratio = total > 0 ? Math.min(1, seconds / total) : 0;
  return (
    <div className={`timer ${!calm && seconds <= 5 ? "timer-urgent" : ""}`} style={{ ["--ratio" as string]: ratio }}>
      <span>{seconds}</span>
    </div>
  );
}
