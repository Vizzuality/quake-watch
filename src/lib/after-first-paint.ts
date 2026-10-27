export function runAfterFirstPaint(task: () => void): () => void {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let frame = requestAnimationFrame(() => {
    frame = requestAnimationFrame(() => {
      timeout = setTimeout(task, 0);
    });
  });
  return () => {
    cancelAnimationFrame(frame);
    clearTimeout(timeout);
  };
}
