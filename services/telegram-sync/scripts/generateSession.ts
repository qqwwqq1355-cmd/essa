import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

/**
 * سكربت يُشغّل لمرة واحدة فقط لتوليد TELEGRAM_STRING_SESSION
 * ويحفظها تلقائياً داخل ملف services/telegram-sync/.env
 */
async function generate() {
  const rl = readline.createInterface({ input, output });

  try {
    const apiId = Number(process.env.TELEGRAM_API_ID || (await rl.question('Enter TELEGRAM_API_ID: ')));
    const apiHash = (process.env.TELEGRAM_API_HASH || (await rl.question('Enter TELEGRAM_API_HASH: '))).trim();

    console.log(`\nConnecting to Telegram (API ID: ${apiId})...`);

    const client = new TelegramClient(new StringSession(''), apiId, apiHash, {
      connectionRetries: 5,
      deviceModel: 'Windows Desktop',
      systemVersion: 'Windows 10',
      appVersion: '5.6.0',
      langCode: 'ar',
      systemLangCode: 'ar',
    });

    await client.start({
      phoneNumber: async () => {
        const phone = await rl.question('Enter Telegram phone number with country code (e.g. +9677...): ');
        return phone.trim();
      },
      password: async (hint) => {
        const pwd = await rl.question(
          `Enter 2FA password${hint ? ` (hint: ${hint})` : ''} (press Enter if none): `
        );
        return pwd.trim();
      },
      phoneCode: async (isCodeViaApp) => {
        console.log('\n------------------------------------------------------------');
        if (isCodeViaApp) {
          console.log('[!] تم إرسال الرمز داخل تطبيق تليجرام نفسه (وليس برسالة SMS)!');
          console.log('    افتح تطبيق تليجرام على جوالك أو الكمبيوتر -> ابحث عن محادثة "Telegram" الرسمية (بالعلامة الزرقاء).');
          console.log('    (تأكد أيضاً من مجلد المحادثات المؤرشفة Archived Chats)');
        } else {
          console.log('[!] تم إرسال الرمز عبر SMS أو البريد الإلكتروني المرتبط بحسابك.');
        }
        console.log('------------------------------------------------------------\n');
        const code = await rl.question('Enter the 5-digit login code: ');
        return code.trim();
      },
      onError: (err) => {
        console.error('\n[Telegram Auth Error]:', err);
      },
    });

    const sessionStr = String(client.session.save());

    // حفظ الجلسة تلقائياً داخل ملف .env
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      if (/^TELEGRAM_STRING_SESSION=.*$/m.test(envContent)) {
        envContent = envContent.replace(
          /^TELEGRAM_STRING_SESSION=.*$/m,
          `TELEGRAM_STRING_SESSION=${sessionStr}`
        );
      } else {
        envContent += `\nTELEGRAM_STRING_SESSION=${sessionStr}\n`;
      }
      fs.writeFileSync(envPath, envContent, 'utf8');
      console.log('\n============================================================');
      console.log('SUCCESS! TELEGRAM_STRING_SESSION was automatically saved to .env');
      console.log('============================================================\n');
    } else {
      console.log('\nSUCCESS! Copy this TELEGRAM_STRING_SESSION into .env:\n');
      console.log(sessionStr);
    }

    await client.disconnect();
    process.exit(0);
  } finally {
    rl.close();
  }
}

generate().catch((err) => {
  console.error('Failed to generate session:', err);
  process.exit(1);
});
