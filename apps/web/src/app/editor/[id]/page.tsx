"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, use } from "react";
import TopBar from "../../../components/TopBar";
import {
  buildTimeline,
  isSupported,
  loadMedia,
  recordVideo,
  renderFrame,
  type MediaMap,
} from "../../../lib/engine";
import { analyze, applyCommand, planFromText } from "../../../lib/planner";
import { extractPdfText } from "../../../lib/pdf";
import { deleteAsset, getProject, listAssets, putAsset, saveProject } from "../../../lib/store";
import { TtsNotConfiguredError, audioDuration, checkTts, synthesize, type TtsAvailability } from "../../../lib/tts";
import {
  DEFAULT_AUDIO_MIX,
  DEFAULT_SUBTITLE_STYLE,
  PALETTE_KEYS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
  VOICE_LABELS,
  newId,
  totalDuration,
  type Asset,
  type AudioMix,
  type Motion,
  type Project,
  type Scene,
  type Transition,
  type VoiceId,
  type VoiceMode,
} from "../../../lib/types";

const MOTION_LABELS: Record<Motion, string> = {
  none: "Sabit",
  zoom_in: "Yakınlaş",
  zoom_out: "Uzaklaş",
  pan_left: "Sola kaydır",
  pan_right: "Sağa kaydır",
};

const SUB_COLORS = ["#ffffff", "#facc15", "#22c55e", "#60a5fa", "#f472b6", "#fb923c"];

type Tab = "ai" | "style" | "media";

export default function Editor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [project, setProject] = useState<Project | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [media, setMedia] = useState<MediaMap>(new Map());
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState(0);
  const [tab, setTab] = useState<Tab>("ai");

  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  const [chatInput, setChatInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<{ scenes: Scene[]; label: string } | null>(null);

  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [output, setOutput] = useState<{ url: string; ext: string; sizeMB: number } | null>(null);
  const [renderError, setRenderError] = useState("");
  const [notice, setNotice] = useState("");
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceRecordingFor, setVoiceRecordingFor] = useState<string | null>(null);
  const [ttsInfo, setTtsInfo] = useState<TtsAvailability>({
    configured: false,
    provider: null,
    voices: [],
  });
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const startedRef = useRef({ wall: 0, at: 0 });
  const cancelRef = useRef({ cancelled: false });
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  const docInput = useRef<HTMLInputElement>(null);

  const supported = useMemo(() => (typeof window === "undefined" ? true : isSupported()), []);
  const timeline = useMemo(() => buildTimeline(project?.scenes ?? []), [project?.scenes]);
  const total = timeline.length ? timeline[timeline.length - 1].end : 0;
  const report = useMemo(() => analyze(project?.scenes ?? []), [project?.scenes]);

  /* ── Yükleme ── */

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const p = await getProject(id);
        if (!alive) return;
        if (!p) {
          setLoadError("Bu proje bu tarayıcıda bulunamadı. Projeler cihazında yerel olarak saklanır.");
          return;
        }
        const list = await listAssets(id);
        if (!alive) return;
        setProject(p);
        setAssets(list);
        setMedia(await loadMedia(list));
      } catch (err) {
        if (alive) setLoadError(err instanceof Error ? err.message : "Proje açılamadı.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  /* ── Sentetik ses servisi açık mı? ── */

  useEffect(() => {
    let alive = true;
    void checkTts().then((info) => {
      if (alive) setTtsInfo(info);
    });
    return () => {
      alive = false;
    };
  }, []);

  /* ── Tarayıcı okuma seslerini yükle (yalnızca önizleme) ── */

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      const turkishVoices = voices.filter(v => v.lang.startsWith('tr'));
      setAvailableVoices(turkishVoices.length > 0 ? turkishVoices : voices);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  /* ── Kalıcılaştırma ── */

  const patch = useCallback(
    (fn: (p: Project) => Project) => {
      setProject((prev) => {
        if (!prev) return prev;
        const next = { ...fn(prev), updatedAt: new Date().toISOString() };
        void saveProject(next).catch((err) =>
          setNotice(`Kaydedilemedi: ${err instanceof Error ? err.message : "bilinmeyen hata"}`)
        );
        return next;
      });
    },
    []
  );

  const setScenes = useCallback(
    (scenes: Scene[], keepVersion = true) => {
      patch((p) => ({
        ...p,
        scenes,
        versions: keepVersion
          ? [
              { label: new Date().toLocaleTimeString("tr-TR"), createdAt: new Date().toISOString(), scenes: p.scenes },
              ...p.versions,
            ].slice(0, 10)
          : p.versions,
      }));
    },
    [patch]
  );

  /* ── Önizleme çizimi ── */

  const draw = useCallback(
    (t: number) => {
      const canvas = canvasRef.current;
      if (!canvas || !project) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      renderFrame(ctx, timeline, t, media, project.subtitleStyle);
    },
    [project, timeline, media]
  );

  useEffect(() => {
    draw(time);
  }, [draw, time]);

  useEffect(() => {
    if (!playing) {
      media.forEach((el) => el instanceof HTMLVideoElement && el.pause());
      cancelAnimationFrame(rafRef.current);
      return;
    }
    startedRef.current = { wall: performance.now(), at: time >= total ? 0 : time };
    let activeIndex = -1;

    const tick = () => {
      const t = startedRef.current.at + (performance.now() - startedRef.current.wall) / 1000;
      if (t >= total) {
        setTime(total);
        setPlaying(false);
        return;
      }
      const index = timeline.findIndex((it) => t >= it.start && t < it.end);
      if (index !== -1 && index !== activeIndex) {
        activeIndex = index;
        const assetId = timeline[index].scene.assetId;
        const el = assetId ? media.get(assetId) : undefined;
        media.forEach((m) => m instanceof HTMLVideoElement && m !== el && m.pause());
        if (el instanceof HTMLVideoElement) {
          try {
            el.currentTime = 0;
          } catch {
            /* seek desteklenmiyor */
          }
          void el.play().catch(() => undefined);
        }
      }
      setTime(t);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // time bilerek bağımlılık dışı: oynatma başladığı andaki değeri kullanılır
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, total, timeline, media]);

  /* ── Sahne işlemleri ── */

  function updateScene(index: number, changes: Partial<Scene>) {
    if (!project) return;
    const scenes = project.scenes.map((s, i) => (i === index ? { ...s, ...changes } : s));
    patch((p) => ({ ...p, scenes }));
  }

  /* ── Ses ── */

  function setMix(changes: Partial<AudioMix>) {
    patch((p) => ({ ...p, audioMix: { ...(p.audioMix ?? DEFAULT_AUDIO_MIX), ...changes } }));
  }

  /** Sahnenin seslendirme yöntemini değiştirir; yöntemler birbirini dışlar. */
  function setVoiceMode(index: number, mode: VoiceMode) {
    const scene = project?.scenes[index];
    if (!scene) return;
    // Yöntem değişince eski ses geçersiz olur; sessizce yanlış sesi taşımayalım.
    if (scene.voiceAssetId) {
      void deleteAsset(scene.voiceAssetId).catch(() => undefined);
      setAssets((prev) => prev.filter((a) => a.id !== scene.voiceAssetId));
    }
    updateScene(index, {
      voiceMode: mode,
      voiceAssetId: undefined,
      voiceProvider: undefined,
      voiceDuration: undefined,
      voiceError: undefined,
      voiceStatus: "idle",
      voiceId: mode === "tts" ? (scene.voiceId ?? "tr-female") : undefined,
    });
  }

  /** Sentetik ses üretir ve proje asset'i olarak kaydeder. */
  async function generateVoice(index: number) {
    const scene = project?.scenes[index];
    if (!project || !scene) return;
    const text = scene.voiceText?.trim();
    if (!text) {
      setNotice("Önce seslendirme metnini yaz.");
      return;
    }

    updateScene(index, { voiceStatus: "generating", voiceError: undefined });
    try {
      const voice = scene.voiceId ?? "tr-female";
      const { blob, durationSec } = await synthesize(text, voice);

      if (scene.voiceAssetId) {
        await deleteAsset(scene.voiceAssetId).catch(() => undefined);
      }
      const asset: Asset = {
        id: newId("ast"),
        projectId: project.id,
        name: `sahne-${index + 1}-${voice}.mp3`,
        mime: blob.type || "audio/mpeg",
        kind: "audio",
        blob,
        createdAt: new Date().toISOString(),
      };
      await putAsset(asset);
      setAssets((prev) => [...prev.filter((a) => a.id !== scene.voiceAssetId), asset]);
      updateScene(index, {
        voiceAssetId: asset.id,
        voiceProvider: ttsInfo.provider ?? "tts",
        voiceStatus: "ready",
        voiceDuration: durationSec,
        voiceError: undefined,
      });
      setNotice(`Sahne ${index + 1} sesi üretildi (${durationSec.toFixed(1)} sn).`);
    } catch (err) {
      const message =
        err instanceof TtsNotConfiguredError
          ? err.message
          : `Ses üretilemedi: ${err instanceof Error ? err.message : "bilinmeyen hata"}`;
      updateScene(index, { voiceStatus: "error", voiceError: message });
    }
  }

  async function removeVoice(index: number) {
    const scene = project?.scenes[index];
    if (!scene?.voiceAssetId) return;
    await deleteAsset(scene.voiceAssetId).catch(() => undefined);
    setAssets((prev) => prev.filter((a) => a.id !== scene.voiceAssetId));
    updateScene(index, {
      voiceAssetId: undefined,
      voiceProvider: undefined,
      voiceDuration: undefined,
      voiceStatus: "idle",
      voiceError: undefined,
    });
  }

  /** Tarayıcının konuşma sentezi — yalnızca önizleme; videoya gömülemez. */
  function speakPreview(scene: Scene) {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setNotice("Bu tarayıcı metin okumayı desteklemiyor.");
      return;
    }
    const text = scene.voiceText?.trim();
    if (!text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = availableVoices.find((v) => v.lang.startsWith("tr")) ?? availableVoices[0];
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? "tr-TR";
    utterance.onerror = () => setNotice("Metin okunamadı.");
    window.speechSynthesis.speak(utterance);
  }

  function playVoice(assetId: string) {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) {
      setNotice("Ses dosyası bulunamadı.");
      return;
    }
    previewAudioRef.current?.pause();
    const el = new Audio(URL.createObjectURL(asset.blob));
    el.onended = () => URL.revokeObjectURL(el.src);
    previewAudioRef.current = el;
    void el.play().catch(() => setNotice("Ses çalınamadı."));
  }

  /** Mikrofondan sahne seslendirmesi kaydeder — export'a giren tek seslendirme yolu. */
  async function toggleVoiceRecording(index: number) {
    if (voiceRecorderRef.current) {
      voiceRecorderRef.current.stop();
      return;
    }
    const scene = project?.scenes[index];
    if (!project || !scene) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setNotice("Bu tarayıcı mikrofon kaydını desteklemiyor.");
      return;
    }

    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(
        (m) => MediaRecorder.isTypeSupported(m)
      );
      const rec = new MediaRecorder(micStream, mimeType ? { mimeType } : undefined);
      const parts: BlobPart[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) parts.push(e.data);
      };
      rec.onstop = async () => {
        micStream.getTracks().forEach((t) => t.stop());
        voiceRecorderRef.current = null;
        setVoiceRecordingFor(null);
        const blob = new Blob(parts, { type: rec.mimeType || "audio/webm" });
        if (blob.size === 0) {
          setNotice("Ses kaydı boş döndü — kayıt eklenmedi.");
          return;
        }
        try {
          const asset: Asset = {
            id: newId("ast"),
            projectId: project.id,
            name: `sahne-${index + 1}-seslendirme.${blob.type.includes("mp4") ? "m4a" : "webm"}`,
            mime: blob.type,
            kind: "audio",
            blob,
            createdAt: new Date().toISOString(),
          };
          await putAsset(asset);
          setAssets((prev) => [...prev, asset]);
          updateScene(index, {
            voiceAssetId: asset.id,
            voiceMode: "mic",
            voiceProvider: "mic",
            voiceStatus: "ready",
            voiceDuration: await audioDuration(blob),
            voiceError: undefined,
          });
          setNotice(
            `Sahne ${index + 1} seslendirmesi kaydedildi (${Math.round(blob.size / 1024)} KB) ve videoya eklenecek.`
          );
        } catch (err) {
          setNotice(`Ses kaydedilemedi: ${err instanceof Error ? err.message : "bilinmeyen hata"}`);
        }
      };
      rec.start();
      voiceRecorderRef.current = rec;
      setVoiceRecordingFor(scene.id);
      setNotice(`Kayıt başladı — metni oku, bitince “Kaydı bitir”e bas.`);
    } catch (err) {
      setNotice(
        `Mikrofona erişilemedi: ${err instanceof Error ? err.message : "izin verilmedi"}. Tarayıcı izinlerini kontrol et.`
      );
    }
  }

  function moveScene(index: number, dir: -1 | 1) {
    if (!project) return;
    const target = index + dir;
    if (target < 0 || target >= project.scenes.length) return;
    const scenes = [...project.scenes];
    [scenes[index], scenes[target]] = [scenes[target], scenes[index]];
    patch((p) => ({ ...p, scenes }));
    setSelected(target);
  }

  function removeScene(index: number) {
    if (!project) return;
    setScenes(project.scenes.filter((_, i) => i !== index));
    setSelected((s) => Math.max(0, Math.min(s, (project.scenes.length ?? 2) - 2)));
  }

  function addTextScene() {
    if (!project) return;
    const scene: Scene = {
      id: newId("sc"),
      kind: "text",
      duration: 3,
      motion: "zoom_in",
      transition: "fade",
      subtitle: "Yeni sahne metni",
      palette: PALETTE_KEYS[project.scenes.length % PALETTE_KEYS.length],
      visual: "minimal",
    };
    setScenes([...project.scenes, scene]);
    setSelected(project.scenes.length);
  }

  function improveStory() {
    if (!project || project.scenes.length === 0) return;
    const seed =
      project.scenes.length === 1
        ? project.scenes[0].title || project.scenes[0].subtitle
        : project.scenes.map((scene) => scene.subtitle).join(" ");
    const scenes = planFromText(seed, {
      title: project.name,
      tone: "energetic",
      targetDuration: Math.max(20, Math.min(45, project.scenes.length * 6)),
      maxScenes: 7,
    });
    if (scenes.length > 0) {
      setScenes(scenes);
      setSelected(0);
      setTime(0);
      setNotice(`Akış geliştirildi: ${scenes.length} sahneli profesyonel kurgu hazır.`);
    }
  }

  /* ── Dosya yükleme ── */

  async function uploadMedia(list: FileList | null, kind: "image" | "video" | "audio") {
    if (!list || !project) return;
    setNotice("");
    try {
      const added: Asset[] = [];
      for (const file of Array.from(list).slice(0, 20)) {
        const asset: Asset = {
          id: newId("ast"),
          projectId: project.id,
          name: file.name,
          mime: file.type,
          kind,
          blob: file,
          createdAt: new Date().toISOString(),
        };
        await putAsset(asset);
        added.push(asset);
      }
      const nextAssets = [...assets, ...added];
      setAssets(nextAssets);
      setMedia(await loadMedia(nextAssets));

      if (kind === "audio") {
        patch((p) => ({ ...p, audioAssetId: added[0]?.id }));
        setNotice(`Müzik eklendi: ${added[0]?.name}`);
        return;
      }
      const scenes = [
        ...project.scenes,
        ...added.map((a, i) => ({
          id: newId("sc"),
          kind: kind === "video" ? ("video" as const) : ("image" as const),
          assetId: a.id,
          duration: kind === "video" ? 8 : 4,
          motion: kind === "video" ? ("none" as Motion) : ("zoom_in" as Motion),
          transition: "fade" as Transition,
          subtitle: "",
          palette: PALETTE_KEYS[(project.scenes.length + i) % PALETTE_KEYS.length],
        })),
      ];
      setScenes(scenes);
      setNotice(`${added.length} dosya eklendi.`);
    } catch (err) {
      setNotice(`Yükleme başarısız: ${err instanceof Error ? err.message : "bilinmeyen hata"}`);
    }
  }

  async function importDocument(list: FileList | null) {
    if (!list?.length || !project) return;
    const file = list[0];
    setNotice("Belge okunuyor…");
    try {
      const text = file.type === "application/pdf" ? await extractPdfText(file) : await file.text();
      const scenes = planFromText(text, { tone: "educational", maxScenes: 16 });
      if (scenes.length === 0) throw new Error("Belgeden sahne çıkarılamadı.");
      setScenes([...project.scenes, ...scenes]);
      setNotice(`${scenes.length} sahne eklendi.`);
    } catch (err) {
      setNotice(`Belge okunamadı: ${err instanceof Error ? err.message : "bilinmeyen hata"}`);
    }
  }

  async function detachAsset(asset: Asset) {
    if (!project) return;
    await deleteAsset(asset.id);
    const nextAssets = assets.filter((a) => a.id !== asset.id);
    setAssets(nextAssets);
    setMedia(await loadMedia(nextAssets));
    patch((p) => ({
      ...p,
      audioAssetId: p.audioAssetId === asset.id ? undefined : p.audioAssetId,
      scenes: p.scenes.map((s) =>
        s.assetId === asset.id ? { ...s, assetId: undefined, kind: "text" as const } : s
      ),
    }));
  }

  /* ── AI sohbet ── */

  async function sendChat() {
    const message = chatInput.trim();
    if (!message || !project || aiBusy) return;
    setChatInput("");
    setAiBusy(true);

    const userMsg = { id: newId("msg"), role: "user" as const, content: message, createdAt: new Date().toISOString() };
    patch((p) => ({ ...p, chat: [...p.chat, userMsg] }));

    let reply = "";
    let nextScenes: Scene[] | null = null;

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message,
          scenes: project.scenes.map((s) => ({
            subtitle: s.subtitle,
            duration: s.duration,
            motion: s.motion,
            transition: s.transition,
            palette: s.palette ?? "violet",
          })),
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          reply: string;
          changeScenes: boolean;
          scenes: Array<{ subtitle: string; duration: number; motion: Motion; transition: Transition; palette: string }>;
        };
        reply = data.reply;
        if (data.changeScenes && data.scenes.length > 0) {
          nextScenes = data.scenes.map((s, i) => ({
            id: project.scenes[i]?.id ?? newId("sc"),
            kind: project.scenes[i]?.assetId ? project.scenes[i].kind : "text",
            assetId: project.scenes[i]?.assetId,
            duration: Math.min(20, Math.max(1, s.duration)),
            motion: s.motion,
            transition: s.transition,
            subtitle: s.subtitle,
            palette: s.palette,
          }));
        }
      } else {
        // Sunucuda AI yoksa (503) veya hata varsa yerel planlayıcıya düş.
        const local = applyCommand(message, project.scenes, project.subtitleStyle);
        reply =
          res.status === 503
            ? local.reply
            : `${local.reply}\n\n(AI servisine ulaşılamadı; yerel video planlayıcı kullanıldı.)`;
        if (local.scenes) nextScenes = local.scenes;
        if (local.subtitleStyle) patch((p) => ({ ...p, subtitleStyle: local.subtitleStyle! }));
      }
    } catch {
      const local = applyCommand(message, project.scenes, project.subtitleStyle);
      reply = `${local.reply}\n\n(Ağ hatası — yerel planlayıcı kullanıldı.)`;
      if (local.scenes) nextScenes = local.scenes;
      if (local.subtitleStyle) patch((p) => ({ ...p, subtitleStyle: local.subtitleStyle! }));
    }

    const aiMsg = { id: newId("msg"), role: "assistant" as const, content: reply, createdAt: new Date().toISOString() };
    if (nextScenes) {
      setPendingPlan({ scenes: nextScenes, label: message.slice(0, 60) });
      patch((p) => ({ ...p, chat: [...p.chat, aiMsg] }));
    } else {
      patch((p) => ({ ...p, chat: [...p.chat, aiMsg] }));
    }
    setAiBusy(false);
  }

  function applyPendingPlan() {
    if (!pendingPlan) return;
    const plan = pendingPlan;
    patch((p) => ({
      ...p,
      scenes: plan.scenes,
      versions: [
        { label: "AI öncesi", createdAt: new Date().toISOString(), scenes: p.scenes },
        ...p.versions,
      ].slice(0, 10),
    }));
    setPendingPlan(null);
    setNotice("Plan uygulandı. İstersen sürüm geçmişinden geri alabilirsin.");
  }

  function restoreVersion(index: number) {
    if (!project) return;
    const version = project.versions[index];
    if (!version) return;
    patch((p) => ({ ...p, scenes: version.scenes, versions: p.versions.filter((_, i) => i !== index) }));
    setNotice("Önceki sürüm geri yüklendi.");
  }

  /* ── Render ── */

  async function render() {
    if (!project) return;
    setRenderError("");
    setNotice("");
    setPlaying(false);
    if (project.scenes.length === 0) {
      setRenderError("Önce en az bir sahne ekle.");
      return;
    }
    if (!isSupported()) {
      setRenderError(
        "Bu tarayıcı video kaydını (MediaRecorder + canvas.captureStream) desteklemiyor. Chrome, Edge veya güncel Safari deneyin."
      );
      return;
    }

    setRecording(true);
    setProgress(0);
    if (output) URL.revokeObjectURL(output.url);
    setOutput(null);

    try {
      const audioAsset = project.audioAssetId ? assets.find((a) => a.id === project.audioAssetId) : undefined;
      const voiceBlobs = new Map<string, Blob>();
      for (const asset of assets) {
        if (asset.kind === "audio" && asset.id !== project.audioAssetId) {
          voiceBlobs.set(asset.id, asset.blob);
        }
      }
      cancelRef.current = { cancelled: false };
      const result = await recordVideo({
        project,
        media,
        audio: audioAsset?.blob,
        voices: voiceBlobs,
        signal: cancelRef.current,
        onProgress: (ratio) => setProgress(Math.min(1, ratio)),
      });
      setOutput({
        url: URL.createObjectURL(result.blob),
        ext: result.ext,
        sizeMB: Math.round((result.blob.size / 1024 / 1024) * 100) / 100,
      });
      setProgress(1);
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : "Render başarısız.");
    } finally {
      setRecording(false);
    }
  }

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  /* ── Görünüm ── */

  if (loadError) {
    return (
      <>
        <TopBar />
        <main className="shell" style={{ maxWidth: 620 }}>
          <div className="notice notice-error" style={{ marginTop: 40 }}>
            {loadError}
          </div>
          <div className="row" style={{ marginTop: 16 }}>
            <Link href="/projects" className="btn">
              Projelerim
            </Link>
            <Link href="/new" className="btn btn-primary">
              Yeni proje
            </Link>
          </div>
        </main>
      </>
    );
  }

  if (!project) {
    return (
      <>
        <TopBar />
        <main className="shell">
          <div className="muted" style={{ marginTop: 40 }}>
            Proje yükleniyor…
          </div>
        </main>
      </>
    );
  }

  const current = project.scenes[selected];
  const mix = project.audioMix ?? DEFAULT_AUDIO_MIX;

  return (
    <>
      <TopBar />
      <div className="editor">
        {/* Sol: önizleme + render */}
        <div className="editor-col stack">
          <div className="preview-frame">
            <canvas ref={canvasRef} width={VIDEO_WIDTH} height={VIDEO_HEIGHT} />
          </div>

          <div className="row">
            <button className="btn btn-sm" onClick={() => setPlaying((v) => !v)} disabled={total === 0}>
              {playing ? "⏸ Durdur" : "▶ Oynat"}
            </button>
            <button
              className="btn btn-sm"
              onClick={() => {
                setPlaying(false);
                setTime(0);
              }}
            >
              ⏮ Başa
            </button>
            <span className="tiny">
              {time.toFixed(1)} / {total.toFixed(1)} sn
            </span>
          </div>

          <input
            type="range"
            className="range"
            min={0}
            max={Math.max(0.1, total)}
            step={0.05}
            value={Math.min(time, total)}
            onChange={(e) => {
              setPlaying(false);
              setTime(Number(e.target.value));
            }}
          />

          {!supported && (
            <div className="notice notice-error">
              Bu tarayıcı video kaydını desteklemiyor. Önizleme çalışır, ancak dosya üretemezsin —
              Chrome veya Edge dene.
            </div>
          )}

          <button className="btn btn-primary btn-lg" onClick={render} disabled={recording}>
            {recording ? (
              <>
                <span className="spin" /> Kaydediliyor… %{Math.round(progress * 100)}
              </>
            ) : (
              "🎬 Videoyu üret"
            )}
          </button>

          {recording && (
            <>
              <div className="progress">
                <div style={{ width: `${progress * 100}%` }} />
              </div>
              <p className="tiny">
                Kayıt gerçek zamanlı: yaklaşık {total.toFixed(0)} saniye sürecek. Sekmeyi
                değiştirirsen kayıt otomatik duraklar, geri döndüğünde kaldığı yerden devam eder.
              </p>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => {
                  cancelRef.current.cancelled = true;
                }}
              >
                İptal et
              </button>
            </>
          )}

          {renderError && <div className="notice notice-error">{renderError}</div>}

          {output && (
            <div className="card stack fade-in" style={{ gap: 10 }}>
              <div className="row">
                <span className="badge badge-ok">Video hazır</span>
                <span className="tiny">
                  {output.ext.toUpperCase()} · {output.sizeMB} MB
                </span>
              </div>
              <video src={output.url} controls playsInline style={{ width: "100%", borderRadius: 12 }} />
              <a
                className="btn btn-primary"
                href={output.url}
                download={`${project.name.replace(/[^\w\s-]/g, "").trim() || "cinovid"}.${output.ext}`}
              >
                ⬇ İndir
              </a>
              {output.ext === "webm" && (
                <p className="tiny">
                  Tarayıcın MP4 kaydını desteklemediği için WebM üretildi. WebM&apos;i Instagram/TikTok
                  için MP4&apos;e çevirmen gerekebilir.
                </p>
              )}
            </div>
          )}

          <details className="card quality-details">
            <summary>Kalite kontrolü · {report.overall}/10</summary>
            <div className="row" style={{ gap: 8, marginBottom: 8 }}>
              <span className="badge">Hook {report.hook}/10</span>
              <span className="badge">Tempo {report.tempo}/10</span>
              <span className="badge">Altyazı {report.subtitle}/10</span>
              <span className={`badge ${report.overall >= 8 ? "badge-ok" : "badge-warn"}`}>
                Genel {report.overall}/10
              </span>
            </div>
            <ul className="tiny" style={{ paddingLeft: 16, lineHeight: 1.7 }}>
              {report.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </details>
        </div>

        {/* Orta: sahneler */}
        <div className="stack">
          <div className="row">
            <input
              className="input"
              style={{ maxWidth: 320, fontWeight: 700 }}
              value={project.name}
              onChange={(e) => patch((p) => ({ ...p, name: e.target.value }))}
            />
            <div className="spacer" />
            <span className="badge">
              {project.scenes.length} sahne · {total.toFixed(1)} sn
            </span>
          </div>

          {notice && <div className="notice">{notice}</div>}

          <div className="row">
            <button className="btn btn-sm btn-accent" onClick={improveStory}>
              ✦ Akışı geliştir
            </button>
            <button className="btn btn-sm" onClick={addTextScene}>
              + Metin sahnesi
            </button>
            <button className="btn btn-sm" onClick={() => imageInput.current?.click()}>
              + Görsel
            </button>
            <button className="btn btn-sm" onClick={() => videoInput.current?.click()}>
              + Video
            </button>
            <button className="btn btn-sm" onClick={() => docInput.current?.click()}>
              + PDF / metin dosyası
            </button>
          </div>

          <input
            ref={imageInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => void uploadMedia(e.target.files, "image")}
          />
          <input
            ref={videoInput}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => void uploadMedia(e.target.files, "video")}
          />
          <input
            ref={audioInput}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => void uploadMedia(e.target.files, "audio")}
          />
          <input
            ref={docInput}
            type="file"
            accept="application/pdf,text/plain,.md"
            className="hidden"
            onChange={(e) => void importDocument(e.target.files)}
          />

          <div className="stack" style={{ gap: 8 }}>
            {project.scenes.length === 0 && (
              <div className="card muted">
                Henüz sahne yok. Yukarıdan sahne ekle veya sağdaki AI asistana ne istediğini yaz.
              </div>
            )}
            {project.scenes.map((scene, i) => {
              const asset = scene.assetId ? assets.find((a) => a.id === scene.assetId) : undefined;
              const el = scene.assetId ? media.get(scene.assetId) : undefined;
              return (
                <div
                  key={scene.id}
                  className={`scene-item ${i === selected ? "active" : ""}`}
                  onClick={() => {
                    setSelected(i);
                    setPlaying(false);
                    setTime(timeline[i]?.start ?? 0);
                  }}
                >
                  <div className="scene-index">{i + 1}</div>
                  {el instanceof HTMLImageElement ? (
                    // Blob URL önizlemeleri Next/Image optimizasyon hattından geçirilemez.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="thumb" src={el.src} alt="" />
                  ) : (
                    <div className="thumb" style={{ display: "grid", placeItems: "center", fontSize: 18 }}>
                      {scene.kind === "video" ? "🎬" : "T"}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.45 }}>
                      {scene.subtitle || <span className="muted">(altyazı yok)</span>}
                    </div>
                    <div className="tiny" style={{ marginTop: 4 }}>
                      {scene.duration.toFixed(1)} sn · {MOTION_LABELS[scene.motion]} ·{" "}
                      {scene.transition === "fade" ? "yumuşak geçiş" : "sert kesme"}
                      {asset ? ` · ${asset.name}` : ""}
                    </div>
                  </div>
                  <div className="stack" style={{ gap: 4 }}>
                    <button
                      className="btn btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveScene(i, -1);
                      }}
                      disabled={i === 0}
                      aria-label="Yukarı taşı"
                    >
                      ↑
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveScene(i, 1);
                      }}
                      disabled={i === project.scenes.length - 1}
                      aria-label="Aşağı taşı"
                    >
                      ↓
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {current && (
            <div className="card stack fade-in">
              <div className="row">
                <span className="h2">Sahne {selected + 1}</span>
                <div className="spacer" />
                <button className="btn btn-sm btn-danger" onClick={() => removeScene(selected)}>
                  Sahneyi sil
                </button>
              </div>

              <div>
                <label className="label" htmlFor="sub">
                  Altyazı / ekran metni
                </label>
                <textarea
                  id="sub"
                  className="textarea"
                  style={{ minHeight: 80 }}
                  value={current.subtitle}
                  onChange={(e) => updateScene(selected, { subtitle: e.target.value })}
                />
              </div>

              <div>
                <label className="label" htmlFor="voiceText">
                  Seslendirme metni
                </label>
                <textarea
                  id="voiceText"
                  className="textarea"
                  style={{ minHeight: 60 }}
                  value={current.voiceText || ""}
                  onChange={(e) => updateScene(selected, { voiceText: e.target.value })}
                  placeholder="Bu sahnede söylenecek metni yaz…"
                />
              </div>

              <div>
                <label className="label" htmlFor="voiceMode">
                  Seslendirme yöntemi
                </label>
                <select
                  id="voiceMode"
                  className="select"
                  value={current.voiceMode ?? (current.voiceAssetId ? "mic" : "none")}
                  onChange={(e) => setVoiceMode(selected, e.target.value as VoiceMode)}
                >
                  <option value="none">Seslendirme yok</option>
                  <option value="tts">Yapay ses</option>
                  <option value="mic">Kendi sesimi kaydet</option>
                </select>
              </div>

              {current.voiceMode === "tts" && (
                <div className="stack" style={{ gap: 10 }}>
                  <div>
                    <label className="label" htmlFor="voiceId">
                      Ses
                    </label>
                    <select
                      id="voiceId"
                      className="select"
                      value={current.voiceId ?? "tr-female"}
                      onChange={(e) => updateScene(selected, { voiceId: e.target.value as VoiceId })}
                      disabled={!ttsInfo.configured}
                    >
                      {(Object.keys(VOICE_LABELS) as VoiceId[]).map((v) => (
                        <option key={v} value={v}>
                          {VOICE_LABELS[v]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {ttsInfo.configured ? (
                    <div className="row" style={{ gap: 8 }}>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => void generateVoice(selected)}
                        disabled={
                          current.voiceStatus === "generating" || !current.voiceText?.trim()
                        }
                      >
                        {current.voiceStatus === "generating" ? (
                          <>
                            <span className="spin" /> Üretiliyor…
                          </>
                        ) : current.voiceAssetId ? (
                          "Yeniden oluştur"
                        ) : (
                          "Ses oluştur"
                        )}
                      </button>
                      {current.voiceAssetId && (
                        <>
                          <button
                            className="btn btn-sm"
                            onClick={() => playVoice(current.voiceAssetId!)}
                          >
                            ▶ Önizle
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => void removeVoice(selected)}
                          >
                            Sil
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="notice notice-error">
                      Sentetik ses servisi yapılandırılmamış. Sunucuya <code>TTS_PROVIDER</code> ve{" "}
                      <code>TTS_API_KEY</code> eklenmeli. Şimdilik “Kendi sesimi kaydet” seçeneğini
                      kullanabilirsin.
                    </div>
                  )}

                  {current.voiceStatus === "error" && current.voiceError && (
                    <div className="notice notice-error">{current.voiceError}</div>
                  )}
                </div>
              )}

              {current.voiceMode === "mic" && (
                <div className="row" style={{ gap: 8 }}>
                  <button
                    className={`btn btn-sm ${voiceRecordingFor === current.id ? "btn-danger" : ""}`}
                    onClick={() => void toggleVoiceRecording(selected)}
                  >
                    {voiceRecordingFor === current.id ? "⏹ Kaydı bitir" : "🎙 Kaydı başlat"}
                  </button>
                  {current.voiceAssetId && (
                    <>
                      <button className="btn btn-sm" onClick={() => playVoice(current.voiceAssetId!)}>
                        ▶ Önizle
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => void removeVoice(selected)}
                      >
                        Sil
                      </button>
                    </>
                  )}
                </div>
              )}

              {current.voiceMode !== "none" && (
                <button
                  className="btn btn-sm"
                  onClick={() => speakPreview(current)}
                  disabled={!current.voiceText?.trim()}
                  title="Tarayıcı okuması — videoya eklenmez"
                >
                  🔈 Tarayıcıda oku · yalnızca önizleme, videoya eklenmez
                </button>
              )}

              {current.voiceAssetId && (
                <div className="notice notice-ok">
                  Videoya gömülecek ses hazır
                  {current.voiceDuration ? ` · ${current.voiceDuration.toFixed(1)} sn` : ""}
                  {current.voiceProvider ? ` · ${current.voiceProvider}` : ""}
                  {current.voiceDuration && current.voiceDuration > current.duration + 0.3 ? (
                    <>
                      {" "}
                      — <strong>ses sahneden uzun</strong>, sahne bitince kesilir. Sahne süresini{" "}
                      {current.voiceDuration.toFixed(1)} sn yapmak istersen süre çubuğunu artır.
                    </>
                  ) : null}
                </div>
              )}

              <div>
                <label className="label">Süre: {current.duration.toFixed(1)} saniye</label>
                <input
                  type="range"
                  className="range"
                  min={1}
                  max={20}
                  step={0.5}
                  value={current.duration}
                  onChange={(e) => updateScene(selected, { duration: Number(e.target.value) })}
                />
              </div>

              <div className="grid grid-3">
                <div>
                  <label className="label" htmlFor="mot">
                    Hareket
                  </label>
                  <select
                    id="mot"
                    className="select"
                    value={current.motion}
                    onChange={(e) => updateScene(selected, { motion: e.target.value as Motion })}
                  >
                    {(Object.keys(MOTION_LABELS) as Motion[]).map((m) => (
                      <option key={m} value={m}>
                        {MOTION_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="tr">
                    Geçiş
                  </label>
                  <select
                    id="tr"
                    className="select"
                    value={current.transition}
                    onChange={(e) => updateScene(selected, { transition: e.target.value as Transition })}
                  >
                    <option value="fade">Yumuşak (fade)</option>
                    <option value="cut">Sert kesme</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="pal">
                    Renk teması
                  </label>
                  <select
                    id="pal"
                    className="select"
                    value={current.palette ?? "violet"}
                    onChange={(e) => updateScene(selected, { palette: e.target.value })}
                  >
                    {PALETTE_KEYS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {current.assetId && (
                <p className="tiny">
                  Renk teması yalnızca görselsiz (metin) sahnelerde görünür.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Sağ: AI / stil / medya */}
        <div className="editor-tools stack">
          <div className="tabs">
            <button className={`tab ${tab === "ai" ? "active" : ""}`} onClick={() => setTab("ai")}>
              AI asistan
            </button>
            <button className={`tab ${tab === "style" ? "active" : ""}`} onClick={() => setTab("style")}>
              Altyazı
            </button>
            <button className={`tab ${tab === "media" ? "active" : ""}`} onClick={() => setTab("media")}>
              Medya
            </button>
          </div>

          {tab === "ai" && (
            <div className="card stack">
              <div className="chat">
                {project.chat.length === 0 && (
                  <div className="bubble bubble-ai">
                    Merhaba! Ne tür bir video istiyorsun? Örnek komutlar:{"\n"}• “30 saniye olsun”
                    {"\n"}• “Reels için tempolu yap”{"\n"}• “altyazıyı sarı yap”{"\n"}• “son sahneyi
                    sil”{"\n"}• “2. sahne: yeni metin”{"\n"}Uzun bir metin yapıştırırsan onu
                    sahnelere bölerim.
                  </div>
                )}
                {project.chat.map((m) => (
                  <div key={m.id} className={`bubble ${m.role === "user" ? "bubble-user" : "bubble-ai"}`}>
                    {m.content}
                  </div>
                ))}
                {aiBusy && (
                  <div className="bubble bubble-ai">
                    <span className="spin" style={{ display: "inline-block", verticalAlign: "-2px" }} />{" "}
                    düşünüyor…
                  </div>
                )}
              </div>

              {pendingPlan && (
                <div className="notice" style={{ display: "grid", gap: 10 }}>
                  <div>
                    <strong>Uygulamadan önce kontrol et</strong>
                    <div className="tiny" style={{ marginTop: 4 }}>
                      {pendingPlan.scenes.length} sahne · {totalDuration(pendingPlan.scenes).toFixed(1)} sn
                      oluşturulacak. Mevcut kurgu sürüm geçmişine kaydedilecek.
                    </div>
                  </div>
                  <div className="row">
                    <button className="btn btn-sm btn-primary" onClick={applyPendingPlan}>Planı uygula</button>
                    <button className="btn btn-sm" onClick={() => setPendingPlan(null)}>Vazgeç</button>
                  </div>
                </div>
              )}

              <textarea
                className="textarea"
                style={{ minHeight: 76 }}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void sendChat();
                }}
                placeholder="Ne yapmamı istersin? (Ctrl+Enter ile gönder)"
              />
              <button className="btn btn-primary" onClick={() => void sendChat()} disabled={aiBusy}>
                Gönder
              </button>

              {project.versions.length > 0 && (
                <>
                  <div className="label" style={{ marginTop: 6 }}>
                    Sürüm geçmişi
                  </div>
                  <div className="stack" style={{ gap: 6 }}>
                    {project.versions.slice(0, 5).map((v, i) => (
                      <button key={v.createdAt + i} className="btn btn-sm" onClick={() => restoreVersion(i)}>
                        ↩ {v.label} · {v.scenes.length} sahne
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "style" && (
            <div className="card stack">
              <div>
                <label className="label">Altyazı rengi</label>
                <div className="row" style={{ gap: 8 }}>
                  {SUB_COLORS.map((c) => (
                    <button
                      key={c}
                      aria-label={`Renk ${c}`}
                      onClick={() =>
                        patch((p) => ({ ...p, subtitleStyle: { ...p.subtitleStyle, color: c } }))
                      }
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 9,
                        background: c,
                        cursor: "pointer",
                        border:
                          project.subtitleStyle.color === c
                            ? "2px solid #fff"
                            : "1px solid rgba(255,255,255,0.2)",
                      }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Punto: {project.subtitleStyle.size}px</label>
                <input
                  type="range"
                  className="range"
                  min={28}
                  max={96}
                  step={2}
                  value={project.subtitleStyle.size}
                  onChange={(e) =>
                    patch((p) => ({
                      ...p,
                      subtitleStyle: { ...p.subtitleStyle, size: Number(e.target.value) },
                    }))
                  }
                />
              </div>

              <div>
                <label className="label" htmlFor="pos">
                  Konum
                </label>
                <select
                  id="pos"
                  className="select"
                  value={project.subtitleStyle.position}
                  onChange={(e) =>
                    patch((p) => ({
                      ...p,
                      subtitleStyle: {
                        ...p.subtitleStyle,
                        position: e.target.value as "top" | "center" | "bottom",
                      },
                    }))
                  }
                >
                  <option value="top">Üst</option>
                  <option value="center">Orta</option>
                  <option value="bottom">Alt</option>
                </select>
              </div>

              <label className="row" style={{ gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={project.subtitleStyle.background}
                  onChange={(e) =>
                    patch((p) => ({
                      ...p,
                      subtitleStyle: { ...p.subtitleStyle, background: e.target.checked },
                    }))
                  }
                />
                <span style={{ fontSize: 14 }}>Altyazı arkasına koyu zemin</span>
              </label>

              <button
                className="btn btn-sm"
                onClick={() => patch((p) => ({ ...p, subtitleStyle: { ...DEFAULT_SUBTITLE_STYLE } }))}
              >
                Varsayılana dön
              </button>
            </div>
          )}

          {tab === "media" && (
            <div className="card stack">
              <div className="row">
                <button className="btn btn-sm" onClick={() => audioInput.current?.click()}>
                  🎵 Arka plan müziği ekle
                </button>
              </div>
              {project.audioAssetId ? (
                <div className="notice notice-ok">
                  Müzik: {assets.find((a) => a.id === project.audioAssetId)?.name ?? "seçili"} — video
                  boyunca döner.
                </div>
              ) : (
                <p className="tiny">
                  Müzik eklersen kayda ses kanalı olarak eklenir.
                </p>
              )}

              <div className="label" style={{ marginTop: 12 }}>
                Ses karıştırıcı
              </div>
              {(
                [
                  { key: "video", label: "Video sesi", hint: "Yüklediğin videoların kendi sesi" },
                  { key: "voice", label: "Seslendirme", hint: "Sahnelere kaydettiğin ses" },
                  { key: "music", label: "Arka plan müziği", hint: "Döngüyle çalar" },
                ] as const
              ).map(({ key, label, hint }) => {
                const enabled = mix[`${key}Enabled` as const];
                const volume = mix[`${key}Volume` as const];
                return (
                  <div key={key} className="stack" style={{ gap: 6 }}>
                    <label className="row" style={{ gap: 8, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => setMix({ [`${key}Enabled`]: e.target.checked })}
                      />
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{label}</span>
                      <span className="tiny">{Math.round(volume * 100)}%</span>
                    </label>
                    <input
                      type="range"
                      className="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={volume}
                      disabled={!enabled}
                      onChange={(e) => setMix({ [`${key}Volume`]: Number(e.target.value) })}
                      aria-label={`${label} seviyesi`}
                    />
                    <p className="tiny">{hint}</p>
                  </div>
                );
              })}
              <button
                className="btn btn-sm"
                onClick={() => patch((p) => ({ ...p, audioMix: { ...DEFAULT_AUDIO_MIX } }))}
              >
                Ses seviyelerini sıfırla
              </button>

              <div className="label" style={{ marginTop: 6 }}>
                Yüklenen dosyalar ({assets.length})
              </div>
              {assets.length === 0 && <p className="tiny">Henüz dosya yok.</p>}
              <div className="stack" style={{ gap: 6 }}>
                {assets.map((a) => (
                  <div key={a.id} className="row" style={{ gap: 8 }}>
                    <span className="badge">{a.kind}</span>
                    <span className="tiny" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.name}
                    </span>
                    <button className="btn btn-sm btn-danger" onClick={() => void detachAsset(a)}>
                      Sil
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
