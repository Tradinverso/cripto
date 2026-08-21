import type { Metadata } from "next";
import { Dashboard } from "./dashboard";

export const metadata: Metadata = {
  title: "Panel de contratos | Tradinverso",
  description: "Gestión privada de alumnos, cuotas y contratos en criptomonedas.",
};

export default function Home() {
  return <Dashboard />;
}
