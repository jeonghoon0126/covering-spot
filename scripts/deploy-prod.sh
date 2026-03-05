#!/bin/bash
set -e

echo "🚀 Dev → Prod 배포 시작"
echo "현재 브랜치: $(git branch --show-current)"

# dev 브랜치 확인
if [ "$(git branch --show-current)" != "dev" ]; then
  echo "❌ dev 브랜치에서 실행해주세요"
  exit 1
fi

# uncommitted 변경 확인
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "❌ 커밋되지 않은 변경사항이 있습니다"
  exit 1
fi

# main으로 전환 → dev 머지 → push → dev 복귀
git checkout main
git pull origin main --ff-only 2>/dev/null || true
git merge dev --no-edit
git push origin main --no-verify
git checkout dev
echo "✅ Prod 배포 트리거 완료 (main에 머지됨)"
