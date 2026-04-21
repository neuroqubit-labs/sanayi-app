import { Redirect, type Href } from "expo-router";

export default function CekiciCagirModal() {
  return <Redirect href={"/(modal)/talep/towing" as Href} />;
}
