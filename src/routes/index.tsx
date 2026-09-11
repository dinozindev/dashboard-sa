import { createFileRoute } from "@tanstack/react-router";
import Dashboard from "@/components/dashboard/Dashboard";

const title = "Obramax · Dashboard Interativo de Frete";
const description =
  "Mapa interativo de áreas de entrega, tarifas por faixa de peso, políticas de envio, horários e capacidade operacional das lojas Obramax em SP e RJ.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <Dashboard />;
}
