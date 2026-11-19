const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, apiKey, content-type",
};

const SYSTEM = `Tu normalises des références de livres russes pour une app d'échange de livres.

L'utilisateur écrit soit en cyrillique, soit en translittération latine ("voina i mir"),
soit avec un titre traduit en français ou en anglais.

Pour CHAQUE livre identifié dans le texte, produis un objet avec :
- "title": le titre en CYRILLIQUE (traduis depuis le français/anglais si nécessaire)
- "author": l'auteur en CYRILLIQUE, ou null si inconnu
- "canonical": "<titre cyrillique> <auteur cyrillique>"

Règles strictes :
- Si le texte contient plusieurs livres (séparés par des virgules), retourne un objet par livre.
- Si tu ne reconnais PAS l'œuvre, garde le texte de l'utilisateur tel quel dans "title"
  et mets "canonical" = ce même texte. N'invente jamais de titre.
- Réponds UNIQUEMENT avec un tableau JSON. Pas de markdown, pas de backticks, pas de texte avant ou après.

Exemple d'entrée : "trudno bit bogom, Мастер и Маргарита"
Exemple de sortie :
[{"title":"Трудно быть богом","author":"Аркадий и Борис Стругацкие","canonical":"Трудно быть богом Стругацкие"},{"title":"Мастер и Маргарита","author":"Михаил Булгаков","canonical":"Мастер и Маргарита Булгаков"}]`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { raw, mode = "wishlist" } = await req.json();

    if (!raw || typeof raw !== "string" || !raw.trim()) {
      return new Response(JSON.stringify({ error: "`raw` (string) is required" }), {
        status: 400,
        headers: { ...cors, "content-type": "application/json" },
      });
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: SYSTEM,
        messages: [{ role: "user", content: raw.trim() }],
      }),
    });

    if (!res.ok) {
      console.error("Anthropic error:", res.status, await res.text());
      return new Response(
        JSON.stringify({
          entries: [{ title: raw.trim(), author: null, canonical: raw.trim() }],
          degraded: true,
        }),
        { headers: { ...cors, "content-type": "application/json" } },
      );
    }

    const data = await res.json();
    const text = (data.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    let entries;
    try {
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      entries = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      console.error("JSON parse failed, model output:", text);
      entries = [{ title: raw.trim(), author: null, canonical: raw.trim() }];
    }

    if (mode === "book") entries = entries.slice(0, 1);

    entries = entries
      .filter((e) => e && (e.title || e.canonical))
      .map((e) => ({
        title: e.title ?? raw.trim(),
        author: e.author ?? null,
        canonical: e.canonical || e.title || raw.trim(),
      }));

    return new Response(JSON.stringify({ entries }), {
      headers: { ...cors, "content-type": "application/json" },
    });
  } catch (err) {
    console.error("normalize-book failed:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 400,
      headers: { ...cors, "content-type": "application/json" },
    });
  }
});
