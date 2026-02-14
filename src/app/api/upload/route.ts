import { NextRequest, NextResponse } from "next/server";
import { getDriveService } from "@/lib/sheets-db";
import { Readable } from "stream";

// Google Drive 폴더 ID (환경변수로 관리, 없으면 루트에 업로드)
const DRIVE_FOLDER_ID = process.env.UPLOAD_DRIVE_FOLDER_ID || "";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "파일이 필요합니다" },
        { status: 400 },
      );
    }

    // 이미지 파일만 허용
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "이미지 파일만 업로드 가능합니다" },
        { status: 400 },
      );
    }

    // 최대 5MB 제한
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "파일 크기는 5MB 이하만 가능합니다" },
        { status: 400 },
      );
    }

    const drive = getDriveService();
    const buffer = Buffer.from(await file.arrayBuffer());

    const timestamp = Date.now();
    const fileName = `booking_${timestamp}_${file.name}`;

    // Google Drive에 업로드
    const fileMetadata: { name: string; parents?: string[] } = {
      name: fileName,
    };
    if (DRIVE_FOLDER_ID) {
      fileMetadata.parents = [DRIVE_FOLDER_ID];
    }

    const media = {
      mimeType: file.type,
      body: Readable.from(buffer),
    };

    const uploaded = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: "id, webViewLink, webContentLink",
    });

    const fileId = uploaded.data.id;

    // 파일을 공개 읽기 가능하게 설정
    await drive.permissions.create({
      fileId: fileId!,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    // 직접 접근 가능한 URL 생성
    const url = `https://drive.google.com/uc?id=${fileId}&export=view`;

    return NextResponse.json({
      url,
      fileId,
      fileName,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "업로드 실패", detail: String(e) },
      { status: 500 },
    );
  }
}
