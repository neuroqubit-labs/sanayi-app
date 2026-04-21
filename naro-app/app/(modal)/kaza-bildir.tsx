import { Redirect, type Href } from "expo-router";

export default function KazaBildirModal() {
  return <Redirect href={"/(modal)/talep/accident" as Href} />;
}
