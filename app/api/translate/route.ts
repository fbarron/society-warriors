import { NextRequest, NextResponse } from "next/server";

type DetectMessageInput = {
  id: number;
  text: string;
};

type DeepLTranslation = {
  detected_source_language?: string;
  text?: string;
};

const MAX_TEXT_LENGTH = 500;
const DEEPL_API_URL = process.env.DEEPL_API_URL || "https://api-free.deepl.com/v2/translate";
const COMMON_ENGLISH_BIGRAMS = new Set([
  "th",
  "he",
  "in",
  "er",
  "an",
  "re",
  "on",
  "at",
  "en",
  "nd",
  "st",
  "to",
  "it",
  "ou",
  "ea",
  "hi",
  "is",
  "or",
  "ti",
  "as",
  "te",
  "et",
  "ng",
  "of",
  "al",
  "de",
  "se",
  "le",
  "sa",
  "si",
  "ar",
  "ve",
  "ra",
  "ld",
  "ur",
]);

function normalizeText(text: string) {
  return text.trim().toLowerCase();
}

function normalizeComparableText(text: string) {
  return normalizeText(text).replace(/[^\p{L}\p{N}\s]+/gu, " ").replace(/\s+/g, " ").trim();
}

function isAsciiText(text: string) {
  return /^[\x00-\x7F]*$/.test(text);
}

function getTokenSet(text: string) {
  const tokens = normalizeComparableText(text)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  return new Set(tokens);
}

function getTokenOverlap(left: string, right: string) {
  const leftTokens = getTokenSet(left);
  const rightTokens = getTokenSet(right);

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.min(leftTokens.size, rightTokens.size);
}

function getBigrams(text: string) {
  const normalized = text.replace(/\s+/g, " ");
  const grams = new Set<string>();

  for (let index = 0; index < normalized.length - 1; index += 1) {
    grams.add(normalized.slice(index, index + 2));
  }

  return grams;
}

function getDiceCoefficient(left: string, right: string) {
  if (left === right) {
    return 1;
  }

  if (left.length < 2 || right.length < 2) {
    return 0;
  }

  const leftBigrams = getBigrams(left);
  const rightBigrams = getBigrams(right);
  let overlap = 0;

  for (const gram of leftBigrams) {
    if (rightBigrams.has(gram)) {
      overlap += 1;
    }
  }

  return (2 * overlap) / (leftBigrams.size + rightBigrams.size);
}

function isRepeatedPattern(text: string) {
  if (text.length < 4) {
    return false;
  }

  const maxPatternLength = Math.min(4, Math.floor(text.length / 2));
  for (let patternLength = 1; patternLength <= maxPatternLength; patternLength += 1) {
    if (text.length % patternLength !== 0) {
      continue;
    }

    const pattern = text.slice(0, patternLength);
    if (pattern.repeat(text.length / patternLength) === text) {
      return true;
    }
  }

  return false;
}

function isLikelyAsciiSingleWordGibberish(text: string) {
  const normalized = normalizeComparableText(text);
  if (!isAsciiText(normalized) || normalized.includes(" ")) {
    return false;
  }

  if (normalized.length < 6) {
    return false;
  }

  let knownBigramCount = 0;
  let totalBigrams = 0;
  for (let index = 0; index < normalized.length - 1; index += 1) {
    const bigram = normalized.slice(index, index + 2);
    totalBigrams += 1;
    if (COMMON_ENGLISH_BIGRAMS.has(bigram)) {
      knownBigramCount += 1;
    }
  }

  if (totalBigrams === 0) {
    return true;
  }

  const knownBigramRatio = knownBigramCount / totalBigrams;
  return knownBigramRatio < 0.2;
}

function shouldSkipTranslation(text: string) {
  const compact = normalizeText(text).replace(/[^\p{L}\p{N}]+/gu, "");

  if (compact.length === 0) {
    return true;
  }

  if (compact.length >= 3 && new Set(compact).size === 1) {
    return true;
  }

  if (compact.length >= 4 && isRepeatedPattern(compact)) {
    return true;
  }

  const uniqueCharacters = new Set(compact).size;
  if (compact.length >= 5 && uniqueCharacters <= 2) {
    return true;
  }

  if (isLikelyAsciiSingleWordGibberish(text)) {
    return true;
  }

  return false;
}

function isAlreadyEnglish(originalText: string, translation?: DeepLTranslation) {
  const detectedLanguage = translation?.detected_source_language?.toUpperCase();
  if (detectedLanguage === "EN") {
    return true;
  }

  if (typeof translation?.text === "string") {
    const originalComparable = normalizeComparableText(originalText);
    const translatedComparable = normalizeComparableText(translation.text);

    if (originalComparable === translatedComparable) {
      return true;
    }

    if (originalComparable.length >= 6 && translatedComparable.length >= 6) {
      const similarity = getDiceCoefficient(originalComparable, translatedComparable);
      if (similarity >= 0.9) {
        return true;
      }

      // DeepL can lightly rewrite English text (e.g., "im great" -> "its great").
      // For ASCII-only inputs, treat strong token overlap as already-English.
      if (isAsciiText(originalText) && isAsciiText(translation.text)) {
        const tokenOverlap = getTokenOverlap(originalComparable, translatedComparable);
        if (tokenOverlap >= 0.5 && similarity >= 0.6) {
          return true;
        }
      }
    }
  }

  return false;
}

async function translateWithDeepL(texts: string[]) {
  const apiKey = process.env.DEEPL_API_KEY;

  if (!apiKey) {
    throw new Error("Missing DEEPL_API_KEY");
  }

  const body = new URLSearchParams();
  for (const text of texts) {
    body.append("text", text);
  }
  body.set("target_lang", "EN");

  const response = await fetch(DEEPL_API_URL, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("DeepL request failed");
  }

  const data = (await response.json()) as {
    translations?: DeepLTranslation[];
  };

  if (!Array.isArray(data.translations)) {
    throw new Error("DeepL returned an invalid response");
  }

  return data.translations;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { text, detectOnly, messages } = body as {
    text?: unknown;
    detectOnly?: unknown;
    messages?: unknown;
  };

  if (detectOnly === true && Array.isArray(messages)) {
    const validMessages = messages
      .filter(
        (message): message is DetectMessageInput =>
          typeof message === "object" &&
          message !== null &&
          typeof (message as DetectMessageInput).id === "number" &&
          typeof (message as DetectMessageInput).text === "string"
      )
      .map((message) => ({
        id: message.id,
        text: message.text.trim().slice(0, MAX_TEXT_LENGTH),
      }))
      .filter((message) => message.text.length > 0);

    if (validMessages.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const skippedMessages = validMessages
      .filter((message) => shouldSkipTranslation(message.text))
      .map((message) => ({ id: message.id, alreadyEnglish: true, translatedText: null }));

    const translatableMessages = validMessages.filter((message) => !shouldSkipTranslation(message.text));

    if (translatableMessages.length === 0) {
      return NextResponse.json({ results: skippedMessages });
    }

    try {
      const translations = await translateWithDeepL(translatableMessages.map((message) => message.text));
      const results = translatableMessages.map((message, index) => {
        const translation = translations[index];
        const alreadyEnglish = isAlreadyEnglish(message.text, translation);

        return {
          id: message.id,
          alreadyEnglish,
          translatedText:
            alreadyEnglish || typeof translation?.text !== "string" || translation.text.trim().length === 0
              ? null
              : translation.text,
        };
      });

      return NextResponse.json({ results: [...skippedMessages, ...results] });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Translation service unavailable";
      const status = message === "Missing DEEPL_API_KEY" ? 500 : 502;
      return NextResponse.json({ error: message }, { status });
    }
  }

  if (typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  const trimmed = text.trim().slice(0, MAX_TEXT_LENGTH);

  if (shouldSkipTranslation(trimmed)) {
    return NextResponse.json({ alreadyEnglish: true, translatedText: null });
  }

  try {
    const [translation] = await translateWithDeepL([trimmed]);
    const alreadyEnglish = isAlreadyEnglish(trimmed, translation);

    return NextResponse.json({
      alreadyEnglish,
      translatedText:
        alreadyEnglish || typeof translation?.text !== "string" || translation.text.trim().length === 0
          ? null
          : translation.text,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Translation service unavailable";
    const status = message === "Missing DEEPL_API_KEY" ? 500 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
