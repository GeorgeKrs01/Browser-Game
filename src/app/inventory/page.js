import { ProgressBarsDemo } from "./ProgressBarsDemo";

export const metadata = {
  title: "Progress bars",
};

export default function InventoryPage() {
  return (
    <section className="page">
      <h1 className="page-title">Progress bars</h1>
      <ProgressBarsDemo />
    </section>
  );
}

