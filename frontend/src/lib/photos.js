function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export async function filesToPreviews(files) {
  const reads = files.map(
    (f) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve({ id: uid(), name: f.name, dataUrl: reader.result });
        reader.onerror = reject;
        reader.readAsDataURL(f);
      })
  );
  return Promise.all(reads);
}
