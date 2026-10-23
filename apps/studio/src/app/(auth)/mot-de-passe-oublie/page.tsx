import OubliForm from "./OubliForm";
import StudioHead from "@/components/StudioHead";

export const dynamic = "force-dynamic";

export default function OubliPage() {
  return (
    <>
      <StudioHead title="Mot de passe oublié" />
      <OubliForm />
    </>
  );
}
