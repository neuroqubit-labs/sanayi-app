import { type Href, Redirect, useLocalSearchParams } from "expo-router";

export default function LegacyCaseProfileRedirect() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <Redirect href={`/vaka/${id ?? ""}` as Href} />;
}
