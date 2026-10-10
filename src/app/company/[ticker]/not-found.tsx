import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CompanyNotFound() {
  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center py-12 text-center">
      <SearchX className="mb-4 size-12 text-muted-foreground" />
      <h1 className="text-2xl font-bold">Company not found</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        We don&apos;t have a dataset for that ticker. StockScope only analyses companies present in
        the loaded dataset — arbitrary ticker search is intentionally not supported.
      </p>
      <Link href="/" className="mt-6">
        <Button>Browse available companies</Button>
      </Link>
    </div>
  );
}
