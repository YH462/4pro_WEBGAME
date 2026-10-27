"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, ChevronRight, QrCode, RotateCcw, X } from "lucide-react";
import { raidQrDestination } from "@/lib/raid-qr";
import styles from "./raid-qr-scanner.module.css";

export function RaidQrScanner({ hasPlayer, startHref = "/start" }: { hasPlayer: boolean; startHref?: "/start" | "/start?next=battle" }) {
  const router = useRouter();
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState("カメラを起動しています…");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const player = video.current;

    function stop() {
      cancelled = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      if (player) player.srcObject = null;
    }
    function hide() { dialog.current?.close(); }
    function visibility() { if (document.hidden) hide(); }
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", hide);

    async function start() {
      try {
        if (!window.isSecureContext) throw new Error("insecure");
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
        const { default: decode } = await import("jsqr");
        if (cancelled) return;
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        // Permission prompts can resolve after the dialog has already closed.
        if (cancelled || !player) { stop(); return; }
        player.srcObject = stream;
        await player.play();
        if (cancelled) return;
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("unsupported");
        setStatus("会場のレイド用QRコードを枠に合わせてください。");

        function scan() {
          if (cancelled || !player || !context) return;
          if (player.readyState >= 2 && player.videoWidth && player.videoHeight) {
            const scale = Math.min(1, 640 / Math.max(player.videoWidth, player.videoHeight));
            canvas.width = Math.max(1, Math.round(player.videoWidth * scale));
            canvas.height = Math.max(1, Math.round(player.videoHeight * scale));
            context.drawImage(player, 0, 0, canvas.width, canvas.height);
            const image = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = decode(image.data, image.width, image.height);
            if (code?.data) {
              const target = raidQrDestination(code.data, window.location.origin);
              if (target) {
                stop();
                dialog.current?.close();
                router.push(target);
                return;
              }
              setStatus("レイド用のQRではありません。会場のQRを読み取ってください。");
            }
          }
          timer = setTimeout(scan, 180);
        }
        scan();
      } catch (cause) {
        if (cancelled) return;
        const name = cause instanceof Error ? cause.name : "";
        const message = cause instanceof Error ? cause.message : "";
        stop();
        setError(true);
        setStatus(message === "insecure"
          ? "カメラを使うにはHTTPSで開いてください。"
          : message === "unsupported"
            ? "このブラウザではカメラを使えません。スマートフォンのブラウザで開いてください。"
            : name === "NotAllowedError" || name === "SecurityError"
              ? "カメラへのアクセスが許可されていません。ブラウザの設定で許可してから、もう一度お試しください。"
              : name === "NotFoundError"
                ? "カメラが見つかりません。カメラのある端末で開いてください。"
                : "カメラを起動できません。他のアプリでカメラを使っていないか確認してください。");
      }
    }
    void start();
    return () => {
      stop();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", hide);
    };
  }, [open, attempt, router]);

  const label = <><span className={styles.qrIcon}><QrCode size={25} aria-hidden="true"/></span><span className={styles.triggerCopy}><strong>QRでレイドに参加</strong></span><ChevronRight size={21} aria-hidden="true"/></>;
  if (!hasPlayer) return <Link href={startHref} className={styles.trigger} aria-label="QRでレイドに参加">{label}</Link>;

  return <>
    <button className={styles.trigger} type="button" aria-label="QRでレイドに参加" onClick={() => {
      setError(false);
      setStatus("カメラを起動しています…");
      dialog.current?.showModal();
      setOpen(true);
    }}>{label}</button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={`${id}-title`} onClose={() => setOpen(false)} onClick={(event) => {
      if (event.target === event.currentTarget) dialog.current?.close();
    }}>
      <div className={styles.heading}>
        <h2 id={`${id}-title`}><QrCode size={23}/>レイドQRを読み取る</h2>
        <button type="button" aria-label="QR読み取りを閉じる" className={styles.close} onClick={() => dialog.current?.close()}><X size={22}/></button>
      </div>
      <div className={styles.preview}>
        <Camera className={styles.placeholder} size={42}/>
        <video ref={video} muted playsInline aria-label="QR読み取り用カメラ"/>
        <div className={styles.scanFrame} aria-hidden="true"/>
      </div>
      <p className={`${styles.status} ${error ? styles.error : ""}`} role="status">{status}</p>

      {error && <button type="button" className={styles.retry} onClick={() => {
        setError(false);
        setStatus("カメラを起動しています…");
        setAttempt((value) => value + 1);
      }}><RotateCcw size={16}/>もう一度カメラを開く</button>}
    </dialog>
  </>;
}
