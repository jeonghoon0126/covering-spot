import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/TextArea";

interface AdminMemoSectionProps {
  adminMemoInput: string;
  setAdminMemoInput: (v: string) => void;
  saving: boolean;
  onSaveMemo: () => void;
}

export function AdminMemoSection({
  adminMemoInput,
  setAdminMemoInput,
  saving,
  onSaveMemo,
}: AdminMemoSectionProps) {
  return (
    <div className="bg-bg rounded-lg p-5 border border-border-light">
      <h3 className="text-sm font-semibold text-text-sub mb-3">
        관리자 메모
      </h3>
      <TextArea
        value={adminMemoInput}
        onChange={(e) => setAdminMemoInput(e.target.value)}
        placeholder="내부 메모 (고객에게 노출되지 않음)"
        rows={3}
      />
      <div className="mt-3">
        <Button
          variant="secondary"
          size="md"
          onClick={onSaveMemo}
          disabled={saving}
          loading={saving}
        >
          메모 저장
        </Button>
      </div>
    </div>
  );
}
