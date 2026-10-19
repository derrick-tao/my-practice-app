// Hand a backup file to the grown-up: through the share sheet when the browser can share a file (iOS:
// Save to Files, AirDrop), otherwise as a download.

export type SaveResult = 'saved' | 'cancelled';

function download(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser a moment to start reading the blob before releasing it.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * 'saved' once the file went to the share sheet or the download started; 'cancelled' when the grown-up
 * closed the share sheet without choosing anything (nothing was backed up). A share sheet that fails
 * for any other reason falls back to a download.
 */
export async function saveBackupFile(fileName: string, text: string): Promise<SaveResult> {
  const file = new File([text], fileName, { type: 'application/json' });
  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return 'saved';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // Not shareable after all: fall through to the download.
    }
  }
  download(file);
  return 'saved';
}
