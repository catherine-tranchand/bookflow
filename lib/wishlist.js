import { supabase } from "./supabase";

/**
 * Normalise un texte libre via l'Edge Function (Claude Haiku).
 * Si l'appel échoue ou renvoie degraded, on retombe sur le texte brut :
 * le match translittéré fonctionne quand même.
 */
async function normalize(raw, mode = "wishlist") {
  try {
    const { data, error } = await supabase.functions.invoke("normalize-book", {
      body: { raw, mode },
    });
    if (error) throw error;
    if (!data?.entries?.length) throw new Error("empty entries");
    return data.entries;
  } catch (err) {
    console.warn("normalize-book indisponible, fallback texte brut:", err?.message);
    return [{ title: raw, author: null, canonical: raw }];
  }
}

/** Ajoute une ou plusieurs entrées à partir d'un texte libre. */
export async function addWishlistEntries(userId, rawText) {
  const clean = rawText.trim();
  if (!clean) throw new Error("Texte vide");

  const entries = await normalize(clean, "wishlist");

  const rows = entries.map((e) => ({
    user_id: userId,
    raw_text: clean,
    title: e.title ?? null,
    author: e.author ?? null,
    canonical: e.canonical ?? clean,
  }));

  const { data, error } = await supabase
    .from("wishlist_items")
    .insert(rows)
    .select();

  if (error) throw error;
  return data ?? [];
}

export async function getWishlistItems(userId) {
  const { data, error } = await supabase
    .from("wishlist_items")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function removeWishlistItem(id) {
  const { error } = await supabase.from("wishlist_items").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Retourne une Map book_id → { label, score }.
 * Aucun appel API : tout se passe dans Postgres.
 */
export async function getWishlistMatches(threshold = 0.42) {
  const { data, error } = await supabase.rpc("match_wishlist", {
    p_threshold: threshold,
    p_limit: 40,
  });

  if (error) {
    console.warn("match_wishlist error:", error.message);
    return new Map();
  }

  const map = new Map();
  (data ?? []).forEach((m) =>
    map.set(m.book_id, { label: m.wishlist_label, score: m.score })
  );
  return map;
}

/** Normalise un livre au moment de sa publication (problème Open Library). */
export async function normalizeBook(bookId, title, author) {
  try {
    const [entry] = await normalize(
      `${title}${author ? " — " + author : ""}`,
      "book"
    );
    await supabase
      .from("books")
      .update({ canonical: entry.canonical })
      .eq("id", bookId);
  } catch (err) {
    // Ne jamais bloquer la publication d'un livre pour ça
    console.warn("normalizeBook failed:", err?.message);
  }
}