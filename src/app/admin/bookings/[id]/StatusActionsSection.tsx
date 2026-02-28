import { Button } from "@/components/ui/Button";

interface StatusActionsSectionProps {
  nextActions: { status: string; label: string }[];
  saving: boolean;
  onStatusChange: (newStatus: string) => void;
}

export function StatusActionsSection({
  nextActions,
  saving,
  onStatusChange,
}: StatusActionsSectionProps) {
  if (nextActions.length === 0) return null;

  return (
    <div className="bg-bg rounded-[--radius-md] border border-border-light p-4 shadow-sm space-y-2">
      <h3 className="text-sm font-semibold text-text-sub mb-3">다음 액션</h3>
      {nextActions.map((action) => {
        const isPrimary =
          action.status !== "cancelled" && action.status !== "rejected";
        return (
          <Button
            key={action.status}
            variant={isPrimary ? "primary" : "tertiary"}
            size="lg"
            fullWidth
            onClick={() => onStatusChange(action.status)}
            disabled={saving}
            className={
              !isPrimary
                ? "border border-semantic-red/30 text-semantic-red bg-semantic-red-tint hover:bg-semantic-red/10"
                : ""
            }
          >
            {action.label}
          </Button>
        );
      })}
    </div>
  );
}
