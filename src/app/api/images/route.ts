import { NextResponse } from "next/server";
const FEED_LIMIT = 60;

type WikimediaPage = {
  pageid: number;
  title: string;
  imageinfo?: Array<{
    thumburl?: string;
    thumbwidth?: number;
    thumbheight?: number;
    url?: string;
  }>;
};

type WikimediaResponse = {
  query?: {
    pages?: Record<string, WikimediaPage>;
  };
};

const TOPIC_MAP: Array<{ re: RegExp; en: string }> = [
  { re: /цвет|цветок|flowers?|floral|rose|tulip|bouquet/i, en: "flowers blossom macro" },
  { re: /гор|mountain|alps|peak/i, en: "mountains landscape" },
  { re: /море|океан|beach|sea|ocean/i, en: "ocean beach" },
  { re: /лес|forest|tree|woods/i, en: "forest nature" },
  { re: /кот|кошка|cat/i, en: "cat" },
  { re: /собак|dog|puppy/i, en: "dog" },
  { re: /машин|авто|car|bmw|mercedes/i, en: "cars automotive" },
  { re: /дизайн|бренд|брендинг|постер|типограф|design|branding|poster|typography/i, en: "graphic design poster typography" },
  { re: /архитект|здан|building|architecture/i, en: "architecture building" },
];

const normalizeTopic = (rawTopic: string) => {
  const topic = rawTopic.trim().toLowerCase();
  for (const item of TOPIC_MAP) {
    if (item.re.test(topic)) return item.en;
  }
  return topic || "nature";
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const topic = (searchParams.get("topic") || "nature").trim();
    const normalized = normalizeTopic(topic);
    const query = normalized.replaceAll(",", " ");

    const wikiUrl =
      "https://commons.wikimedia.org/w/api.php" +
      `?action=query&generator=search&gsrsearch=${encodeURIComponent(`${query} filetype:bitmap`)}` +
      "&gsrnamespace=6&gsrlimit=50&prop=imageinfo&iiprop=url&iiurlwidth=640&format=json&origin=*";

    const res = await fetch(wikiUrl, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ images: [] });
    }

    const data = (await res.json()) as WikimediaResponse;
    const pages = Object.values(data.query?.pages ?? {});

    const images = pages
      .map((page) => {
        const info = page.imageinfo?.[0];
        const url = info?.thumburl || info?.url || "";
        const width = info?.thumbwidth || 640;
        const height = info?.thumbheight || 420;
        const okExt = /\.(jpg|jpeg|png|webp)$/i.test(url);

        if (!url || !okExt) return null;

        return {
          id: String(page.pageid),
          url,
          fallbackUrl: `https://picsum.photos/seed/wiki-${page.pageid}/560/${Math.max(160, height)}`,
          alt: page.title.replace(/^File:/, ""),
          width,
          height,
        };
      })
      .filter(Boolean)
      .slice(0, FEED_LIMIT) as Array<{
      id: string;
      url: string;
      fallbackUrl: string;
      alt: string;
      width: number;
      height: number;
    }>;

    if (images.length < FEED_LIMIT) {
      const extras = Array.from({ length: FEED_LIMIT - images.length }, (_, i) => {
        const h = [180, 220, 260, 320, 380][i % 5];
        return {
          id: `extra-${i}`,
          url: `https://picsum.photos/seed/extra-main-${encodeURIComponent(query)}-${i + 1}/560/${h}`,
          fallbackUrl: `https://picsum.photos/seed/extra-${encodeURIComponent(query)}-${i + 1}/560/${h}`,
          alt: `${query} ${i + 1}`,
          width: 560,
          height: h,
        };
      });
      return NextResponse.json({ images: [...images, ...extras] });
    }

    return NextResponse.json({ images });
  } catch {
    return NextResponse.json({ images: [] });
  }
}
