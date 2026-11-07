// Proof file storage behind a tiny interface so it can move to S3/R2/GCS later.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export interface ProofStorage {
  put(name: string, data: Buffer, mimeType: string): Promise<string>;
  get(key: string): Promise<Buffer>;
}

class LocalStorage implements ProofStorage {
  constructor(private dir: string) {}
  async put(name: string, data: Buffer, mimeType: string) {
    const ext = mimeType.includes("png") ? "png" : mimeType.includes("webm") ? "webm" : "jpg";
    const key = `${new Date().toISOString().slice(0, 10)}/${name}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
    const full = path.join(this.dir, key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
    return key;
  }
  async get(key: string) {
    const full = path.join(this.dir, path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, ""));
    return fs.readFile(full);
  }
}

export const storage: ProofStorage = new LocalStorage(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"));

export function sha256(data: Buffer | string): Buffer {
  return crypto.createHash("sha256").update(data).digest();
}

export { canonicalJson } from "../canonical";
