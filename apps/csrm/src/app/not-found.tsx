import { UnavailableState } from "@/components/states/unavailable-state";

/** Planned and unrecognised routes deliberately share fixed safe copy. */
export default function NotFoundPage() {
  return <UnavailableState />;
}
