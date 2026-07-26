import { NextResponse } from "next/server";

// v2'de sunucu tarafı proje/dosya/render uçları kaldırıldı:
// projeler ve dosyalar tarayıcıda (IndexedDB), video render'ı da tarayıcıda üretilir.
// Bu uçlar sessizce başarısız olmasın diye açık bir 410 döner.
export function gone(): NextResponse {
  return NextResponse.json(
    {
      error: "GONE",
      message:
        "Bu uç kaldırıldı. CinoVid v2 istemci tarafında çalışır: projeler IndexedDB'de tutulur, video tarayıcıda üretilir.",
    },
    { status: 410 }
  );
}
