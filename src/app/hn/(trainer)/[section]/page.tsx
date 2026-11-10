import { notFound } from "next/navigation";
import Trainer from "@/components/trainer";
const sections = [
  "learn",
  "library",
  "flashcards",
  "practice",
  "conversations",
  "statistics",
  "books",
  "settings",
  "api",
];
export function generateStaticParams() {
  return sections.map((section) => ({ section }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!sections.includes(section)) notFound();
  return <Trainer section={section} />;
}
