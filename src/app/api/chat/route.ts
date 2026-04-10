import { NextResponse } from "next/server";

type ChatBody = {
  message?: string;
  history?: Array<{
    role: "user" | "bot";
    text: string;
  }>;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ChatBody;
    const message = body?.message?.trim();
    const history = Array.isArray(body?.history) ? body.history : [];

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        reply: `Ты написал: "${message}".\n\nДобавь OPENAI_API_KEY в .env.local, и я начну отвечать через реальную модель.`,
      });
    }

    const completion = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Ты дружелюбный ассистент. Отвечай кратко, понятно и на русском языке.",
          },
          ...history.slice(-16).map((item) => ({
            role: item.role === "bot" ? "assistant" : "user",
            content: item.text,
          })),
          { role: "user", content: message },
        ],
        temperature: 0.7,
      }),
    });

    if (!completion.ok) {
      const errorText = await completion.text();
      return NextResponse.json(
        { error: `OpenAI API error: ${errorText}` },
        { status: 500 },
      );
    }

    const data = (await completion.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const reply = data.choices?.[0]?.message?.content?.trim();

    return NextResponse.json({
      reply: reply || "Извини, не получилось сгенерировать ответ.",
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
