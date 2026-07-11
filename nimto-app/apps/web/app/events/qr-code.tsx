"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

export function InvitationQrCode({
  label,
  url,
}: {
  label: string;
  url: string;
}) {
  const [source, setSource] = useState("");

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(url, {
      width: 320,
      margin: 2,
      color: { dark: "#2b222e", light: "#ffffff" },
    }).then((value) => {
      if (active) setSource(value);
    });
    return () => {
      active = false;
    };
  }, [url]);

  function download() {
    if (!source) return;
    const link = document.createElement("a");
    link.href = source;
    link.download = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-qr.png`;
    link.click();
  }

  return (
    <button
      className="user-secondary-button"
      disabled={!source}
      onClick={download}
      type="button"
    >
      Download QR
    </button>
  );
}
