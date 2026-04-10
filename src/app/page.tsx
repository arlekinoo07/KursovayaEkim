"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { LogOut, Plus, Search, SendHorizontal, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Message = {
  role: "user" | "bot";
  text: string;
  time: string;
};

type ChatSession = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
};

type UserRecord = {
  email: string;
  password: string;
};

type FeedImage = {
  id: string;
  url: string;
  fallbackUrl: string;
  alt: string;
  width: number;
  height: number;
};

const USERS_KEY = "arleai_users";
const CURRENT_USER_KEY = "arleai_current_user";
const FEED_LIMIT = 60;

const getChatsKey = (email: string) => `arleai_chats_${email}`;

const getTime = () =>
  new Date().toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });

const STOP_WORDS = new Set([
  "и",
  "в",
  "на",
  "с",
  "по",
  "о",
  "что",
  "это",
  "как",
  "для",
  "или",
  "а",
  "но",
  "не",
  "да",
  "to",
  "the",
  "of",
  "and",
  "is",
  "are",
  "in",
  "on",
  "for",
  "расскажи",
  "покажи",
  "подскажи",
  "можешь",
  "красивый",
  "красивые",
  "красивых",
  "красиво",
  "подробно",
  "про",
  "мне",
]);

const extractTopic = (messages: Message[]) => {
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const text = (lastUserMessage?.text || "").toLowerCase();

  const words = text
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));

  if (!words.length) return "nature";

  if (words.some((w) => /цвет|flower|floral|rose|tulip/i.test(w))) {
    return "flowers";
  }

  if (words.some((w) => /гор|mountain|alps|peak/i.test(w))) {
    return "mountains";
  }

  const topic = words.slice(0, 4).join(" ");

  return topic || "nature";
};

const buildFallbackImageFeed = (topic: string): FeedImage[] => {
  const heights = [180, 210, 240, 270, 310, 360, 420];
  const q = encodeURIComponent(topic.replaceAll(",", " "));
  return Array.from({ length: FEED_LIMIT }, (_, i) => {
    const height = heights[i % heights.length];
    return {
      id: `${topic}-${i}`,
      url: `https://picsum.photos/seed/${q}-${i + 1}/560/${height}`,
      fallbackUrl: `https://picsum.photos/seed/${q}-fb-${i + 1}/560/${height}`,
      alt: `photo ${i + 1} ${topic}`,
      width: 560,
      height,
    };
  });
};

const createEmptyChat = (): ChatSession => {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: "Новый чат",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
};

export default function DialogPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [imageFeed, setImageFeed] = useState<FeedImage[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) ?? null,
    [chats, activeChatId],
  );
  const currentTopic = useMemo(
    () => extractTopic(activeChat?.messages ?? []),
    [activeChat?.messages],
  );
  const hasFeed = (activeChat?.messages.length ?? 0) > 0;

  useEffect(() => {
    const storedUsers = localStorage.getItem(USERS_KEY);
    const parsedUsers = storedUsers ? (JSON.parse(storedUsers) as UserRecord[]) : [];
    setUsers(parsedUsers);

    const savedUser = localStorage.getItem(CURRENT_USER_KEY);
    if (savedUser) {
      setCurrentUser(savedUser);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setChats([]);
      setActiveChatId(null);
      return;
    }

    const storedChats = localStorage.getItem(getChatsKey(currentUser));
    const parsedChats = storedChats ? (JSON.parse(storedChats) as ChatSession[]) : [];

    if (parsedChats.length === 0) {
      const firstChat = createEmptyChat();
      setChats([firstChat]);
      setActiveChatId(firstChat.id);
      return;
    }

    const sorted = [...parsedChats].sort((a, b) => b.updatedAt - a.updatedAt);
    setChats(sorted);
    setActiveChatId(sorted[0].id);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    localStorage.setItem(getChatsKey(currentUser), JSON.stringify(chats));
  }, [chats, currentUser]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat?.messages]);

  useEffect(() => {
    let cancelled = false;

    const loadImages = async () => {
      if (!hasFeed) {
        setImageFeed([]);
        return;
      }

      setImagesLoading(true);
      try {
        const res = await fetch(`/api/images?topic=${encodeURIComponent(currentTopic)}`);
        const data = (await res.json()) as { images?: FeedImage[] };
        const images = Array.isArray(data.images) ? data.images : [];
        if (!cancelled) {
          setImageFeed(
            images.length > 0
              ? images.slice(0, FEED_LIMIT)
              : buildFallbackImageFeed(currentTopic),
          );
        }
      } catch {
        if (!cancelled) {
          setImageFeed(buildFallbackImageFeed(currentTopic));
        }
      } finally {
        if (!cancelled) {
          setImagesLoading(false);
        }
      }
    };

    void loadImages();

    return () => {
      cancelled = true;
    };
  }, [currentTopic, hasFeed]);

  const updateActiveChat = (updater: (chat: ChatSession) => ChatSession) => {
    setChats((prev) =>
      prev
        .map((chat) => (chat.id === activeChatId ? updater(chat) : chat))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    );
  };

  const createNewChat = () => {
    const nextChat = createEmptyChat();
    setChats((prev) => [nextChat, ...prev]);
    setActiveChatId(nextChat.id);
    setInput("");
  };

  const removeChat = (chatId: string) => {
    setChats((prev) => {
      const next = prev.filter((chat) => chat.id !== chatId);
      if (next.length === 0) {
        const fresh = createEmptyChat();
        setActiveChatId(fresh.id);
        setInput("");
        return [fresh];
      }

      if (activeChatId === chatId) {
        setActiveChatId(next[0].id);
        setInput("");
      }
      return next;
    });
  };

  const handleAuth = () => {
    const email = authEmail.trim().toLowerCase();
    const password = authPassword.trim();

    if (!email || !password) {
      setAuthError("Заполни email и пароль.");
      return;
    }

    if (authMode === "register") {
      if (users.some((u) => u.email === email)) {
        setAuthError("Пользователь с таким email уже существует.");
        return;
      }

      const nextUsers = [...users, { email, password }];
      setUsers(nextUsers);
      localStorage.setItem(USERS_KEY, JSON.stringify(nextUsers));
      localStorage.setItem(CURRENT_USER_KEY, email);
      setCurrentUser(email);
      setAuthError("");
      setAuthPassword("");
      return;
    }

    const user = users.find((u) => u.email === email && u.password === password);
    if (!user) {
      setAuthError("Неверный email или пароль.");
      return;
    }

    localStorage.setItem(CURRENT_USER_KEY, email);
    setCurrentUser(email);
    setAuthError("");
    setAuthPassword("");
  };

  const logout = () => {
    localStorage.removeItem(CURRENT_USER_KEY);
    setCurrentUser(null);
    setInput("");
  };

  const typeBotAnswer = (chatId: string, fullText: string) => {
    const botMessage: Message = {
      role: "bot",
      text: "",
      time: getTime(),
    };

    setChats((prev) =>
      prev
        .map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                messages: [...chat.messages, botMessage],
                updatedAt: Date.now(),
              }
            : chat,
        )
        .sort((a, b) => b.updatedAt - a.updatedAt),
    );

    let currentText = "";
    let i = 0;

    const interval = setInterval(() => {
      currentText += fullText[i] ?? "";

      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id !== chatId || chat.messages.length === 0) return chat;
          const nextMessages = [...chat.messages];
          nextMessages[nextMessages.length - 1] = {
            ...nextMessages[nextMessages.length - 1],
            text: currentText,
          };
          return { ...chat, messages: nextMessages, updatedAt: Date.now() };
        }),
      );

      i += 1;
      if (i >= fullText.length) {
        clearInterval(interval);
      }
    }, 14);
  };

  const sendMessage = async () => {
    if (!input.trim() || isSending || !activeChatId) return;

    const messageText = input.trim();
    const userMessage: Message = {
      role: "user",
      text: messageText,
      time: getTime(),
    };

    updateActiveChat((chat) => {
      const isNewTitle = chat.title === "Новый чат";
      return {
        ...chat,
        title: isNewTitle ? messageText.slice(0, 32) : chat.title,
        messages: [...chat.messages, userMessage],
        updatedAt: Date.now(),
      };
    });

    setInput("");
    setIsSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          history:
            activeChat?.messages.map((msg) => ({
              role: msg.role,
              text: msg.text,
            })) ?? [],
        }),
      });

      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok) {
        const errorText = data.error || "Неизвестная ошибка AI.";
        typeBotAnswer(activeChatId, `Ошибка AI: ${errorText}`);
        return;
      }

      const fullText =
        data.reply ?? "Не удалось получить ответ. Попробуй отправить еще раз.";
      typeBotAnswer(activeChatId, fullText);
    } catch {
      typeBotAnswer(
        activeChatId,
        "Сервис временно недоступен. Проверь подключение и попробуй снова.",
      );
    } finally {
      setIsSending(false);
    }
  };

  if (!currentUser) {
    return (
      <main className="flex h-screen w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_#ffffff_0%,_#eef5ff_50%,_#e8f1ff_100%)] px-4">
        <div className="w-full max-w-md rounded-[24px] border border-[#d9e5f5] bg-white p-6 shadow-[0_16px_40px_rgba(48,86,130,0.14)]">
          <div className="mb-4 flex flex-col items-center">
            <Image src="/logo.png" alt="ArleAI logo" width={74} height={74} />
            <h1 className="mt-1 text-2xl font-semibold text-[#1d2f46]">ArleAI</h1>
          </div>

          <p className="mb-4 text-center text-sm text-[#5b7088]">
            {authMode === "login" ? "Вход в аккаунт" : "Регистрация аккаунта"}
          </p>

          <div className="space-y-3">
            <input
              type="email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="Email"
              className="w-full rounded-[14px] border border-[#cad9ee] px-4 py-3 text-[#1f2732] outline-none"
            />
            <input
              type="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="Пароль"
              className="w-full rounded-[14px] border border-[#cad9ee] px-4 py-3 text-[#1f2732] outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAuth();
              }}
            />
          </div>

          {authError && <p className="mt-3 text-sm text-[#c62828]">{authError}</p>}

          <button
            onClick={handleAuth}
            className="mt-4 w-full rounded-[14px] bg-[#70C3FF] px-4 py-3 font-medium text-white transition hover:brightness-95"
          >
            {authMode === "login" ? "Войти" : "Создать аккаунт"}
          </button>

          <button
            onClick={() => {
              setAuthMode((prev) => (prev === "login" ? "register" : "login"));
              setAuthError("");
            }}
            className="mt-3 w-full text-sm text-[#3d6189]"
          >
            {authMode === "login"
              ? "Нет аккаунта? Зарегистрироваться"
              : "Уже есть аккаунт? Войти"}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen w-full overflow-hidden bg-[radial-gradient(circle_at_top,_#ffffff_0%,_#eef5ff_50%,_#e8f1ff_100%)]">
      <div className="mx-auto flex h-full w-full max-w-7xl gap-3 px-2 py-2 md:px-8">
        <aside className="hidden h-full w-[230px] shrink-0 flex-col rounded-[22px] border border-[#d9e5f5] bg-white/85 p-3 shadow-[0_16px_40px_rgba(48,86,130,0.12)] backdrop-blur-sm lg:flex">
          <div className="mb-4 flex items-center gap-2">
            <Image src="/logo.png" alt="ArleAI logo" width={38} height={38} />
            <span className="text-lg font-semibold text-[#1d2f46]">ArleAI</span>
          </div>

          <button
            onClick={createNewChat}
            className="mb-3 flex items-center justify-center gap-2 rounded-[12px] bg-[#70C3FF] px-3 py-2.5 text-sm font-medium text-white transition hover:brightness-95"
          >
            <Plus size={16} />
            Новый чат
          </button>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="space-y-2">
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  className={`flex items-center gap-2 rounded-[12px] px-2 py-1.5 text-sm transition ${
                    chat.id === activeChatId
                      ? "bg-[#e8f4ff] text-[#1d2f46]"
                      : "bg-[#f5f8fc] text-[#48617b] hover:bg-[#edf4fb]"
                  }`}
                >
                  <button
                    onClick={() => setActiveChatId(chat.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate">{chat.title || "Новый чат"}</p>
                  </button>
                  <button
                    onClick={() => removeChat(chat.id)}
                    className="rounded p-1 text-[#5f7590] hover:bg-black/5 hover:text-[#2d4765]"
                    aria-label="Удалить чат"
                    title="Удалить чат"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 rounded-[12px] border border-[#e0ebfa] bg-[#f8fbff] p-3">
            <p className="truncate text-xs text-[#5b7088]">{currentUser}</p>
            <button
              onClick={logout}
              className="mt-2 flex items-center gap-1 text-xs text-[#35577e]"
            >
              <LogOut size={14} />
              Выйти
            </button>
          </div>
        </aside>

        <section className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[20px] border border-[#d9e5f5] bg-white/80 p-3 shadow-[0_16px_40px_rgba(48,86,130,0.14)] backdrop-blur-sm md:rounded-[24px] md:p-5">
          <div className="mb-2">
            <h1 className="text-2xl font-semibold text-[#1d2f46]">ArleAI</h1>
          </div>

          <div className={`min-h-0 overflow-y-auto pr-2 ${hasFeed ? "flex-[0.9]" : "flex-1"}`}>
            <div className="space-y-4">
              {!activeChat?.messages.length && (
                <p className="mt-10 text-center text-[#6d8098]">
                  Напиши сообщение, чтобы начать диалог
                </p>
              )}

              {activeChat?.messages.map((msg, i) => (
                <div
                  key={i}
                  className={msg.role === "user" ? "flex flex-col items-end" : ""}
                >
                  <div
                    className={`w-fit max-w-[88%] rounded-[14px] px-5 py-3 md:max-w-[80%] ${
                      msg.role === "user"
                        ? "bg-[#70C3FF] text-white"
                        : "bg-[#f2f5f9] text-[#1f2732]"
                    }`}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => (
                          <p className="whitespace-pre-wrap leading-6">{children}</p>
                        ),
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                  <p className="mt-1 text-xs text-[#6f7f91]">{msg.time}</p>
                </div>
              ))}

              <div ref={bottomRef} />
            </div>
          </div>

          <div className="mt-2 mb-2 flex items-center gap-2 rounded-[18px] border border-[#cad9ee] bg-white px-3 py-3 shadow-[0_4px_14px_rgba(42,78,120,0.08)]">
            <Search className="shrink-0 text-[#2f4f73]/45" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Напиши сообщение..."
              className="w-full bg-transparent text-[#1f2732] outline-none placeholder:text-[#5b7088]/55"
              disabled={isSending || !activeChatId}
            />
            <button
              onClick={sendMessage}
              disabled={isSending || !activeChatId || !input.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#70C3FF] text-white transition disabled:cursor-not-allowed disabled:opacity-50 lg:hidden"
              aria-label="Отправить"
            >
              <SendHorizontal size={16} />
            </button>
          </div>

          {hasFeed && (
            <div className="mt-1 min-h-0 flex-[1.15]">
              <p className="mb-2 text-xs text-[#58708b]">
                Фото по теме: {currentTopic.replaceAll(",", ", ")}
              </p>
              <div className="h-full overflow-y-auto rounded-[12px] bg-[#f1f2f4] p-3">
                {imagesLoading && (
                  <p className="mb-2 text-xs text-[#6e8096]">Загружаю изображения...</p>
                )}
                <div className="columns-2 gap-3 md:columns-3 lg:columns-5">
                  {imageFeed.map((img) => (
                    <div key={img.id} className="group relative mb-3 break-inside-avoid">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={img.alt}
                        loading="lazy"
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (target.dataset.fallbackApplied === "1") return;
                          target.dataset.fallbackApplied = "1";
                          target.src = img.fallbackUrl;
                        }}
                        className="w-full rounded-[14px] object-cover"
                      />
                      <button className="absolute right-2 bottom-2 rounded-full bg-black/55 px-2 py-0.5 text-xs text-white opacity-0 transition group-hover:opacity-100">
                        ...
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
