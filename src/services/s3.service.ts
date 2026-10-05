import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
class S3Service {
  private s3Client: S3Client | null = null;
  connect() {
    const {
      STORAGE_REGION,
      STORAGE_ENDPOINT,
      ACCESS_KEY_ID,
      SECRET_ACCESS_KEY,
    } = process.env;

    if (
      !STORAGE_REGION ||
      !STORAGE_ENDPOINT ||
      !ACCESS_KEY_ID ||
      !SECRET_ACCESS_KEY
    ) {
      throw new Error("Missing S3 environment variables");
    }

    this.s3Client = new S3Client({
      forcePathStyle: true,
      region: STORAGE_REGION,
      endpoint: STORAGE_ENDPOINT,
      credentials: {
        accessKeyId: ACCESS_KEY_ID,
        secretAccessKey: SECRET_ACCESS_KEY,
      },
    });
  }

  async uploadFile(file: Express.Multer.File, bucketKey: string, key: string) {
    const command = new PutObjectCommand({
      Bucket: bucketKey,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    try {
      await this.s3Client?.send(command);
    } catch (error) {
      throw new Error(`Failed to upload to S3: ${(error as Error).message}`);
    }
  }
  getPublicUrl(bucketKey: string, key: string): string {
    const endpoint = process.env.STORAGE_ENDPOINT!;

    // เปลี่ยน /s3 เป็น /object/public
    const baseUrl = endpoint.replace("/s3", "/object/public");

    return `${baseUrl}/${bucketKey}/${key}`;
  }

  // แปลง public URL กลับเป็น S3 key (ถ้า URL ไม่ตรงกับ format ของเราให้คืน null)
  extractKey(bucketKey: string, publicUrl: string): string | null {
    const endpoint = process.env.STORAGE_ENDPOINT!;
    const baseUrl = endpoint.replace("/s3", "/object/public");
    const prefix = `${baseUrl}/${bucketKey}/`;

    if (!publicUrl.startsWith(prefix)) return null;
    return publicUrl.slice(prefix.length) || null;
  }

  async deleteFile(bucketKey: string, key: string) {
    const command = new DeleteObjectCommand({
      Bucket: bucketKey,
      Key: key,
    });

    try {
      await this.s3Client?.send(command);
    } catch (error) {
      throw new Error(`Failed to delete from S3: ${(error as Error).message}`);
    }
  }
}

export default new S3Service();
