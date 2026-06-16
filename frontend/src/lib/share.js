import { toast } from "sonner";
import { API } from "./api";

// Native "share sheet" for a blog post. We share the backend Open Graph URL
// (/api/posts/og/<slug>) so WhatsApp/Facebook/Instagram render a rich preview
// with the post's title, excerpt and cover image. Humans who open it are
// redirected to the real article (/p/<slug>).
export async function sharePost({ slug, title, text }) {
  const url = `${API}/posts/og/${slug}`;
  const shareData = {
    title: title || "La Campeona 880 AM",
    text: text || title || "",
    url,
  };
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (e) {
      if (e && e.name === "AbortError") return; // user cancelled — do nothing
    }
  }
  // Fallback: copy the link to the clipboard.
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado — pégalo donde quieras compartir");
  } catch {
    toast.error("No se pudo compartir");
  }
}
