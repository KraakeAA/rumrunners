import Home from "../page";

// Every game page has its own address, for example /roulette or /crimes.
// This loads the same game as the home page, opened on that page.
export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return Home({ searchParams: Promise.resolve({ go: section }) });
}
