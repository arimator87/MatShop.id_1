import { PortfolioSection } from "@/components/PortfolioSection";

export default function Portfolio() {
  return <div data-testid="portfolio-page"><PortfolioSection limit={50} full /></div>;
}
