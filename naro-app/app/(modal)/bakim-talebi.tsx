import { Redirect, type Href } from "expo-router";

export default function BakimTalebiModal() {
  return <Redirect href={"/(modal)/talep/maintenance" as Href} />;
}
