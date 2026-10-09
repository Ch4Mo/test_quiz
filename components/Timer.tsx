export function Timer({ seconds, total }: { seconds: number; total: number }) {
  const ratio = total > 0 ? seconds / total : 0;
  return (
    <div className={`timer ${seconds <= 5 ? "timer-urgent" : ""}`} style={{ ["--ratio" as string]: ratio }}>
      <span>{seconds}</span>
    </div>
  );
}
