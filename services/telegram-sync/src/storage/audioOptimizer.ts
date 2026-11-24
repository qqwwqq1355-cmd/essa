import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/**
 * يحسّن ملف الـ MP3 عبر ffmpeg للبث الفوري السريع (Fast-Start):
 * - يزيل الصور الضخمة المدمجة والوسوم الزائدة في أول الملف (-vn -map_metadata -1) ليبدأ الصوت من البايت 0 فوراً!
 * - يضغط بجودة ستيريو نقية (96kbps libmp3lame) مع ترويسة Xing لسرعة البدء والتقديم والترجيع الفوري.
 */
export function optimizeMp3ForInstantStreaming(
  rawBytes: Uint8Array,
  msgId: number,
  bitrate = '96k'
): Uint8Array {
  const tmpDir = os.tmpdir();
  const stamp = `${msgId}_${Date.now()}`;
  const inFile = path.join(tmpDir, `essa_in_${stamp}.audio`);
  const outFile = path.join(tmpDir, `essa_out_${stamp}.mp3`);

  try {
    fs.writeFileSync(inFile, rawBytes);
    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        inFile,
        '-vn',
        '-map_metadata',
        '-1',
        '-acodec',
        'libmp3lame',
        '-b:a',
        bitrate,
        '-ar',
        '44100',
        '-ac',
        '2',
        '-write_xing',
        '1',
        outFile,
      ],
      { stdio: 'pipe' }
    );

    const optimized = fs.readFileSync(outFile);
    if (optimized.byteLength > 4096) {
      return new Uint8Array(optimized.buffer, optimized.byteOffset, optimized.byteLength);
    }
    return rawBytes;
  } catch (err) {
    console.warn(
      `[ffmpeg] Optimization skipped for #${msgId} (using original):`,
      err instanceof Error ? err.message : String(err)
    );
    return rawBytes;
  } finally {
    try {
      if (fs.existsSync(inFile)) fs.unlinkSync(inFile);
      if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
    } catch {
      // تجاهل
    }
  }
}

