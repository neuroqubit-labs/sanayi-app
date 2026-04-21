import { Redirect, type Href } from "expo-router";

export default function ArizaBildirModal() {
  return <Redirect href={"/(modal)/talep/breakdown" as Href} />;
}
