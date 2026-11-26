/**
 * طابور تحميل صور الأغلفة — يحدّ عدد الطلبات المتزامنة (4 فقط)، يعيد المحاولة تلقائياً عند الفشل،
 * ويمكن إيقافه مؤقتاً (pause) لإعطاء الأولوية المطلقة لفتح الصوت ثم يستأنف تلقائياً.
 */

const MAX_CONCURRENT = 2;
const MAX_ATTEMPTS = 3;

interface CoverTask {
  url: string;
  listeners: Set<(ok: boolean) => void>;
  attempts: number;
}

const loaded = new Map<string, string>(); // url -> blobUrl (أو url)
const tasks = new Map<string, CoverTask>();
const queue: CoverTask[] = [];
const active = new Map<string, AbortController>();

let paused = false;
let resumeTimer: ReturnType<typeof setTimeout> | null = null;

export function isCoverLoaded(url: string): boolean {
  return loaded.has(url);
}

export function getLoadedCoverSrc(url: string): string {
  return loaded.get(url) ?? url;
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
  const controller = new AbortController();
  active.set(task.url, controller);

  void fetch(task.url, { signal: controller.signal, mode: 'cors' })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.blob();
    })
    .then((blob) => {
      active.delete(task.url);
      if (blob.size < 100) throw new Error('empty');
      const blobUrl = URL.createObjectURL(blob);
      loaded.set(task.url, blobUrl);
      notify(task, true);
      pump();
    })
    .catch((err) => {
      active.delete(task.url);
      // إذا تم الإلغاء عمداً لإعطاء الأولوية للصوت، نعيده للطابور بدون احتساب فشل
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (tasks.has(task.url) && !queue.includes(task)) {
          queue.unshift(task);
        }
        return;
      }
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
    });
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

  // إلغاء فعلي فوري (AbortController) لكل طلبات الصور الجارية على مستوى الشبكة!
  active.forEach((controller, url) => {
    controller.abort();
    const task = tasks.get(url);
    if (task && !queue.includes(task)) queue.unshift(task);
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

