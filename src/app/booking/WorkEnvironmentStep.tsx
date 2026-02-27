"use client";

interface WorkEnvironmentStepProps {
  hasElevator: boolean | null;
  setHasElevator: (v: boolean) => void;
  hasParking: boolean | null;
  setHasParking: (v: boolean) => void;
  hasGroundAccess: boolean | null;
  setHasGroundAccess: (v: boolean) => void;
}

export function WorkEnvironmentStep({
  hasElevator,
  setHasElevator,
  hasParking,
  setHasParking,
  hasGroundAccess,
  setHasGroundAccess,
}: WorkEnvironmentStepProps) {
  return (
    <div className="bg-bg rounded-lg shadow-md border border-border-light p-7 max-sm:p-5 space-y-8">
      <p className="text-sm text-text-sub">작업 환경을 알려주세요</p>
      <div>
        <p className="font-semibold mb-4">엘리베이터</p>
        <div className="flex gap-3">
          <button
            onClick={() => setHasElevator(true)}
            className={`flex-1 py-3.5 rounded-md text-sm font-medium transition-all duration-200 active:scale-[0.97] ${
              hasElevator === true
                ? "bg-primary text-white shadow-[0_4px_12px_rgba(26,163,255,0.3)]"
                : "bg-bg-warm hover:bg-primary-bg hover:-translate-y-0.5"
            }`}
          >
            사용 가능
          </button>
          <button
            onClick={() => setHasElevator(false)}
            className={`flex-1 py-3.5 rounded-md text-sm font-medium transition-all duration-200 active:scale-[0.97] ${
              hasElevator === false
                ? "bg-primary text-white shadow-[0_4px_12px_rgba(26,163,255,0.3)]"
                : "bg-bg-warm hover:bg-primary-bg hover:-translate-y-0.5"
            }`}
          >
            사용 불가
          </button>
        </div>
      </div>
      <div>
        <p className="font-semibold mb-4">주차</p>
        <div className="flex gap-3">
          <button
            onClick={() => setHasParking(true)}
            className={`flex-1 py-3.5 rounded-md text-sm font-medium transition-all duration-200 active:scale-[0.97] ${
              hasParking === true
                ? "bg-primary text-white shadow-[0_4px_12px_rgba(26,163,255,0.3)]"
                : "bg-bg-warm hover:bg-primary-bg hover:-translate-y-0.5"
            }`}
          >
            가능
          </button>
          <button
            onClick={() => setHasParking(false)}
            className={`flex-1 py-3.5 rounded-md text-sm font-medium transition-all duration-200 active:scale-[0.97] ${
              hasParking === false
                ? "bg-primary text-white shadow-[0_4px_12px_rgba(26,163,255,0.3)]"
                : "bg-bg-warm hover:bg-primary-bg hover:-translate-y-0.5"
            }`}
          >
            불가능
          </button>
        </div>
      </div>
      <div>
        <p className="font-semibold mb-4">지상 출입 가능</p>
        <div className="flex gap-3">
          <button
            onClick={() => setHasGroundAccess(true)}
            className={`flex-1 py-3.5 rounded-md text-sm font-medium transition-all duration-200 active:scale-[0.97] ${
              hasGroundAccess === true
                ? "bg-primary text-white shadow-[0_4px_12px_rgba(26,163,255,0.3)]"
                : "bg-bg-warm hover:bg-primary-bg hover:-translate-y-0.5"
            }`}
          >
            가능
          </button>
          <button
            onClick={() => setHasGroundAccess(false)}
            className={`flex-1 py-3.5 rounded-md text-sm font-medium transition-all duration-200 active:scale-[0.97] ${
              hasGroundAccess === false
                ? "bg-primary text-white shadow-[0_4px_12px_rgba(26,163,255,0.3)]"
                : "bg-bg-warm hover:bg-primary-bg hover:-translate-y-0.5"
            }`}
          >
            불가능
          </button>
        </div>
      </div>
    </div>
  );
}
