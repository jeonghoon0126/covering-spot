import type { Booking } from "@/types/booking";

interface PhotosSectionProps {
  booking: Booking;
}

/** 고객이 업로드한 사진 */
export function PhotosSection({ booking }: PhotosSectionProps) {
  if (!booking.photos || booking.photos.length === 0) return null;

  return (
    <div className="bg-bg rounded-lg p-5 border border-border-light">
      <h3 className="text-sm font-semibold text-text-sub mb-3">
        사진 ({booking.photos.length}장)
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {booking.photos.map((url, idx) => (
          <a
            key={idx}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="aspect-square bg-bg-warm rounded-md overflow-hidden"
          >
            <img
              src={url}
              alt={`사진 ${idx + 1}`}
              className="w-full h-full object-cover"
            />
          </a>
        ))}
      </div>
    </div>
  );
}

interface CompletionPhotosUploadProps {
  completionPhotos: string[];
  uploadingPhotos: boolean;
  onPhotoUpload: (files: FileList) => void;
  onRemovePhoto: (idx: number) => void;
}

/** 수거 완료 사진 — 수거 진행 중일 때 업로드 가능 */
export function CompletionPhotosUpload({
  completionPhotos,
  uploadingPhotos,
  onPhotoUpload,
  onRemovePhoto,
}: CompletionPhotosUploadProps) {
  return (
    <div className="bg-bg rounded-lg p-5 border border-border-light">
      <h3 className="text-sm font-semibold text-text-sub mb-3">
        수거 완료 사진
      </h3>
      {completionPhotos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {completionPhotos.map((url, idx) => (
            <div
              key={idx}
              className="relative aspect-square bg-bg-warm rounded-md overflow-hidden"
            >
              <img
                src={url}
                alt={`완료 사진 ${idx + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => onRemovePhoto(idx)}
                className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/50 text-white text-xs flex items-center justify-center"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
      <label
        className={`flex items-center justify-center gap-2 py-3 rounded-md border border-dashed border-border text-sm text-text-sub cursor-pointer hover:bg-bg-warm transition-colors duration-200 ${
          uploadingPhotos ? "opacity-50 pointer-events-none" : ""
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 3v10M3 8h10"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        {uploadingPhotos ? "업로드 중..." : "사진 추가"}
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = e.target.files;
            if (!files || files.length === 0) return;
            onPhotoUpload(files);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}

interface CompletionPhotosReadonlyProps {
  completionPhotos: string[];
}

/** 수거 완료 사진 — 완료 이후 읽기 전용 */
export function CompletionPhotosReadonly({
  completionPhotos,
}: CompletionPhotosReadonlyProps) {
  if (completionPhotos.length === 0) return null;

  return (
    <div className="bg-bg rounded-lg p-5 border border-border-light">
      <h3 className="text-sm font-semibold text-text-sub mb-3">
        수거 완료 사진 ({completionPhotos.length}장)
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {completionPhotos.map((url, idx) => (
          <a
            key={idx}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="aspect-square bg-bg-warm rounded-md overflow-hidden"
          >
            <img
              src={url}
              alt={`완료 사진 ${idx + 1}`}
              className="w-full h-full object-cover"
            />
          </a>
        ))}
      </div>
    </div>
  );
}
