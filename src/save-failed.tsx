/**
 * The "Couldn't save" alert. With `onRetry` it is one big button that tries again; without, it is a
 * message for screens whose own button (Done, Save) is the retry.
 */
export function SaveFailed({ onRetry }: { onRetry?: () => void }) {
  return (
    <div role="alert" class="save-failed">
      {onRetry ? (
        <button type="button" class="btn btn--primary btn--danger" onClick={onRetry}>
          <span aria-hidden="true">⚠️ </span>Couldn't save — tap to retry
        </button>
      ) : (
        <span>
          <span aria-hidden="true">⚠️ </span>Couldn't save — please try again
        </span>
      )}
    </div>
  );
}
