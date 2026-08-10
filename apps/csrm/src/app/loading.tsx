import { LoadingState } from "@/components/states/loading-state";

/** The root layout remains visible while the page segment is loading. */
export default function LoadingPage() {
  return <LoadingState />;
}
