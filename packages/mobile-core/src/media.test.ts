import { afterEach, describe, expect, it, vi } from "vitest";

import { createMediaApi, MediaUploadError, uploadAsset } from "./media";

describe("createMediaApi", () => {
  it("parses upload intent responses", async () => {
    const apiClient = vi.fn().mockResolvedValue({
      upload_id: "upload-1",
      asset_id: "asset-1",
      object_key: "private/cases/case-1/asset-1/original.jpg",
      upload_method: "single_put",
      upload_url: "https://upload.example.com/object",
      upload_headers: { "Content-Type": "image/jpeg" },
      expires_at: "2026-04-20T12:00:00.000Z",
    });

    const mediaApi = createMediaApi(apiClient as never);
    const intent = await mediaApi.createUploadIntent({
      purpose: "case_evidence_photo",
      owner_ref: "draft-1",
      filename: "photo.jpg",
      mime_type: "image/jpeg",
      size_bytes: 123,
    });

    expect(intent.upload_method).toBe("single_put");
    expect(apiClient).toHaveBeenCalledWith(
      "/media/uploads/intents",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("uploadAsset", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("runs intent, direct upload, and complete steps", async () => {
    const localFileResponse = {
      ok: true,
      blob: () => Promise.resolve(new Blob(["test"], { type: "image/jpeg" })),
    };
    const uploadResponse = {
      ok: true,
      status: 200,
      headers: new Headers({ etag: '"etag-1"' }),
    };
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(localFileResponse)
      .mockResolvedValueOnce(uploadResponse) as typeof fetch;

    const mediaApi = {
      createUploadIntent: vi.fn().mockResolvedValue({
        upload_id: "upload-1",
        asset_id: "asset-1",
        object_key: "private/cases/draft-1/asset-1/original.jpg",
        upload_method: "single_put",
        upload_url: "https://upload.example.com/object",
        upload_headers: { "Content-Type": "image/jpeg" },
        expires_at: "2026-04-20T12:00:00.000Z",
      }),
      completeUpload: vi.fn().mockResolvedValue({
        id: "asset-1",
        purpose: "case_evidence_photo",
        owner_kind: "service_case",
        owner_id: "draft-1",
        visibility: "private",
        status: "ready",
        mime_type: "image/jpeg",
        size_bytes: 4,
        checksum_sha256: null,
        dimensions: null,
        duration_sec: null,
        preview_url: "https://download.example.com/preview",
        download_url: "https://download.example.com/original",
        created_at: "2026-04-20T11:58:00.000Z",
        uploaded_at: "2026-04-20T11:59:00.000Z",
        exif_stripped_at: null,
        antivirus_scanned_at: null,
      }),
      getAsset: vi.fn(),
      deleteAsset: vi.fn(),
    };

    const result = await uploadAsset({
      mediaApi,
      purpose: "case_evidence_photo",
      ownerRef: "draft-1",
      source: {
        uri: "file:///photo.jpg",
        name: "photo.jpg",
        mimeType: "image/jpeg",
      },
    });

    expect(result.asset.id).toBe("asset-1");
    expect(mediaApi.createUploadIntent).toHaveBeenCalled();
    expect(mediaApi.completeUpload).toHaveBeenCalledWith("upload-1", {
      etag: '"etag-1"',
      checksum_sha256: undefined,
    });
  });

  it("wraps transfer failures", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(new Blob(["test"], { type: "image/jpeg" })),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers(),
      }) as typeof fetch;

    await expect(
      uploadAsset({
        mediaApi: {
          getAsset: vi.fn(),
          deleteAsset: vi.fn(),
          createUploadIntent: vi.fn().mockResolvedValue({
            upload_id: "upload-1",
            asset_id: "asset-1",
            object_key: "private/cases/draft-1/asset-1/original.jpg",
            upload_method: "single_put",
            upload_url: "https://upload.example.com/object",
            upload_headers: { "Content-Type": "image/jpeg" },
            expires_at: "2026-04-20T12:00:00.000Z",
          }),
          completeUpload: vi.fn(),
        },
        purpose: "case_evidence_photo",
        ownerRef: "draft-1",
        source: {
          uri: "file:///photo.jpg",
          name: "photo.jpg",
          mimeType: "image/jpeg",
        },
      }),
    ).rejects.toMatchObject({
      name: "MediaUploadError",
      kind: "transfer",
    } satisfies Partial<MediaUploadError>);
  });
});
