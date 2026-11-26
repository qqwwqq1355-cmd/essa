/**
 * طابور تحميل صور الأغلفة — يحدّ عدد الطلبات المتزامنة (4 فقط)، يعيد المحاولة تلقائياً عند الفشل،
 * ويمكن إيقافه مؤقتاً (pause) لإعطاء الأولوية المطلقة لفتح الصوت ثم يستأنف تلقائياً.
 */

const MAX_CONCURRENT = 4;
const MAX_ATTEMPTS = 3;

interface CoverTask {
  url: string;
  listeners: Set<(ok: boolean) => void>;
  attempts: number;
}

const loaded = new Set<string>();
const tasks = new Map<string, CoverTask>();
const queue: CoverTask[] = [];
const active = new Map<string, HTMLImageElement>();

let paused = false;
let resumeTimer: ReturnType<typeof setTimeout> | null = null;

export function isCoverLoaded(url: string): boolean {
  return loaded.has(url);
}

function notify(task: CoverTask, ok: boolean) {
  tasks.delete(task.url);
  task.listeners.forEach((cb) => cb(ok));
  task.listeners.clear();
}

function pump() {
  while (!paused && active.size < MAX_CONCURRENT && queue.length > 0) {
    const task = queue.shift()!;
    if (!tasks.has(task.url) || active.has(task.url)) continue;
    startTask(task);
  }
}

function startTask(task: CoverTask) {
  const img = new Image();
  img.decoding = 'async';
  active.set(task.url, img);

  img.onload = () => {
    active.delete(task.url);
    loaded.add(task.url);
    notify(task, true);
    pump();
  };

  img.onerror = () => {
    active.delete(task.url);
    task.attempts += 1;
    if (task.attempts < MAX_ATTEMPTS && tasks.has(task.url)) {
      setTimeout(() => {
        if (tasks.has(task.url)) {
          queue.push(task);
          pump();
        }
      }, 700 * task.attempts);
    } else {
      notify(task, false);
    }
    pump();
  };

  img.src = task.url;
}

/**
 * يطلب تحميل صورة غلاف عبر الطابور. يعيد دالة إلغاء.
 */
export function loadCover(
  url: string,
  onDone: (ok: boolean) => void,
  highPriority = false
): () => void {
  if (loaded.has(url)) {
    onDone(true);
    return () => undefined;
  }

  let task = tasks.get(url);
  if (!task) {
    task = { url, listeners: new Set(), attempts: 0 };
    tasks.set(url, task);
    if (highPriority) queue.unshift(task);
    else queue.push(task);
  }
  task.listeners.add(onDone);
  pump();

  return () => {
    const t = tasks.get(url);
    if (!t) return;
    t.listeners.delete(onDone);
    if (t.listeners.size === 0 && !active.has(url)) {
      tasks.delete(url);
      const idx = queue.indexOf(t);
      if (idx >= 0) queue.splice(idx, 1);
    }
  };
}

/**
 * إيقاف فوري لكل طلبات الصور الجارية (وإرجاعها لمقدمة الطابور) لتفريغ الشبكة بالكامل للصوت.
 */
export function pauseImageLoading(maxPauseMs = 6000): void {
  paused = true;
  if (resumeTimer) clearTimeout(resumeTimer);

  active.forEach((img, url) => {
    img.onload = null;
    img.onerror = null;
    img.src = '';
    const task = tasks.get(url);
    if (task) queue.unshift(task);
  });
  active.clear();

  resumeTimer = setTimeout(resumeImageLoading, maxPauseMs);
}

export function resumeImageLoading(): void {
  if (resumeTimer) {
    clearTimeout(resumeTimer);
    resumeTimer = null;
  }
  if (!paused) return;
  paused = false;
  pump();
}

